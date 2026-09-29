import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { contrastRatio } from "../color/contrast.js";
import { declareTokens } from "../resolve/declare.js";
import { evaluateDeclarations } from "../resolve/evaluate.js";
import { quantizeValue } from "../resolve/quantize.js";
import { loadAccessibilityPairs, thresholdForPair } from "../resolve/check.js";
import type { EffectiveContext } from "../resolve/context.js";
import { getTransform } from "../transforms/registry.js";
import { inDomain } from "../transforms/number.js";
import { parseAlias } from "../tokens/paths.js";

/**
 * Accessibility checks (validation step 12): focus alpha (OT-A11Y-005) and high-contrast mode
 * pairs (OT-A11Y-002). Declared-pair warnings are reported at resolution.
 */
export function validateAccessibility(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  checkFocusAlpha(doc.tokens, collector, "/tokens");
  if (Array.isArray(doc.contexts)) {
    doc.contexts.forEach((o, i) => {
      if (o && typeof o === "object") checkFocusAlpha((o as { tokens?: unknown }).tokens, collector, `/contexts/${i}/tokens`);
    });
  }
  checkModes(doc, collector);
}

/**
 * Chapter 11, focus visibility (finding C5): a literal color with alpha 0 given to the focus role
 * `color.focus` is OT-A11Y-005 at that member.
 */
function checkFocusAlpha(tokens: unknown, collector: DiagnosticCollector, base: string): void {
  const color = (tokens as { color?: { focus?: { $value?: unknown } } } | undefined)?.color;
  const value = color && typeof color === "object" ? color.focus?.$value : undefined;
  if (value && typeof value === "object" && (value as { alpha?: unknown }).alpha === 0) {
    collector.add({
      code: "OT-A11Y-005",
      rule: "R-A11Y-005",
      location: { document: "theme", pointer: `${base}/color/focus/$value` },
      params: { path: "color.focus" },
    });
  }
}

function srgb8(v: unknown): { r: number; g: number; b: number; alpha: number } | null {
  if (!v || typeof v !== "object" || !("srgb8" in v)) return null;
  const c = v as { srgb8: number[]; alpha: number };
  return { r: c.srgb8[0]! / 255, g: c.srgb8[1]! / 255, b: c.srgb8[2]! / 255, alpha: c.alpha };
}

/**
 * Per-mode validation (chapter 04: derivations are evaluated in every declared mode; chapter 11):
 * in each supported color scheme at standard and high contrast,
 * - a derivation operand that aliases a token whose value in that mode is outside the argument's
 *   domain is OT-DRV-004 at the operand (finding F27);
 * - in high contrast, every registry pair except disabled pairs below its high-contrast threshold
 *   is OT-A11Y-002, located at the theme member declaring the foreground, else at the scheme's
 *   seeds (finding F30).
 */
function checkModes(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  const cs = doc.colorSchemes as { supported?: unknown } | undefined;
  const schemes = Array.isArray(cs?.supported) ? (cs!.supported as string[]) : [];
  for (const scheme of schemes) {
    for (const contrast of ["standard", "high"] as const) {
      const ctx: EffectiveContext = {
        colorScheme: scheme,
        seedScheme: scheme,
        contrast,
        motion: "standard",
        density: "standard",
        sizeClass: "medium",
        textScale: 1,
        forcedColors: false,
        direction: "ltr",
        locale: "en",
      };
      const decls = declareTokens(doc, ctx);
      const { values } = evaluateDeclarations(decls);
      for (const d of decls.values()) {
        const raw = d.value as { $derive?: { op?: unknown; args?: Record<string, unknown> } } | null;
        if (!d.pointer || !raw || typeof raw !== "object" || !raw.$derive) continue;
        const def = getTransform(String(raw.$derive.op));
        const args = raw.$derive.args ?? {};
        for (const a of def?.arguments ?? []) {
          const target = parseAlias(args[a.name]);
          const v = target ? values.get(target) : undefined;
          if (!a.domain || v?.kind !== "number" || inDomain(v.value, a.domain)) continue;
          collector.add({
            code: "OT-DRV-004",
            rule: "R-DRV-004",
            location: { document: "theme", pointer: `${d.pointer}/$derive/args/${a.name}` },
            params: { detail: a.name },
          });
        }
      }
      if (contrast !== "high") continue;
      for (const pair of loadAccessibilityPairs()) {
        const threshold = thresholdForPair(pair.kind, "high");
        if (threshold === null) continue;
        const fgv = values.get(pair.foreground);
        const bgv = values.get(pair.background);
        if (fgv?.kind !== "color" || bgv?.kind !== "color") continue;
        const fg = srgb8(quantizeValue(fgv));
        const bg = srgb8(quantizeValue(bgv));
        if (!fg || !bg || contrastRatio(fg, bg) >= threshold) continue;
        collector.add({
          code: "OT-A11Y-002",
          rule: "R-A11Y-002",
          location: {
            document: "theme",
            pointer: decls.get(pair.foreground)?.pointer ?? `/seeds/${scheme}`,
          },
          params: { detail: `${pair.foreground}/${pair.background}` },
        });
      }
    }
  }
}

/**
 * The accessibility conformance report (chapter 11, "Accessibility conformance report"; FR-064;
 * finding F31), for a valid theme after inheritance. In the standard-contrast mode of each
 * supported color scheme (standard motion and density, the medium size class, no preferences),
 * every registry pair except disabled pairs below its standard threshold is OT-A11Y-003, located
 * at the theme member declaring the foreground, else at /seeds/<scheme>. Seed pairs and
 * high-contrast modes are validity checks and are not repeated here.
 */
export function accessibilityReport(
  doc: Record<string, unknown>,
  host: Record<string, unknown> | null,
  collector: DiagnosticCollector,
): void {
  const cs = doc.colorSchemes as { supported?: unknown } | undefined;
  const schemes = Array.isArray(cs?.supported) ? (cs!.supported as string[]) : [];
  for (const scheme of schemes) {
    const ctx: EffectiveContext = {
      colorScheme: scheme,
      seedScheme: scheme,
      contrast: "standard",
      motion: "standard",
      density: "standard",
      sizeClass: "medium",
      textScale: 1,
      forcedColors: false,
      direction: "ltr",
      locale: "en",
    };
    const decls = declareTokens(doc, ctx, host);
    const { values } = evaluateDeclarations(decls);
    for (const pair of loadAccessibilityPairs()) {
      const threshold = thresholdForPair(pair.kind, "standard");
      if (threshold === null) continue;
      const fgv = values.get(pair.foreground);
      const bgv = values.get(pair.background);
      if (fgv?.kind !== "color" || bgv?.kind !== "color") continue;
      const fg = srgb8(quantizeValue(fgv));
      const bg = srgb8(quantizeValue(bgv));
      if (!fg || !bg || contrastRatio(fg, bg) >= threshold) continue;
      collector.add({
        code: "OT-A11Y-003",
        rule: "R-A11Y-003",
        location: {
          document: "theme",
          pointer: decls.get(pair.foreground)?.pointer ?? `/seeds/${scheme}`,
        },
        params: { detail: `${pair.foreground}/${pair.background}` },
      });
    }
  }
}
