/**
 * Platform post-process (FR-020, FR-028, FR-054, FR-077): forced colors,
 * reduced motion, text scaling, RTL mirroring.
 *
 * Normative order (resolution contract / R12): post-process, then quantize.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EffectiveContext } from "./context.js";
import type { ConcreteValue } from "./evaluate.js";
import type { DiagnosticCollector } from "../diagnostics/collector.js";

export type PostValue =
  | ConcreteValue
  | { kind: "system"; role: string };

interface BaselineEntry {
  path: string;
  type: string;
  forcedColor?: string;
  reducedMotionDefault?: { value: number; unit: string };
}

interface BaselineFile {
  tokens: BaselineEntry[];
}

let baseline: BaselineEntry[] | undefined;
let forcedByPath: Map<string, string> | undefined;
let reducedByPath: Map<string, { value: number; unit: string }> | undefined;

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

export function forcedColorMap(): Map<string, string> {
  if (forcedByPath) return forcedByPath;
  forcedByPath = new Map();
  for (const t of loadBaseline()) {
    if (t.forcedColor) forcedByPath.set(t.path, t.forcedColor);
  }
  return forcedByPath;
}

function reducedMotionMap(): Map<string, { value: number; unit: string }> {
  if (reducedByPath) return reducedByPath;
  reducedByPath = new Map();
  for (const t of loadBaseline()) {
    if (t.reducedMotionDefault) {
      reducedByPath.set(t.path, t.reducedMotionDefault);
    }
  }
  return reducedByPath;
}

function isDim(v: PostValue): v is { kind: "dimension"; value: number; unit: "px" | "ms" } {
  return v.kind === "dimension";
}

function scaleTypographyOther(v: ConcreteValue, scale: number): ConcreteValue {
  if (v.kind !== "other" || !v.value || typeof v.value !== "object" || Array.isArray(v.value)) {
    return v;
  }
  const obj = { ...(v.value as Record<string, unknown>) };
  const fs = obj.fontSize;
  if (
    fs &&
    typeof fs === "object" &&
    typeof (fs as { value?: unknown }).value === "number" &&
    (fs as { unit?: string }).unit === "px"
  ) {
    obj.fontSize = {
      value: (fs as { value: number }).value * scale,
      unit: "px",
    };
  }
  const lh = obj.lineHeight;
  if (
    lh &&
    typeof lh === "object" &&
    typeof (lh as { value?: unknown }).value === "number" &&
    (lh as { unit?: string }).unit === "px"
  ) {
    obj.lineHeight = {
      value: (lh as { value: number }).value * scale,
      unit: "px",
    };
  }
  return { kind: "other", value: obj };
}

function mirrorPath(path: string): string | null {
  if (path.endsWith(".start")) return `${path.slice(0, -".start".length)}.end`;
  if (path.endsWith(".end")) return `${path.slice(0, -".end".length)}.start`;
  if (path.endsWith("-start")) return `${path.slice(0, -"-start".length)}-end`;
  if (path.endsWith("-end")) return `${path.slice(0, -"-end".length)}-start`;
  if (path.endsWith(".inline-start")) {
    return `${path.slice(0, -".inline-start".length)}.inline-end`;
  }
  if (path.endsWith(".inline-end")) {
    return `${path.slice(0, -".inline-end".length)}.inline-start`;
  }
  return null;
}

export interface PostprocessMeta {
  physicalPaths?: Set<string>;
  collector?: DiagnosticCollector;
}

const TARGET_FLOOR_PX = 24;

function isInteractiveSizePath(path: string): boolean {
  return (
    path === "size.target.min" ||
    path.startsWith("size.control.") ||
    path === "size.control.height.sm" ||
    path === "size.control.height.md" ||
    path === "size.control.height.lg"
  );
}

/**
 * Apply platform accessibility post-processing before quantization.
 */
export function postprocessValues(
  tokens: Map<string, ConcreteValue>,
  ctx: EffectiveContext,
  meta: PostprocessMeta = {},
): Map<string, PostValue> {
  let out: Map<string, PostValue> = new Map(tokens);

  if (ctx.motion === "reduced") {
    const reduced = reducedMotionMap();
    for (const [path, val] of reduced) {
      out.set(path, {
        kind: "dimension",
        value: val.value,
        unit: val.unit === "ms" ? "ms" : "px",
      });
    }
    for (const [path, val] of out) {
      if (
        path.startsWith("motion.duration.") &&
        isDim(val) &&
        !reduced.has(path)
      ) {
        out.set(path, { kind: "dimension", value: 0, unit: "ms" });
      }
    }
  }

  const scale = ctx.textScale;
  if (scale !== 1) {
    const scaled = new Map<string, PostValue>();
    for (const [path, val] of out) {
      if (isDim(val) && val.unit === "px" && path.includes("font")) {
        scaled.set(path, {
          kind: "dimension",
          value: val.value * scale,
          unit: "px",
        });
        continue;
      }
      if (val.kind === "other") {
        scaled.set(path, scaleTypographyOther(val, scale));
        continue;
      }
      scaled.set(path, val);
    }
    out = scaled;
  }

  {
    const floored = new Map(out);
    for (const [path, val] of out) {
      if (!isInteractiveSizePath(path)) continue;
      if (!isDim(val) || val.unit !== "px") continue;
      if (val.value < TARGET_FLOOR_PX) {
        floored.set(path, {
          kind: "dimension",
          value: TARGET_FLOOR_PX,
          unit: "px",
        });
        meta.collector?.add({
          code: "OT-A11Y-006",
          rule: "R-A11Y-006",
          location: {
            document: "theme",
            pointer: `/tokens/${path.replace(/\./g, "/")}`,
          },
          params: { detail: path },
          severity: "warning",
        });
      }
    }
    out = floored;
  }

  if (ctx.direction === "rtl") {
    const physical = meta.physicalPaths ?? new Set<string>();
    const swapped = new Map(out);
    const seen = new Set<string>();
    for (const path of out.keys()) {
      if (seen.has(path) || physical.has(path)) continue;
      const other = mirrorPath(path);
      if (!other || !out.has(other) || physical.has(other)) continue;
      seen.add(path);
      seen.add(other);
      const a = out.get(path)!;
      const b = out.get(other)!;
      swapped.set(path, b);
      swapped.set(other, a);
    }
    out = swapped;
  }

  if (ctx.forcedColors) {
    const roles = forcedColorMap();
    const forced = new Map<string, PostValue>();
    for (const [path, val] of out) {
      const role = roles.get(path);
      if (
        role &&
        (val.kind === "color" ||
          path.startsWith("color.") ||
          path.startsWith("seed."))
      ) {
        forced.set(path, { kind: "system", role });
      } else if (val.kind === "color" && path.startsWith("color.")) {
        forced.set(path, { kind: "system", role: role ?? "canvas-text" });
      } else {
        forced.set(path, val);
      }
    }
    for (const seedPath of [
      "seed.background",
      "seed.foreground",
      "seed.accent",
    ]) {
      const role = roles.get(seedPath);
      if (role && out.has(seedPath)) {
        forced.set(seedPath, { kind: "system", role });
      }
    }
    out = forced;
  }

  return out;
}

/** @deprecated Prefer postprocessValues (pre-quantize). */
export function postprocessTokens(
  tokens: Map<string, import("./quantize.js").ResolvedTokenValue>,
  _ctx: EffectiveContext,
  _meta: PostprocessMeta = {},
): Map<string, import("./quantize.js").ResolvedTokenValue> {
  return tokens;
}

/** @deprecated Use postprocessValues. Kept for call-site compatibility. */
export function postprocess<T>(value: T): T {
  return value;
}

/**
 * RFC 4647 lookup for localized display text.
 */
export function lookupDisplayText(
  theme: Record<string, unknown>,
  locale: string,
): { name: string; description?: string } {
  const defaultName =
    typeof theme.name === "string" ? theme.name : String(theme.id ?? "");
  const defaultDescription =
    typeof theme.description === "string" ? theme.description : undefined;
  const localized = theme.localized as
    | Record<string, { name?: string; description?: string }>
    | undefined;
  if (!localized || typeof localized !== "object") {
    const out: { name: string; description?: string } = { name: defaultName };
    if (defaultDescription !== undefined) out.description = defaultDescription;
    return out;
  }

  const tags: string[] = [];
  let tag = locale;
  while (tag) {
    tags.push(tag);
    const i = tag.lastIndexOf("-");
    if (i <= 0) break;
    tag = tag.slice(0, i);
  }

  for (const t of tags) {
    const entry = localized[t];
    if (!entry) continue;
    const name = typeof entry.name === "string" ? entry.name : defaultName;
    const description =
      typeof entry.description === "string"
        ? entry.description
        : defaultDescription;
    const out: { name: string; description?: string } = { name };
    if (description !== undefined) out.description = description;
    return out;
  }

  const out: { name: string; description?: string } = { name: defaultName };
  if (defaultDescription !== undefined) out.description = defaultDescription;
  return out;
}
