/**
 * Browser context (data-model §4; research WR5; FR-W010 to FR-W014).
 *
 * The four media features and the nearest `lang` and `dir` attributes are observed live; the size
 * class and text scale come from the host. The source keeps the last context it produced and
 * reports a change only when some field differs. Nothing is guessed: an unavailable feature takes
 * the default Core documents, and a `lang` value that is not a BCP 47 tag shape is not used.
 */
import type { ControllerContext } from "@opentheme/core";

export type SizeClass = "compact" | "medium" | "expanded";

export interface ContextInputs {
  readonly sizeClass: SizeClass;
  readonly textScale: number;
  /** Used when no usable `lang` attribute applies. */
  readonly locale: string;
}

export interface ContextSource {
  readonly context: ControllerContext;
  setInputs(inputs: Partial<ContextInputs>): void;
  dispose(): void;
}

const BCP47 = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const QUERIES = {
  dark: "(prefers-color-scheme: dark)",
  light: "(prefers-color-scheme: light)",
  more: "(prefers-contrast: more)",
  forced: "(forced-colors: active)",
  reduce: "(prefers-reduced-motion: reduce)",
} as const;

function same(a: ControllerContext, b: ControllerContext): boolean {
  const p = a.platform;
  const q = b.platform;
  const e = a.environment;
  const f = b.environment;
  return (
    p.colorScheme === q.colorScheme &&
    p.contrast === q.contrast &&
    p.forcedColors === q.forcedColors &&
    p.reducedMotion === q.reducedMotion &&
    p.textScale === q.textScale &&
    e.sizeClass === f.sizeClass &&
    e.locale === f.locale &&
    e.direction === f.direction
  );
}

export function createContextSource(
  target: Document | Element,
  initial: ContextInputs,
  onChange: (context: ControllerContext) => void,
): ContextSource {
  const doc = target.nodeType === 9 ? (target as Document) : (target as Element).ownerDocument;
  const scopeElement = target.nodeType === 9 ? doc.documentElement : (target as Element);
  const view = doc.defaultView;
  let inputs = { ...initial };

  const lists = new Map<keyof typeof QUERIES, MediaQueryList>();
  if (view && typeof view.matchMedia === "function") {
    for (const [key, query] of Object.entries(QUERIES) as [keyof typeof QUERIES, string][]) lists.set(key, view.matchMedia(query));
  }
  const matches = (key: keyof typeof QUERIES) => lists.get(key)?.matches === true;

  const compute = (): ControllerContext => {
    const lang = scopeElement.closest("[lang]")?.getAttribute("lang") ?? "";
    const dir = scopeElement.closest("[dir]")?.getAttribute("dir")?.toLowerCase();
    return {
      platform: {
        colorScheme: matches("dark") ? "dark" : matches("light") ? "light" : "no-preference",
        contrast: matches("more") ? "high" : "standard",
        forcedColors: matches("forced"),
        reducedMotion: matches("reduce"),
        textScale: inputs.textScale,
      },
      environment: {
        sizeClass: inputs.sizeClass,
        locale: lang.length <= 64 && BCP47.test(lang) ? lang : inputs.locale,
        direction: dir === "rtl" ? "rtl" : "ltr",
      },
    };
  };

  let last = compute();
  const refresh = () => {
    const next = compute();
    if (same(next, last)) return;
    last = next;
    onChange(next);
  };

  for (const list of lists.values()) list.addEventListener("change", refresh);
  const MO = view?.MutationObserver;
  const observer = MO ? new MO(refresh) : null;
  observer?.observe(doc.documentElement, { attributes: true, attributeFilter: ["lang", "dir"], subtree: true });

  return {
    get context() {
      return last;
    },
    setInputs(next) {
      inputs = { ...inputs, ...next };
      refresh();
    },
    dispose() {
      for (const list of lists.values()) list.removeEventListener("change", refresh);
      observer?.disconnect();
    },
  };
}

/** Width thresholds 600 px and 1024 px (data-model §4). */
export function sizeClassForWidth(widthPx: number): SizeClass {
  return widthPx < 600 ? "compact" : widthPx < 1024 ? "medium" : "expanded";
}

/** The root font size relative to 16 px, or 1 when unavailable. */
export function textScaleFromRoot(document: Document): number {
  const view = document.defaultView;
  const size = view ? Number.parseFloat(view.getComputedStyle(document.documentElement).fontSize) : Number.NaN;
  return Number.isFinite(size) && size > 0 ? size / 16 : 1;
}
