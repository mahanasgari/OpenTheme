/**
 * Test-only decoder (research WR7, T010): the exact inverse of src/naming.ts and src/serialize.ts.
 * It turns declarations back into Core's `tokens` and `components` shapes for the output-target
 * conformance check. Composite shorthands are skipped; composites are rebuilt from their members.
 */
import { GENERIC_FAMILIES, SYSTEM_COLORS } from "../src/generated/registry.js";

export type DecodedName =
  | { kind: "token"; path: string; member?: string }
  | {
      kind: "component";
      contract: string;
      part: string;
      property: string;
      state: string;
      variant?: { axis: string; value: string };
      member?: string;
    };

const undot = (s: string) => s.replace(/_/g, ".");
const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function decodeName(name: string): DecodedName {
  const component = name.startsWith("--otc-");
  if (!component && !name.startsWith("--ot-")) throw new Error(`not an OpenTheme name: ${name}`);
  const body = name.slice(component ? 6 : 5);
  const [base, member, extra] = body.split("___");
  if (base === undefined || extra !== undefined) throw new Error(`bad name: ${name}`);
  const withMember = <T extends object>(o: T) => (member === undefined ? o : { ...o, member: camel(member) });
  const ns = base.indexOf("__");
  if (!component) {
    const path = ns < 0 ? undot(base) : `${undot(base.slice(0, ns))}/${undot(base.slice(ns + 2))}`;
    return withMember({ kind: "token" as const, path });
  }
  if (ns < 0) throw new Error(`bad component name: ${name}`);
  const [local, ...segs] = base.slice(ns + 2).split("_");
  const contract = `${undot(base.slice(0, ns))}/${local}`;
  if (segs.length === 3) {
    const [part, property, state] = segs as [string, string, string];
    return withMember({ kind: "component" as const, contract, part, property, state });
  }
  if (segs.length === 6 && segs[0] === "v") {
    const [, axis, value, part, property, state] = segs as [string, string, string, string, string, string];
    return withMember({ kind: "component" as const, contract, part, property, state, variant: { axis, value } });
  }
  throw new Error(`bad component name: ${name}`);
}

const SYSTEM_ROLES = new Map(Object.entries(SYSTEM_COLORS).map(([role, css]) => [css, role]));
const STROKE = new Set(["solid", "dashed", "dotted"]);
const NUMBER = String.raw`-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`;
const RGB = new RegExp(String.raw`^rgb\((\d+) (\d+) (\d+)(?: / (${NUMBER}))?\)$`);
const DIM = new RegExp(String.raw`^(${NUMBER})(px|ms)$`);
const NUM = new RegExp(String.raw`^${NUMBER}$`);
const BEZIER = new RegExp(String.raw`^cubic-bezier\((${NUMBER}), (${NUMBER}), (${NUMBER}), (${NUMBER})\)$`);

function familyList(text: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      let s = "";
      i += 1;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") i += 1;
        s += text[i];
        i += 1;
      }
      if (text[i] !== '"') return null;
      out.push(s);
      i += 1;
    } else {
      const end = text.indexOf(",", i);
      const word = end < 0 ? text.slice(i) : text.slice(i, end);
      if (!GENERIC_FAMILIES.has(word)) return null;
      out.push(word);
      i += word.length;
    }
    if (i === text.length) break;
    if (text.slice(i, i + 2) !== ", ") return null;
    i += 2;
  }
  return out.length > 0 ? out : null;
}

/** Decode one value. `member` values carry plain numbers; top-level numbers are `{ number }`. */
export function decodeValue(text: string, member: boolean): unknown {
  let m = RGB.exec(text);
  if (m) return { srgb8: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: m[4] === undefined ? 1 : Number(m[4]) };
  const role = SYSTEM_ROLES.get(text);
  if (role !== undefined) return { system: role };
  if ((m = DIM.exec(text))) return { value: Number(m[1]), unit: m[2] };
  if (NUM.test(text)) return member ? Number(text) : { number: Number(text) };
  if ((m = BEZIER.exec(text))) return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (STROKE.has(text)) return text;
  const families = familyList(text);
  if (families) return { families };
  throw new Error(`undecodable value: ${text}`);
}

type Tree = Record<string, unknown>;

function put(tree: Tree, keys: readonly string[], value: unknown): void {
  let node = tree;
  for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Tree;
  node[keys[keys.length - 1]!] = value;
}

/** Declarations → `{ tokens, components }` in Core's resolved shape. */
export function decodeDeclarations(declarations: readonly { name: string; value: string }[]): {
  tokens: Tree;
  components: Tree;
} {
  const tokens: Tree = {};
  const components: Tree = {};
  const composites = new Set<string>();
  const parsed = declarations.map((d) => ({ d, n: decodeName(d.name) }));
  for (const { d, n } of parsed) if (n.member !== undefined) composites.add(d.name.slice(0, d.name.indexOf("___")));
  for (const { d, n } of parsed) {
    if (n.member === undefined && composites.has(d.name)) continue; // a shorthand
    const value = decodeValue(d.value, n.member !== undefined);
    const tail = n.member === undefined ? [] : [n.member];
    if (n.kind === "token") put(tokens, [n.path, ...tail], value);
    else {
      const where = n.variant ? ["$variants", n.variant.axis, n.variant.value] : [];
      put(components, [n.contract, ...where, n.part, n.property, n.state, ...tail], value);
    }
  }
  return { tokens, components };
}
