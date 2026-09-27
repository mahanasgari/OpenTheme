/**
 * Theme-version classification (chapter 14, FR-084). Breaking: a customization point removed, its
 * type or target changed, or its constraints narrowed so prior values no longer fit; a supported
 * color scheme removed; a compatibility extension namespace removed. Everything else is compatible.
 */
import { jcs } from "../canonical/jcs.js";
import { isRecord } from "../engine/model.js";

export interface CompareReason {
  readonly kind: string;
  readonly detail: string;
  readonly pointer: string;
}

function points(doc: Readonly<Record<string, unknown>>): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  const custom = isRecord(doc.customization) ? doc.customization : {};
  for (const p of Array.isArray(custom.points) ? custom.points : []) {
    if (isRecord(p) && typeof p.id === "string") out.set(p.id, p);
  }
  return out;
}

function narrowed(oldC: unknown, newC: unknown): boolean {
  if (!isRecord(oldC) || !isRecord(newC)) return jcs(oldC ?? null) !== jcs(newC ?? null) && newC !== undefined;
  const or = isRecord(oldC.range) ? oldC.range : undefined;
  const nr = isRecord(newC.range) ? newC.range : undefined;
  if (or && nr) {
    if (typeof or.min === "number" && typeof nr.min === "number" && nr.min > or.min) return true;
    if (typeof or.max === "number" && typeof nr.max === "number" && nr.max < or.max) return true;
    if (typeof or.step === "number" && typeof nr.step === "number" && nr.step !== or.step) {
      // A different step keeps prior values only if every old step value is a new step value.
      if (!Number.isInteger(or.step / nr.step)) return true;
    }
    return false;
  }
  const list = (c: Record<string, unknown>): string[] | undefined =>
    Array.isArray(c.enum)
      ? c.enum.map((e) => jcs(e))
      : Array.isArray(c.presets)
        ? c.presets.map((p) => jcs(isRecord(p) ? p.id : p))
        : undefined;
  const ol = list(oldC);
  const nl = list(newC);
  if (ol && nl) return ol.some((v) => !nl.includes(v));
  return (or !== undefined) !== (nr !== undefined);
}

export function compareVersions(
  older: Readonly<Record<string, unknown>>,
  newer: Readonly<Record<string, unknown>>,
): { classification: "compatible" | "breaking"; reasons: CompareReason[] } {
  const reasons: CompareReason[] = [];
  const op = points(older);
  const np = points(newer);
  for (const [id, o] of op) {
    const n = np.get(id);
    if (!n) {
      reasons.push({ kind: "point-removed", detail: id, pointer: "/customization/points" });
      continue;
    }
    if (o.type !== n.type) reasons.push({ kind: "point-type-changed", detail: id, pointer: "/customization/points" });
    else if (jcs(o.target ?? null) !== jcs(n.target ?? null)) reasons.push({ kind: "point-target-changed", detail: id, pointer: "/customization/points" });
    else if (narrowed(o.constraints, n.constraints)) reasons.push({ kind: "constraints-narrowed", detail: id, pointer: "/customization/points" });
  }
  const schemes = (d: Readonly<Record<string, unknown>>) =>
    isRecord(d.colorSchemes) && Array.isArray(d.colorSchemes.supported) ? (d.colorSchemes.supported as string[]) : [];
  const newSchemes = schemes(newer);
  for (const s of schemes(older)) if (!newSchemes.includes(s)) reasons.push({ kind: "scheme-removed", detail: s, pointer: "/colorSchemes/supported" });
  const exts = (d: Readonly<Record<string, unknown>>) =>
    isRecord(d.compatibility) && isRecord(d.compatibility.extensions) ? Object.keys(d.compatibility.extensions) : [];
  const newExt = exts(newer);
  for (const e of exts(older)) if (!newExt.includes(e)) reasons.push({ kind: "extension-removed", detail: e, pointer: "/compatibility/extensions" });
  return { classification: reasons.length > 0 ? "breaking" : "compatible", reasons };
}
