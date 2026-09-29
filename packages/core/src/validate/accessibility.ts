/**
 * Per-mode validation (chapter 04 "Validation evaluates every derivation in every declared mode";
 * chapter 11): high-contrast pairs (OT-A11Y-002), focus visibility (OT-A11Y-005), token-valued
 * operands outside their domain (OT-DRV-004), and the effort budget (OT-DRV-007).
 * Standard-mode pair shortfalls are reported by resolution, not by validity (FR-064).
 */
import { contrastRatio, quantize } from "../color/index.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { declareBase, evaluate, hasAliasedDomainOperand, type HostTokenDef, refsOf, staticEffort } from "../engine/evaluate.js";
import { buildModel, isRecord } from "../engine/model.js";
import { BASELINE_PAIRS, EFFORT_BUDGET, type TokenType } from "../engine/registry.js";
import { colorLiteral } from "../engine/values.js";
import { hostTokenTypes } from "./theme.js";
import { Prepared } from "../resolve/prepare.js";

export const THRESHOLDS = {
  standard: { text: 4.5, "large-text": 3, "non-text": 3 },
  high: { text: 7, "large-text": 4.5, "non-text": 3 },
} as const;

/**
 * Chapter 11, focus visibility (finding C5): a literal color with alpha 0 given to the focus role
 * `color.focus`, in `tokens` or in a context overlay, is OT-A11Y-005 at that member.
 */
function focusLiterals(doc: Readonly<Record<string, unknown>>, c: DiagnosticCollector): void {
  const check = (tokens: unknown, base: string) => {
    if (!isRecord(tokens) || !isRecord(tokens.color) || !isRecord(tokens.color.focus)) return;
    const v = tokens.color.focus.$value;
    if (isRecord(v) && v.alpha === 0) c.add("OT-A11Y-005", { document: "theme", pointer: `${base}/color/focus/$value` });
  };
  check(doc.tokens, "/tokens");
  if (Array.isArray(doc.contexts)) doc.contexts.forEach((o, i) => isRecord(o) && check(o.tokens, `/contexts/${i}/tokens`));
}

export function hostTokenDefs(host: Readonly<Record<string, unknown>> | null): HostTokenDef[] {
  if (!host || typeof host.id !== "string" || !isRecord(host.tokens)) return [];
  const out: HostTokenDef[] = [];
  const types = hostTokenTypes(host);
  const walk = (node: Record<string, unknown>, parts: string[]) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$") || !isRecord(v)) continue;
      const path = `${host.id}/${[...parts, k].join(".")}`;
      if ("$value" in v || "$derive" in v) {
        out.push({ path, type: (types.get(path) ?? "color") as TokenType, default: "$derive" in v ? { $derive: v.$derive } : v.$value });
      } else walk(v, [...parts, k]);
    }
  };
  walk(host.tokens, []);
  return out;
}

/**
 * Evaluates what the per-mode checks read: the registry pairs' tokens and every declaration that
 * can report OT-DRV-004, with their dependencies. A value depends only on its dependencies, so
 * these values equal a full evaluation's. The effort budget (OT-DRV-007) is checked from the
 * static total; when it would be exceeded, the evaluation is full, because only then does the
 * evaluation order decide which findings are reported.
 */
function evaluateNeeded(decls: ReturnType<typeof declareBase>): ReturnType<typeof evaluate> {
  if (staticEffort(decls) > EFFORT_BUDGET) return evaluate(decls, "validate");
  const needed = new Set<string>();
  const pending: string[] = [];
  const need = (p: string) => {
    if (!needed.has(p) && decls.has(p)) {
      needed.add(p);
      pending.push(p);
    }
  };
  for (const pair of BASELINE_PAIRS) {
    need(pair.foreground);
    need(pair.background);
  }
  for (const [p, d] of decls) if (hasAliasedDomainOperand(d.raw)) need(p);
  while (pending.length > 0) for (const r of refsOf(decls.get(pending.pop()!)!.raw)) need(r);
  const subset = new Map<string, NonNullable<ReturnType<typeof decls.get>>>();
  for (const [p, d] of decls) if (needed.has(p)) subset.set(p, d);
  return evaluate(subset, "validate");
}

type ModeEvaluation = { readonly decls: ReturnType<typeof declareBase>; readonly result: ReturnType<typeof evaluate> };

/**
 * One mode's declarations and evaluation (standard motion and density, the medium size class).
 * Validation and the conformance report evaluate the same modes; with `prepared`, results for a
 * frozen document under a frozen host are shared (pure functions of those inputs).
 */
function modeEvaluation(
  doc: Readonly<Record<string, unknown>>,
  model: ReturnType<typeof buildModel>,
  host: Readonly<Record<string, unknown>> | null,
  scheme: string,
  contrast: "standard" | "high",
  prepared: Prepared | undefined,
): ModeEvaluation {
  const compute = (): ModeEvaluation => {
    const decls = declareBase(model, { colorScheme: scheme, contrast, motion: "standard", density: "standard", sizeClass: "medium" }, hostTokenDefs(host));
    return { decls, result: evaluateNeeded(decls) };
  };
  const base = prepared ? Prepared.key(doc, host) : null;
  if (!prepared || base === null) return compute();
  const key = `${base}|${scheme}|${contrast}`;
  const hit = prepared.modes.get(key) as ModeEvaluation | undefined;
  if (hit) return hit;
  const value = compute();
  prepared.modes.set(key, value);
  return value;
}

export function checkAccessibility(
  doc: Readonly<Record<string, unknown>>,
  host: Readonly<Record<string, unknown>> | null,
  c: DiagnosticCollector,
  prepared?: Prepared,
): void {
  focusLiterals(doc, c);
  const model = buildModel(doc);
  for (const scheme of model.supportedSchemes) {
    for (const contrast of ["standard", "high"] as const) {
      const { decls, result } = modeEvaluation(doc, model, host, scheme, contrast, prepared);
      for (const issue of result.issues) {
        if (issue.code === "OT-DRV-007") c.add("OT-DRV-007", { document: "theme", pointer: "/tokens" });
        else if (issue.code === "OT-DRV-004" && issue.document === "theme") c.add("OT-DRV-004", { document: "theme", pointer: issue.pointer });
      }
      if (contrast !== "high") continue;
      for (const pair of BASELINE_PAIRS) {
        if (pair.kind === "disabled") continue;
        const fg = result.values.get(pair.foreground);
        const bg = result.values.get(pair.background);
        if (!fg || !bg || fg.k !== "color" || bg.k !== "color") continue;
        const ratio = contrastRatio(quantize(fg.lab), quantize(bg.lab));
        if (ratio < THRESHOLDS.high[pair.kind]) {
          const d = decls.get(pair.foreground);
          const pointer = d && d.document === "theme" && d.pointer ? d.pointer : `/seeds/${scheme}`;
          c.add("OT-A11Y-002", { document: "theme", pointer }, { params: { detail: `${pair.foreground}/${pair.background}` } });
        }
      }
    }
  }
}

/**
 * The accessibility conformance report (chapter 11, "Accessibility conformance report"; FR-064),
 * separate from validity: in the standard-contrast mode of every supported color scheme, each
 * registry pair except disabled pairs below its threshold is `OT-A11Y-003` (warning). Seed pairs
 * and high-contrast modes are validity checks (`OT-A11Y-001`, `OT-A11Y-002`) and are not repeated.
 * `doc` is a valid theme after inheritance.
 */
export function conformanceReport(
  doc: Readonly<Record<string, unknown>>,
  host: Readonly<Record<string, unknown>> | null,
  c: DiagnosticCollector,
  prepared?: Prepared,
): void {
  const model = buildModel(doc);
  for (const scheme of model.supportedSchemes) {
    const { decls, result } = modeEvaluation(doc, model, host, scheme, "standard", prepared);
    for (const pair of BASELINE_PAIRS) {
      if (pair.kind === "disabled") continue;
      const fg = result.values.get(pair.foreground);
      const bg = result.values.get(pair.background);
      if (!fg || !bg || fg.k !== "color" || bg.k !== "color") continue;
      if (contrastRatio(quantize(fg.lab), quantize(bg.lab)) >= THRESHOLDS.standard[pair.kind]) continue;
      const d = decls.get(pair.foreground);
      const pointer = d && d.document === "theme" && d.pointer ? d.pointer : `/seeds/${scheme}`;
      c.add("OT-A11Y-003", { document: "theme", pointer }, { params: { detail: `${pair.foreground}/${pair.background}` } });
    }
  }
}

export { colorLiteral };
