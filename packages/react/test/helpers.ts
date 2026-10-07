import { createCore, type Core, type PolicyInput } from "@opentheme/core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

export const AURORA = "specification/themes/reference/org.opentheme.aurora.opentheme.json";
export const GRAPHITE = "specification/themes/reference/org.opentheme.graphite.opentheme.json";

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
