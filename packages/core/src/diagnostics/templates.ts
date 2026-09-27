/**
 * Optional English message and hint templates (FR-C086; task T114), generated from the diagnostic
 * registry. A separate entry point (`@opentheme/core/templates`), so hosts that localize by code
 * do not ship it; it is excluded from the size budget.
 *
 * Rendering (non-normative, Core's own convention): each `{name}` placeholder becomes
 * `: <value>` when the diagnostic has that parameter (arrays joined with ", "), and is removed
 * otherwise. Parameter values are grammar-constrained, never untrusted free text (FR-071).
 */
import { englishTemplates } from "../generated/templates.js";
import type { Diagnostic } from "./collector.js";

export { englishTemplates };

function fill(template: string, params: Diagnostic["params"]): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_m, name: string) => {
    const v = params[name];
    if (v === undefined) return "";
    return `: ${Array.isArray(v) ? v.join(", ") : String(v)}`;
  });
}

/** The English message and hint for a diagnostic, or `undefined` for an unknown code. */
export function formatDiagnostic(d: Pick<Diagnostic, "code" | "params">): { message: string; hint: string } | undefined {
  const t = englishTemplates[d.code];
  if (!t) return undefined;
  return { message: fill(t.message, d.params), hint: fill(t.hint, d.params) };
}
