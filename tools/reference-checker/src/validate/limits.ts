/**
 * Resource limit checks (limits.json / OT-LIM-*).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { flattenTokens } from "../tokens/graph.js";
import { isValidPath, isValidSegment } from "../tokens/paths.js";

interface LimitEntry {
  value: number;
}

interface LimitsFile {
  limits: Record<string, LimitEntry>;
}

let cached: LimitsFile | undefined;

function loadLimits(): LimitsFile {
  if (cached) return cached;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/limits.json",
  );
  cached = JSON.parse(readFileSync(path, "utf8")) as LimitsFile;
  return cached;
}

function limit(name: string): number {
  return loadLimits().limits[name]?.value ?? Number.POSITIVE_INFINITY;
}

export function validateLimits(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  const tokens = doc.tokens;
  if (tokens && typeof tokens === "object" && !Array.isArray(tokens)) {
    const flat = flattenTokens(tokens as Record<string, unknown>);
    const tokenCount = [...flat.values()].filter((n) => n.isToken).length;
    if (tokenCount > limit("tokens")) {
      collector.add({
        code: "OT-LIM-003",
        rule: "R-LIM-003",
        location: { document: "theme", pointer: "/tokens" },
        params: { detail: String(tokenCount) },
      });
    }

    for (const [path, node] of flat) {
      if (!node.isToken) continue;
      if (path.length > limit("pathLength") || !isValidPath(path)) {
        const segs = path.split(".");
        const longSeg = segs.some((s) => s.length > limit("pathSegmentLength"));
        if (path.length > limit("pathLength") || longSeg || segs.some((s) => !isValidSegment(s))) {
          if (path.length > limit("pathLength") || longSeg) {
            collector.add({
              code: "OT-LIM-006",
              rule: "R-LIM-006",
              location: { document: "theme", pointer: node.pointer },
              params: { detail: path },
            });
          }
        }
      }
    }
  }

  const contexts = doc.contexts;
  if (Array.isArray(contexts) && contexts.length > limit("overlays")) {
    collector.add({
      code: "OT-LIM-005",
      rule: "R-LIM-005",
      location: { document: "theme", pointer: "/contexts" },
      params: { detail: String(contexts.length) },
    });
  }

  const components = doc.components;
  if (components && typeof components === "object" && !Array.isArray(components)) {
    const count = Object.keys(components as object).length;
    if (count > limit("styledContracts")) {
      collector.add({
        code: "OT-LIM-005",
        rule: "R-LIM-005",
        location: { document: "theme", pointer: "/components" },
        params: { detail: String(count) },
      });
    }
  }

  const customization = doc.customization as
    | { points?: unknown[] }
    | undefined;
  if (
    Array.isArray(customization?.points) &&
    customization.points.length > limit("customizationPoints")
  ) {
    collector.add({
      code: "OT-LIM-004",
      rule: "R-LIM-004",
      location: { document: "theme", pointer: "/customization/points" },
      params: { detail: String(customization.points.length) },
    });
  }

  const localized = doc.localized;
  if (
    localized &&
    typeof localized === "object" &&
    !Array.isArray(localized) &&
    Object.keys(localized as object).length > limit("localizedVariants")
  ) {
    collector.add({
      code: "OT-LIM-005",
      rule: "R-LIM-005",
      location: { document: "theme", pointer: "/localized" },
      params: { detail: String(Object.keys(localized as object).length) },
    });
  }
}
