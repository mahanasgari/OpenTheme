/**
 * Custom property names (contracts/css-output.md "Names"; research WR2; FR-W002).
 *
 * Every segment matches `[a-z0-9][a-z0-9-]*` (chapter 03's `[a-z][a-z0-9-]*`, widened to the
 * digit-led segments the semantic baseline uses, such as `space.4`; finding W3), so `_` never
 * occurs inside one and runs of one, two, and three underscores decode unambiguously: `_` separates segments, `__` ends a host or contract
 * namespace, and `___` starts a composite member. A name outside the grammar is `null` and the
 * caller omits and reports it (finding W1).
 */

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const MEMBER = /^[a-z][a-zA-Z0-9]*$/;

export const TOKEN_PREFIX = "--ot-";
export const COMPONENT_PREFIX = "--otc-";

export interface VariantKey {
  readonly axis: string;
  readonly value: string;
}

function isSegment(s: string): boolean {
  return SEGMENT.test(s);
}

/** Dot-separated segments joined with `_`, or null. */
function dotted(s: string): string | null {
  const parts = s.split(".");
  return parts.every(isSegment) ? parts.join("_") : null;
}

/** `a.b.c` → `--ot-a_b_c`; `<host-id>/a.b` → `--ot-<host_id>__a_b`. */
export function tokenName(path: string): string | null {
  const slash = path.indexOf("/");
  if (slash < 0) {
    const body = dotted(path);
    return body === null ? null : TOKEN_PREFIX + body;
  }
  const host = dotted(path.slice(0, slash));
  const rest = dotted(path.slice(slash + 1));
  return host === null || rest === null ? null : `${TOKEN_PREFIX}${host}__${rest}`;
}

/** `std/button` → `std__button`; `com.example.notes/timeline` → `com_example_notes__timeline`. */
export function contractName(id: string): string | null {
  const slash = id.indexOf("/");
  if (slash < 0) return null;
  const ns = dotted(id.slice(0, slash));
  const local = id.slice(slash + 1);
  return ns === null || !isSegment(local) ? null : `${ns}__${local}`;
}

export function componentName(
  contract: string,
  part: string,
  property: string,
  state: string,
  variant?: VariantKey,
): string | null {
  const c = contractName(contract);
  if (c === null || !isSegment(part) || !isSegment(property) || !isSegment(state)) return null;
  if (variant && (!isSegment(variant.axis) || !isSegment(variant.value))) return null;
  const v = variant ? `_v_${variant.axis}_${variant.value}` : "";
  return `${COMPONENT_PREFIX}${c}${v}_${part}_${property}_${state}`;
}

/** Composite member `fontSize` → `___font-size`, or null for a name outside camelCase. */
export function memberSuffix(member: string): string | null {
  if (!MEMBER.test(member)) return null;
  return `___${member.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}
