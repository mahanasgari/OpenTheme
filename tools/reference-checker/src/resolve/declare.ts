import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EffectiveContext } from "./context.js";
import { flattenTokens } from "../tokens/graph.js";

export type Declaration = {
  path: string;
  type: string;
  /** Raw value: literal, alias string, or { $derive: ... } */
  value: unknown;
  source: "specification" | "theme" | "overlay" | "seed";
  /** Location of the declaring member in the theme document, when the theme declares it. */
  pointer?: string;
  /** The `input` pointer of the user preference that set this value, when one did. */
  user?: string;
};

interface BaselineEntry {
  path: string;
  type: string;
  default: unknown;
  highContrastDefault?: unknown;
}

interface BaselineFile {
  tokens: BaselineEntry[];
}

let baseline: BaselineEntry[] | undefined;

function loadBaseline(): BaselineEntry[] {
  if (baseline) return baseline;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/semantic-baseline.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as BaselineFile;
  baseline = data.tokens;
  return baseline;
}

function seedValues(
  theme: Record<string, unknown>,
  colorScheme: string,
): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const seeds = theme.seeds as Record<string, unknown> | undefined;
  if (!seeds) return out;
  const block = seeds[colorScheme] as Record<string, unknown> | undefined;
  if (block) {
    if (block.background !== undefined) out.set("seed.background", block.background);
    if (block.foreground !== undefined) out.set("seed.foreground", block.foreground);
    if (block.accent !== undefined) out.set("seed.accent", block.accent);
  }
  if (seeds.fontFamily !== undefined) {
    out.set("seed.font-family", seeds.fontFamily);
  }
  return out;
}

function overlaySpecificity(when: Record<string, unknown>): number {
  return Object.keys(when).length;
}

const DIM_PRIORITY = [
  "contrast",
  "colorScheme",
  "density",
  "sizeClass",
  "motion",
];

function overlayPriority(when: Record<string, unknown>): number {
  let best = 99;
  for (const [dim] of Object.entries(when)) {
    const idx = DIM_PRIORITY.indexOf(dim);
    if (idx >= 0 && idx < best) best = idx;
  }
  return best;
}

function overlayMatches(
  when: Record<string, unknown>,
  ctx: EffectiveContext,
): boolean {
  for (const [dim, val] of Object.entries(when)) {
    const actual =
      dim === "colorScheme"
        ? ctx.colorScheme === val || ctx.seedScheme === val
          ? val
          : ctx.colorScheme
        : dim === "contrast"
          ? ctx.contrast
          : dim === "motion"
            ? ctx.motion
            : dim === "density"
              ? ctx.density
              : dim === "sizeClass"
                ? ctx.sizeClass
                : undefined;
    if (dim === "colorScheme") {
      if (ctx.colorScheme !== val && ctx.seedScheme !== val) return false;
      continue;
    }
    if (actual !== val) return false;
  }
  return true;
}

function collectOverlayTokens(
  tree: Record<string, unknown>,
  prefix: string[] = [],
): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, raw] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const node = raw as Record<string, unknown>;
    const parts = [...prefix, key];
    const hasValue =
      Object.prototype.hasOwnProperty.call(node, "$value") ||
      Object.prototype.hasOwnProperty.call(node, "$derive");
    if (hasValue) {
      out.set(
        parts.join("."),
        Object.prototype.hasOwnProperty.call(node, "$derive")
          ? { $derive: node.$derive }
          : node.$value,
      );
    }
    for (const [p, v] of collectOverlayTokens(node, parts)) out.set(p, v);
  }
  return out;
}

/**
 * Build the winning declaration map for every baseline token (stages 1–2 of declare).
 * High-contrast sourcing: in high contrast, use highContrastDefault (or HC overlays),
 * never standard-contrast color declarations from non-HC overlays.
 */
export function declareTokens(
  theme: Record<string, unknown>,
  ctx: EffectiveContext,
  host?: Record<string, unknown> | null,
): Map<string, Declaration> {
  const decls = new Map<string, Declaration>();
  const seedScheme = ctx.seedScheme ?? ctx.colorScheme;
  const seeds = seedValues(theme, seedScheme);

  for (const [path, value] of seeds) {
    decls.set(path, {
      pointer:
        path === "seed.font-family"
          ? "/seeds/fontFamily"
          : `/seeds/${seedScheme}/${path.slice("seed.".length)}`,
      path,
      type:
        path === "seed.font-family"
          ? "fontFamily"
          : "color",
      value,
      source: "seed",
    });
  }

  for (const entry of loadBaseline()) {
    if (entry.path.startsWith("seed.")) continue;
    const useHc =
      ctx.contrast === "high" &&
      entry.highContrastDefault !== undefined &&
      entry.highContrastDefault !== null;
    const value = useHc ? entry.highContrastDefault : entry.default;
    if (value === null || value === undefined) continue;
    decls.set(entry.path, {
      path: entry.path,
      type: entry.type,
      value,
      source: "specification",
    });
  }

  // Theme token tree overrides.
  // High-contrast sourcing (R11): among color-typed values, only HC overlays
  // and HC defaults contribute — theme.tokens colors must not leak into HC.
  const tokens = theme.tokens;
  if (tokens && typeof tokens === "object" && !Array.isArray(tokens)) {
    const flat = flattenTokens(tokens as Record<string, unknown>);
    const hc = ctx.contrast === "high";
    for (const [path, node] of flat) {
      if (!node.isToken) continue;
      if (
        hc &&
        (node.type === "color" ||
          path.startsWith("color.") ||
          path.startsWith("seed."))
      ) {
        continue;
      }
      const raw = getRaw(tokens as Record<string, unknown>, path);
      if (!raw) continue;
      const value = Object.prototype.hasOwnProperty.call(raw, "$derive")
        ? { $derive: raw.$derive }
        : raw.$value;
      decls.set(path, {
        path,
        type: node.type ?? "color",
        value,
        source: "theme",
        pointer: `/tokens/${path.split(".").map(escapeSegment).join("/")}`,
      });
    }
  }

  // Overlays by ascending specificity, then dimension priority
  const contexts = theme.contexts;
  if (Array.isArray(contexts)) {
    type Scored = {
      index: number;
      when: Record<string, unknown>;
      tokens: Record<string, unknown>;
      spec: number;
      pri: number;
    };
    const scored: Scored[] = [];
    contexts.forEach((overlay, index) => {
      if (!overlay || typeof overlay !== "object") return;
      const o = overlay as {
        when?: Record<string, unknown>;
        tokens?: Record<string, unknown>;
      };
      if (!o.when || !o.tokens) return;
      if (!overlayMatches(o.when, ctx)) return;
      // HC sourcing: skip non-HC overlays for color when contrast is high
      if (
        ctx.contrast === "high" &&
        o.when.contrast !== "high"
      ) {
        // Still allow non-color tokens from non-HC overlays
        scored.push({
          index,
          when: o.when,
          tokens: filterNonColor(o.tokens),
          spec: overlaySpecificity(o.when),
          pri: overlayPriority(o.when),
        });
        return;
      }
      scored.push({
        index,
        when: o.when,
        tokens: o.tokens,
        spec: overlaySpecificity(o.when),
        pri: overlayPriority(o.when),
      });
    });
    scored.sort((a, b) => {
      if (a.spec !== b.spec) return a.spec - b.spec;
      if (a.pri !== b.pri) return a.pri - b.pri;
      return a.index - b.index;
    });
    for (const s of scored) {
      for (const [path, value] of collectOverlayTokens(s.tokens)) {
        const existing = decls.get(path);
        decls.set(path, {
          path,
          type: existing?.type ?? "color",
          value,
          source: "overlay",
          pointer: `/contexts/${s.index}/tokens/${path.split(".").map(escapeSegment).join("/")}`,
        });
      }
    }
  }

  // Host extension tokens — qualified as <host-id>/<local-path>
  if (host && typeof host.id === "string" && host.tokens) {
    const hostId = host.id;
    const hostTokens = host.tokens;
    if (typeof hostTokens === "object" && !Array.isArray(hostTokens)) {
      const flat = flattenTokens(hostTokens as Record<string, unknown>);
      for (const [localPath, node] of flat) {
        if (!node.isToken) continue;
        const raw = getRaw(hostTokens as Record<string, unknown>, localPath);
        if (!raw) continue;
        const value = Object.prototype.hasOwnProperty.call(raw, "$derive")
          ? { $derive: raw.$derive }
          : raw.$value;
        const path = `${hostId}/${localPath}`;
        decls.set(path, {
          path,
          type: node.type ?? "color",
          value,
          source: "theme",
        });
      }
    }
  }

  return decls;
}

function filterNonColor(
  tree: Record<string, unknown>,
): Record<string, unknown> {
  // For foundational HC rule: drop color.* from non-HC overlays by returning
  // a shallow copy without the color group.
  const out: Record<string, unknown> = { ...tree };
  delete out.color;
  return out;
}

function getRaw(
  tree: Record<string, unknown>,
  path: string,
): Record<string, unknown> | undefined {
  let cur: unknown = tree;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
  return cur as Record<string, unknown>;
}

/**
 * Overlays that apply in `ctx`, in application order: ascending specificity, then dimension
 * priority (contrast > colorScheme > density > sizeClass > motion), then document index.
 */
export function applicableOverlays(
  theme: Record<string, unknown>,
  ctx: EffectiveContext,
): Record<string, unknown>[] {
  const contexts = theme.contexts;
  if (!Array.isArray(contexts)) return [];
  const scored: { o: Record<string, unknown>; index: number; spec: number; pri: number }[] = [];
  contexts.forEach((overlay, index) => {
    if (!overlay || typeof overlay !== "object") return;
    const o = overlay as Record<string, unknown>;
    const when = o.when as Record<string, unknown> | undefined;
    if (!when || !overlayMatches(when, ctx)) return;
    scored.push({ o, index, spec: overlaySpecificity(when), pri: overlayPriority(when) });
  });
  scored.sort((a, b) => a.spec - b.spec || a.pri - b.pri || a.index - b.index);
  return scored.map((s) => s.o);
}

function escapeSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
