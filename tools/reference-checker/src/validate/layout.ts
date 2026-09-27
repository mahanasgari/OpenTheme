/**
 * Theme layout member validation and variant selection (FR-035…FR-039).
 */
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import type { EffectiveContext } from "../resolve/context.js";

export interface HostLayoutVariants {
  [region: string]: { variants: string[]; default: string };
}

/**
 * Validate theme `layout` against a host's layoutVariants (when provided).
 * Also rejects forbidden content-changing members on layout objects.
 */
export function validateLayout(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
  host?: Record<string, unknown> | null,
): void {
  const layout = doc.layout as
    | { variants?: Record<string, unknown> }
    | undefined;
  if (!layout) return;

  // Forbidden content-change members anywhere under layout
  const forbidden = ["hidden", "order", "insert"];
  const walk = (node: unknown, pointer: string): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (forbidden.includes(k)) {
        collector.add({
          code: "OT-DOC-003",
          rule: "R-DOC-003",
          location: { document: "theme", pointer: `${pointer}/${k}` },
          params: { detail: k },
        });
      }
      walk(v, `${pointer}/${k}`);
    }
  };
  walk(layout, "/layout");

  const variants = layout.variants;
  if (!variants || typeof variants !== "object") return;

  const hostLV = (host?.layoutVariants ?? {}) as HostLayoutVariants;

  for (const [region, sel] of Object.entries(variants)) {
    const declared = hostLV[region];
    if (host && !declared) {
      collector.add({
        code: "OT-LAY-001",
        rule: "R-LAY-001",
        location: {
          document: "theme",
          pointer: `/layout/variants/${region}`,
        },
        params: { detail: region },
      });
      continue;
    }
    const allowed = new Set(declared?.variants ?? []);
    const checkName = (name: string, pointer: string): void => {
      if (declared && !allowed.has(name)) {
        collector.add({
          code: "OT-LAY-001",
          rule: "R-LAY-001",
          location: { document: "theme", pointer },
          params: { detail: name },
        });
      }
    };
    if (typeof sel === "string") {
      checkName(sel, `/layout/variants/${region}`);
    } else if (sel && typeof sel === "object" && !Array.isArray(sel)) {
      for (const [sc, name] of Object.entries(sel as Record<string, unknown>)) {
        if (typeof name === "string") {
          checkName(name, `/layout/variants/${region}/${sc}`);
        }
      }
    }
  }

  // FR-039: narrowest size class reflow budget (320 px)
  // Themes that declare layout.metrics with min/fixed widths + gutters > 320 → LAY-002
  const metrics = (layout as { metrics?: unknown }).metrics;
  if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
    const m = metrics as {
      minWidths?: number[];
      fixedWidths?: number[];
      gutters?: number[];
    };
    const sum =
      (m.minWidths ?? []).reduce((a, b) => a + b, 0) +
      (m.fixedWidths ?? []).reduce((a, b) => a + b, 0) +
      (m.gutters ?? []).reduce((a, b) => a + b, 0);
    if (sum > 320) {
      collector.add({
        code: "OT-LAY-002",
        rule: "R-LAY-002",
        location: { document: "theme", pointer: "/layout/metrics" },
        params: { detail: String(sum) },
      });
    }
  }
}

/**
 * Resolve effective layout variant names for the active size class.
 */
export function selectLayoutVariants(
  theme: Record<string, unknown>,
  ctx: EffectiveContext,
  host?: Record<string, unknown> | null,
  report?: (pointer: string) => void,
): Record<string, string> {
  const out: Record<string, string> = {};
  const hostLV = (host?.layoutVariants ?? {}) as HostLayoutVariants;
  const themeLayout = theme.layout as
    | { variants?: Record<string, unknown> }
    | undefined;
  const selections = themeLayout?.variants ?? {};

  const regions = new Set([
    ...Object.keys(hostLV),
    ...Object.keys(selections),
  ]);

  for (const region of regions) {
    const declared = hostLV[region];
    const sel = selections[region];
    let name: string | undefined;
    if (typeof sel === "string") {
      name = sel;
    } else if (sel && typeof sel === "object" && !Array.isArray(sel)) {
      const map = sel as Record<string, string>;
      name =
        map[ctx.sizeClass] ??
        map.expanded ??
        map.medium ??
        map.compact;
    }
    // Chapter 08: with a host, only declared regions and variants apply (finding F29).
    if (name && host && (!declared || !(declared.variants ?? []).includes(name))) {
      report?.(`/layout/variants/${region}`);
      name = undefined;
    }
    if (!name && declared) {
      name = declared.default;
    }
    if (name) out[region] = name;
  }
  return out;
}
