/**
 * Theme version comparison (FR-084): compatible vs breaking.
 */
export type CompareClassification = "compatible" | "breaking";

export interface CompareReason {
  kind: string;
  detail: string;
  pointer?: string;
}

export interface CompareResult {
  classification: CompareClassification;
  reasons: CompareReason[];
}

function pointsOf(theme: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const cus = theme.customization as { points?: Array<Record<string, unknown>> } | undefined;
  const out = new Map<string, Record<string, unknown>>();
  for (const p of cus?.points ?? []) {
    if (typeof p.id === "string") out.set(p.id, p);
  }
  return out;
}

function schemesOf(theme: Record<string, unknown>): Set<string> {
  const cs = theme.colorSchemes as { supported?: string[] } | undefined;
  return new Set(cs?.supported ?? []);
}

function extensionsOf(theme: Record<string, unknown>): Set<string> {
  const compat = theme.compatibility as { extensions?: Record<string, unknown> } | undefined;
  return new Set(Object.keys(compat?.extensions ?? {}));
}

function rangeOf(p: Record<string, unknown>): { min?: number; max?: number } | undefined {
  const c = p.constraints as { range?: { min?: number; max?: number } } | undefined;
  return c?.range;
}

/**
 * Classify theme evolution from `oldTheme` to `newTheme`.
 */
export function compareThemes(
  oldTheme: Record<string, unknown>,
  newTheme: Record<string, unknown>,
): CompareResult {
  const reasons: CompareReason[] = [];

  const oldPts = pointsOf(oldTheme);
  const newPts = pointsOf(newTheme);
  for (const [id, oldP] of oldPts) {
    const neu = newPts.get(id);
    if (!neu) {
      reasons.push({
        kind: "point-removed",
        detail: id,
        pointer: `/customization/points`,
      });
      continue;
    }
    if (oldP.type && neu.type && oldP.type !== neu.type) {
      reasons.push({
        kind: "point-type-changed",
        detail: id,
        pointer: `/customization/points`,
      });
    }
    const ot = JSON.stringify(oldP.target ?? null);
    const nt = JSON.stringify(neu.target ?? null);
    if (ot !== nt && (oldP.target !== undefined || neu.target !== undefined)) {
      reasons.push({
        kind: "point-target-changed",
        detail: id,
        pointer: `/customization/points`,
      });
    }
    const or = rangeOf(oldP);
    const nr = rangeOf(neu);
    if (or && nr) {
      if (
        (typeof or.min === "number" && typeof nr.min === "number" && nr.min > or.min) ||
        (typeof or.max === "number" && typeof nr.max === "number" && nr.max < or.max)
      ) {
        reasons.push({
          kind: "constraints-narrowed",
          detail: id,
          pointer: `/customization/points`,
        });
      }
    }
  }

  const oldSchemes = schemesOf(oldTheme);
  const newSchemes = schemesOf(newTheme);
  for (const s of oldSchemes) {
    if (!newSchemes.has(s)) {
      reasons.push({
        kind: "scheme-removed",
        detail: s,
        pointer: "/colorSchemes/supported",
      });
    }
  }

  const oldExt = extensionsOf(oldTheme);
  const newExt = extensionsOf(newTheme);
  for (const e of oldExt) {
    if (!newExt.has(e)) {
      reasons.push({
        kind: "extension-removed",
        detail: e,
        pointer: "/compatibility/extensions",
      });
    }
  }

  const breaking = reasons.length > 0;
  return {
    classification: breaking ? "breaking" : "compatible",
    reasons,
  };
}
