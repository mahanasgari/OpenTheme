/** Shared DOM test setup: a Core with the reference themes and a spy on CSSOM writes. */
import { createCore, type Core } from "@opentheme/core";
import { vi } from "vitest";
import { AURORA, GRAPHITE, NOTES_HOST, read } from "../helpers.js";

export function referenceCore(): Core {
  const core = createCore();
  for (const path of [AURORA, GRAPHITE]) core.registry.admit({ kind: "theme", bytes: read(path), trust: "trusted" });
  core.registry.admit({ kind: "host", bytes: read(NOTES_HOST), trust: "trusted" });
  return core;
}

export const AURORA_POLICY = { preset: "closed", defaultTheme: "org.opentheme.aurora" } as const;

/** Counts setProperty and removeProperty calls on one scope's rule. */
export function spyWrites(scope: string) {
  const style = ruleOf(scope)!.style;
  const set = vi.spyOn(style, "setProperty");
  const remove = vi.spyOn(style, "removeProperty");
  return {
    get set() {
      return set.mock.calls.length;
    },
    get removed() {
      return remove.mock.calls.length;
    },
    reset() {
      set.mockClear();
      remove.mockClear();
    },
    restore() {
      set.mockRestore();
      remove.mockRestore();
    },
  };
}

export function reset(): void {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
}

export const ruleOf = (scope: string): CSSStyleRule | undefined =>
  document.querySelector<HTMLStyleElement>(`style[data-opentheme-scope="${scope}"]`)?.sheet?.cssRules[0] as CSSStyleRule | undefined;
