/**
 * SemVer 2.0.0 precedence (§11), used for unversioned selection (R-RES-005).
 * Build metadata is ignored for precedence; callers break ties by version string.
 */

interface Parsed {
  core: [number, number, number];
  pre: string[];
}

function parse(v: string): Parsed | null {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    v,
  );
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split(".") : [],
  };
}

function compareIdentifiers(a: string, b: string): number {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Number(a) === Number(b) ? 0 : Number(a) < Number(b) ? -1 : 1;
  if (an) return -1;
  if (bn) return 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Negative if a < b, positive if a > b, 0 if equal precedence. Unparseable sorts lowest. */
export function comparePrecedence(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i]! < pb.core[i]! ? -1 : 1;
  }
  if (pa.pre.length === 0 || pb.pre.length === 0) {
    return pa.pre.length === pb.pre.length ? 0 : pa.pre.length === 0 ? 1 : -1;
  }
  const n = Math.min(pa.pre.length, pb.pre.length);
  for (let i = 0; i < n; i += 1) {
    const c = compareIdentifiers(pa.pre[i]!, pb.pre[i]!);
    if (c !== 0) return c;
  }
  return pa.pre.length === pb.pre.length ? 0 : pa.pre.length < pb.pre.length ? -1 : 1;
}

/** Total order for R-RES-005: precedence, then version string in code-point order. */
export function compareSelectionOrder(a: string, b: string): number {
  const c = comparePrecedence(a, b);
  if (c !== 0) return c;
  return a === b ? 0 : a < b ? -1 : 1;
}
