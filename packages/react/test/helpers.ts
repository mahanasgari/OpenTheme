import { createCore, type Core, type PolicyInput, type ThemeController } from "@opentheme/core";
import { attachTheme, type SizeClass } from "@opentheme/web";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

export const AURORA = "specification/themes/reference/org.opentheme.aurora.opentheme.json";
export const GRAPHITE = "specification/themes/reference/org.opentheme.graphite.opentheme.json";

export const LIGHT_CONTEXT = {
  platform: { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
  environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
} as const;

export const POLICY: PolicyInput = { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" };

export function referenceCore(): Core {
  const core = createCore();
  for (const path of [AURORA, GRAPHITE]) core.registry.admit({ kind: "theme", bytes: read(path), trust: "trusted" });
  return core;
}

export const ruleOf = (scope: string): CSSStyleRule | undefined =>
  document.querySelector<HTMLStyleElement>(`style[data-opentheme-scope="${scope}"]`)?.sheet?.cssRules[0] as CSSStyleRule | undefined;

/** The declarations of a scope's rule, by custom-property name. */
export function declarationsOf(scope: string): Record<string, string> {
  const style = ruleOf(scope)?.style;
  const out: Record<string, string> = {};
  if (!style) return out;
  for (let i = 0; i < style.length; i += 1) {
    const name = style.item(i);
    out[name] = style.getPropertyValue(name).trim();
  }
  return out;
}

export function reset(): void {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  localStorage.clear();
}

// ---- React and Core harness ----

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  root: Root;
  host: HTMLElement;
  rerender(ui: ReactNode): void;
  unmount(): void;
}

const mounted: Mounted[] = [];

export function mount(ui: ReactNode): Mounted {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(ui));
  const m: Mounted = {
    root,
    host,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
  mounted.push(m);
  return m;
}

/** Unmounts everything and clears the document; call from afterEach. */
export function cleanup(): void {
  for (const m of mounted.splice(0)) {
    try {
      m.unmount();
    } catch {
      // already unmounted
    }
  }
  reset();
}

/** A Core whose controllers are recorded, so tests can reach the controller a provider created. */
export function observed(core: Core): { core: Core; controllers: ThemeController[]; policyCalls: PolicyInput[] } {
  const controllers: ThemeController[] = [];
  const policyCalls: PolicyInput[] = [];
  // Core is frozen, so wrap it in a plain object that records what createController returns.
  const wrapped: Core = {
    ...core,
    createController(options) {
      const inner = core.createController(options);
      // Controllers are frozen; a derived object records setPolicy calls and forwards everything else.
      const controller: ThemeController = Object.create(inner, {
        setPolicy: {
          value: (policy: PolicyInput) => {
            policyCalls.push(policy);
            inner.setPolicy(policy);
          },
        },
      });
      controllers.push(controller);
      return controller;
    },
  };
  return { core: wrapped, controllers, policyCalls };
}

/** What `attachTheme` itself applies for these inputs (detached again before returning). */
export function referenceDeclarations(options: {
  core: Core;
  policy: PolicyInput;
  sizeClass?: SizeClass;
  textScale?: number;
  scope?: string;
}): Record<string, string> {
  const scope = options.scope ?? "ref";
  const s = attachTheme({
    core: options.core,
    target: document,
    scope,
    policy: options.policy,
    sizeClass: options.sizeClass ?? "medium",
    ...(options.textScale !== undefined ? { textScale: options.textScale } : {}),
    store: false,
  });
  const out = declarationsOf(scope);
  s.detach();
  return out;
}
