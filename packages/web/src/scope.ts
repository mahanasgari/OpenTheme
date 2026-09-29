/**
 * Scopes (data-model §3; research WR4; FR-W005, FR-W007, FR-W030 to FR-W033).
 *
 * Each scope owns one `<style data-opentheme-scope="<id>">` element holding one rule, written only
 * through the CSS object model, and one Core controller. Every publication is applied by diff.
 */
import type {
  Core,
  OperationalError,
  PolicyInput,
  PreferenceStore,
  ResolvedTheme,
  ThemeController,
  UserPreferencesDocument,
} from "@opentheme/core";
import { createContextSource, type SizeClass } from "./context.js";
import { toDeclarations, type Omission } from "./declarations.js";
import { NONCE, OpenThemeWebError, SCOPE_ID } from "./errors.js";
import { createBrowserStore } from "./store.js";
import { selectorFor } from "./stylesheet.js";

export type { SizeClass };

const SIZE_CLASSES = new Set(["compact", "medium", "expanded"]);
const validScale = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export interface AttachOptions {
  readonly core: Core;
  /** A Document applies to `:root`; an Element gets `data-opentheme-scope="<id>"`. */
  readonly target: Document | Element;
  readonly scope: string;
  readonly policy: PolicyInput;
  readonly sizeClass: SizeClass;
  readonly textScale?: number;
  /** Used when no `lang` attribute applies; default "en". */
  readonly locale?: string;
  readonly store?: PreferenceStore | false;
  readonly initial?: Uint8Array | string | UserPreferencesDocument;
  readonly nonce?: string;
}

export interface AdapterReport {
  readonly omissions: readonly Omission[];
  /** Properties set and removed by the last update. */
  readonly set: number;
  readonly removed: number;
}

export interface WebScope {
  readonly controller: ThemeController;
  readonly report: AdapterReport;
  /** Adapter errors (such as `store-read-failed`), then the controller's. */
  readonly errors: readonly OperationalError[];
  setSizeClass(sizeClass: SizeClass): void;
  setTextScale(textScale: number): void;
  detach(): void;
}

const ATTR = "data-opentheme-scope";
/** Targets and style elements owned by a live scope, across every scope on the page. */
const managed = new WeakSet<object>();

const isDocument = (t: Document | Element): t is Document => t.nodeType === 9;

function fail(kind: "scope-conflict" | "invalid-argument", message: string): never {
  throw new OpenThemeWebError(kind, "web.attachTheme", message);
}

/** The rule's current declarations (an adopted server-rendered element), by name. */
function readRule(rule: CSSStyleRule): Map<string, string> {
  const out = new Map<string, string>();
  const style = rule.style;
  for (let i = 0; i < style.length; i += 1) {
    const name = style.item(i);
    if (name.startsWith("--ot")) out.set(name, style.getPropertyValue(name).trim());
  }
  return out;
}

export function attachTheme(options: AttachOptions): WebScope {
  const { core, target, scope, nonce } = options;
  if (!target || typeof target.nodeType !== "number") fail("invalid-argument", "target must be a Document or an Element.");
  if (typeof scope !== "string" || !SCOPE_ID.test(scope)) fail("invalid-argument", "scope must match [a-z][a-z0-9-]*.");
  if (nonce !== undefined && !NONCE.test(nonce)) fail("invalid-argument", "nonce must be base64 or base64url.");
  if (!SIZE_CLASSES.has(options.sizeClass)) fail("invalid-argument", "sizeClass must be compact, medium, or expanded.");
  if (options.textScale !== undefined && !validScale(options.textScale)) fail("invalid-argument", "textScale must be a positive number.");

  const root = isDocument(target);
  const doc = root ? target : target.ownerDocument;
  const hostElement = root ? doc.documentElement : target;
  if (managed.has(hostElement)) fail("scope-conflict", "The target is already managed by a scope.");
  if (!root && target.hasAttribute(ATTR) && target.getAttribute(ATTR) !== scope) {
    fail("scope-conflict", "The target carries another scope id.");
  }
  let element = doc.querySelector<HTMLStyleElement>(`style[${ATTR}="${scope}"]`);
  if (element && managed.has(element)) fail("scope-conflict", `The scope id "${scope}" is already attached.`);

  // Create or adopt the style element and its single rule (FR-W030).
  const selector = selectorFor(scope, root);
  let current = new Map<string, string>();
  let rule: CSSStyleRule | null = null;
  if (element) {
    const first = element.sheet?.cssRules[0];
    if (element.sheet?.cssRules.length === 1 && first && (first as CSSStyleRule).selectorText === selector) {
      rule = first as CSSStyleRule;
      current = readRule(rule);
    } else {
      element.textContent = "";
    }
  } else {
    element = doc.createElement("style");
    element.setAttribute(ATTR, scope);
    if (nonce !== undefined) element.setAttribute("nonce", nonce);
    (doc.head ?? doc.documentElement).appendChild(element);
  }
  if (!rule) {
    const sheet = element.sheet;
    if (!sheet) fail("invalid-argument", "The style element has no stylesheet.");
    sheet.insertRule(`${selector} {}`, 0);
    rule = sheet.cssRules[0] as CSSStyleRule;
  }
  const style = rule.style;
  if (!root) target.setAttribute(ATTR, scope);
  managed.add(hostElement);
  managed.add(element);

  const adapterErrors: OperationalError[] = [];
  let report: AdapterReport = { omissions: [], set: 0, removed: 0 };

  const apply = (resolved: ResolvedTheme) => {
    const { declarations, omissions } = toDeclarations(resolved);
    const next = new Map<string, string>();
    for (const d of declarations) next.set(d.name, d.value);
    let set = 0;
    let removed = 0;
    for (const name of current.keys()) {
      if (!next.has(name)) {
        style.removeProperty(name);
        removed += 1;
      }
    }
    for (const [name, value] of next) {
      if (current.get(name) !== value) {
        style.setProperty(name, value);
        set += 1;
      }
    }
    current = next;
    report = Object.freeze({ omissions, set, removed });
  };

  // Live browser context (FR-W010 to FR-W014); Core sees only real changes.
  let controller: ThemeController | undefined;
  const source = createContextSource(
    target,
    { sizeClass: options.sizeClass, textScale: options.textScale ?? 1, locale: options.locale ?? "en" },
    (next) => controller?.setContext(next),
  );

  // Preferences (FR-W020 to FR-W022): the stored document is read synchronously so the first
  // resolution uses it. With a synchronous read done, Core's own asynchronous read is not needed,
  // so an absent or failed read passes an empty initial document.
  const store = options.store === false ? undefined : (options.store ?? createBrowserStore());
  let initial = options.initial;
  const readInitial = (store as { readInitial?: unknown } | undefined)?.readInitial;
  if (initial === undefined && store && typeof readInitial === "function") {
    try {
      initial = (readInitial.call(store, scope) as string | null) ?? "";
    } catch {
      initial = "";
      adapterErrors.push({
        kind: "store-read-failed",
        operation: "web.attachTheme",
        message: "The preference store failed to read.",
        hint: "Check the storage; resolution continued without stored data.",
        docs: "https://opentheme.org/core/errors/store-read-failed",
      });
    }
  }
  try {
    controller = core.createController({
      policy: options.policy,
      context: source.context,
      scope,
      ...(store ? { store } : {}),
      ...(initial !== undefined ? { initial } : {}),
    });
  } catch (e) {
    source.dispose();
    release();
    throw e;
  }
  const ctl = controller;

  apply(ctl.current.resolved);
  const unsubscribe = ctl.subscribe((result) => apply(result.resolved));

  let attached = true;
  function release(): void {
    element?.remove();
    if (!root) target.removeAttribute(ATTR);
    managed.delete(hostElement);
    if (element) managed.delete(element);
  }

  return Object.freeze({
    controller: ctl,
    get report() {
      return report;
    },
    get errors() {
      return Object.freeze([...adapterErrors, ...ctl.errors]);
    },
    setSizeClass(sizeClass: SizeClass) {
      if (!SIZE_CLASSES.has(sizeClass)) {
        throw new OpenThemeWebError("invalid-argument", "web.setSizeClass", "sizeClass must be compact, medium, or expanded.");
      }
      if (attached) source.setInputs({ sizeClass });
    },
    setTextScale(textScale: number) {
      if (!validScale(textScale)) throw new OpenThemeWebError("invalid-argument", "web.setTextScale", "textScale must be a positive number.");
      if (attached) source.setInputs({ textScale });
    },
    detach() {
      if (!attached) return;
      attached = false;
      unsubscribe();
      source.dispose();
      ctl.dispose();
      release();
    },
  });
}
