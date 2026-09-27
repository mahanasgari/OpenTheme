import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticCollector } from "../diagnostics/collector.js";

interface StandardPoint {
  id: string;
  type: string;
  target: string[] | { dimension: string };
  constraints?: Record<string, unknown>;
}

interface PointsFile {
  points: StandardPoint[];
}

let standardPoints: Map<string, StandardPoint> | undefined;

function loadStandardPoints(): Map<string, StandardPoint> {
  if (standardPoints) return standardPoints;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/customization-points.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as PointsFile;
  standardPoints = new Map(data.points.map((p) => [p.id, p]));
  return standardPoints;
}

type RangeConstraints = {
  min?: number;
  max?: number;
  step?: number;
  gamut?: string;
  opaque?: boolean;
};

type PointDecl = {
  id?: string;
  type?: string;
  target?: string[] | { dimension: string };
  targets?: string[];
  default?: unknown;
  effectiveRange?: { min?: number; max?: number };
  constraints?: {
    range?: RangeConstraints;
    enum?: unknown[];
    kind?: string;
    min?: number;
    max?: number;
    step?: number;
  };
};

function isWholeSteps(min: number, max: number, step: number): boolean {
  if (step <= 0) return false;
  const n = (max - min) / step;
  return Math.abs(n - Math.round(n)) < 1e-9;
}

function getRange(c: PointDecl["constraints"]): RangeConstraints | undefined {
  if (!c) return undefined;
  if (c.range) return c.range;
  if (c.min !== undefined || c.max !== undefined) {
    const out: RangeConstraints = {};
    if (c.min !== undefined) out.min = c.min;
    if (c.max !== undefined) out.max = c.max;
    if (c.step !== undefined) out.step = c.step;
    return out;
  }
  return undefined;
}

/**
 * Validate customization point declarations (FR-042 → OT-CUS-001…006).
 */
export function validateCustomization(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  const points =
    doc.customizationPoints ??
    (doc.customization as { points?: unknown } | undefined)?.points;
  if (points === undefined) return;
  if (!Array.isArray(points)) return;

  const std = loadStandardPoints();

  const pointerBase =
    doc.customization !== undefined ? "/customization/points" : "/customizationPoints";

  points.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const p = raw as PointDecl;
    const pointer = `${pointerBase}/${index}`;

    if (!p.id || typeof p.id !== "string") return;

    const registry = std.get(p.id);
    const target = p.target ?? p.targets;
    // Standard registry points may be opted in by id alone (theme-document §Customization).
    const missingTarget =
      target === undefined || (Array.isArray(target) && target.length === 0);
    if (missingTarget && !registry) {
      collector.add({
        code: "OT-CUS-003",
        rule: "R-CUS-003",
        location: { document: "theme", pointer: `${pointer}/target` },
        params: { detail: p.id },
      });
    }

    const range = getRange(p.constraints);
    if (range) {
      const { min, max, step } = range;
      if (
        typeof min === "number" &&
        typeof max === "number" &&
        typeof step === "number" &&
        !isWholeSteps(min, max, step)
      ) {
        collector.add({
          code: "OT-CUS-004",
          rule: "R-CUS-004",
          location: { document: "theme", pointer: `${pointer}/constraints` },
          params: { detail: p.id },
        });
      }
    }

    if (
      (p.id === "std.text-size" || p.id.endsWith("text-size")) &&
      range &&
      typeof range.min === "number" &&
      range.min < 1
    ) {
      collector.add({
        code: "OT-CUS-005",
        rule: "R-CUS-005",
        location: {
          document: "theme",
          pointer: `${pointer}/constraints/range/min`,
        },
        params: { detail: String(range.min) },
      });
    }

    if (
      p.effectiveRange &&
      typeof p.effectiveRange.max === "number" &&
      p.effectiveRange.max < 2
    ) {
      collector.add({
        code: "OT-CUS-001",
        rule: "R-CUS-001",
        location: {
          document: "theme",
          pointer: `${pointer}/effectiveRange/max`,
        },
        params: { detail: String(p.effectiveRange.max) },
      });
    }

    if (p.constraints?.enum && p.type === "color") {
      collector.add({
        code: "OT-CUS-002",
        rule: "R-CUS-002",
        location: { document: "theme", pointer: `${pointer}/constraints` },
        params: { detail: p.id },
      });
    }

    if (
      typeof p.default === "number" &&
      range &&
      typeof range.min === "number" &&
      typeof range.max === "number" &&
      (p.default < range.min || p.default > range.max)
    ) {
      collector.add({
        code: "OT-CUS-001",
        rule: "R-CUS-001",
        location: { document: "theme", pointer: `${pointer}/default` },
        params: { detail: String(p.default) },
      });
    }

    if (registry) {
      if (p.type && p.type !== registry.type) {
        collector.add({
          code: "OT-CUS-006",
          rule: "R-CUS-006",
          location: { document: "theme", pointer: `${pointer}/type` },
          params: { detail: p.type },
        });
      }
      if (Array.isArray(target) && Array.isArray(registry.target)) {
        const regTargets = [...registry.target].sort().join(",");
        const declTargets = [...target].sort().join(",");
        if (regTargets !== declTargets) {
          collector.add({
            code: "OT-CUS-006",
            rule: "R-CUS-006",
            location: { document: "theme", pointer: `${pointer}/target` },
            params: { detail: p.id },
          });
        }
      }
    }
  });
}
