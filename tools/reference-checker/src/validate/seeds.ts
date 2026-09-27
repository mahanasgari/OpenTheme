import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { oklchToOklab } from "../color/oklch.js";
import { gamutMap } from "../color/gamut.js";
import { oklabToSrgbRaw } from "../color/oklab.js";
import { quantizeSrgb } from "../color/quantize.js";
import { contrastRatio } from "../color/contrast.js";

type ColorLiteral = {
  colorSpace: string;
  components: number[];
  alpha?: number;
};

function isColorLiteral(v: unknown): v is ColorLiteral {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as ColorLiteral).colorSpace === "string" &&
    Array.isArray((v as ColorLiteral).components)
  );
}

function toQuantizedSrgb(c: ColorLiteral) {
  const alpha = c.alpha ?? 1;
  if (c.colorSpace === "srgb") {
    return quantizeSrgb({
      r: c.components[0] ?? 0,
      g: c.components[1] ?? 0,
      b: c.components[2] ?? 0,
      alpha,
    });
  }
  if (c.colorSpace === "oklch") {
    const lab = oklchToOklab({
      L: c.components[0] ?? 0,
      C: c.components[1] ?? 0,
      H: c.components[2] ?? 0,
      alpha,
    });
    return quantizeSrgb(oklabToSrgbRaw(gamutMap(lab)));
  }
  // Fallback: treat as srgb
  return quantizeSrgb({
    r: c.components[0] ?? 0,
    g: c.components[1] ?? 0,
    b: c.components[2] ?? 0,
    alpha,
  });
}

const SEED_KEYS = ["background", "foreground", "accent"] as const;

export function validateSeeds(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  const schemes = doc.colorSchemes as
    | {
        supported?: string[];
        default?: string;
        variants?: Record<string, { fallback?: string }>;
      }
    | undefined;
  const seeds = doc.seeds as Record<string, unknown> | undefined;
  if (!schemes?.supported || !seeds) return;

  for (const scheme of schemes.supported) {
    const variants = schemes.variants as
      | Record<string, { fallback?: string }>
      | undefined;
    const fallback = variants?.[scheme]?.fallback;
    const seedKey =
      seeds[scheme] !== undefined
        ? scheme
        : typeof fallback === "string"
          ? fallback
          : scheme;
    const block = seeds[seedKey];
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      collector.add({
        code: "OT-TOK-010",
        rule: "R-TOK-010",
        location: { document: "theme", pointer: `/seeds/${scheme}` },
        params: { scheme },
      });
      continue;
    }
    const colors = block as Record<string, unknown>;
    for (const key of SEED_KEYS) {
      if (!isColorLiteral(colors[key])) {
        collector.add({
          code: "OT-TOK-010",
          rule: "R-TOK-010",
          location: {
            document: "theme",
            pointer: `/seeds/${scheme}/${key}`,
          },
          params: { scheme, seed: key },
        });
        continue;
      }
      const alpha = colors[key].alpha ?? 1;
      if (alpha < 1) {
        collector.add({
          code: "OT-TOK-011",
          rule: "R-TOK-011",
          location: {
            document: "theme",
            pointer: `/seeds/${scheme}/${key}`,
          },
          params: { scheme, seed: key },
        });
      }
    }

    const bg = colors.background;
    const fg = colors.foreground;
    if (isColorLiteral(bg) && isColorLiteral(fg)) {
      const qBg = toQuantizedSrgb(bg);
      const qFg = toQuantizedSrgb(fg);
      if (contrastRatio(qFg, qBg) < 4.5) {
        collector.add({
          code: "OT-A11Y-001",
          rule: "R-A11Y-001",
          location: {
            document: "theme",
            pointer: `/seeds/${scheme}/foreground`,
          },
          related: [
            {
              document: "theme",
              pointer: `/seeds/${scheme}/background`,
            },
            {
              document: "theme",
              pointer: `/seeds/${scheme}/foreground`,
            },
          ],
          params: { scheme },
        });
      }
    }
  }

  // supported schemes without seed blocks are diagnosed above.
}
