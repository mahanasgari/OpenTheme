/**
 * Import (chapter 16; research IR5, IR6): a DTCG 2025.10 document becomes an OpenTheme theme with
 * the tokens under the reserved `primitive` group. Nothing is approximated: every token that cannot
 * be represented is left out and reported. The theme is returned only if Core validates it.
 */
import { createCore, type Diagnostic } from "@opentheme/core";
import { BASELINE_TYPES, DEFAULT_SEEDS } from "./generated/data.js";
import { convertPath } from "./names.js";
import { Report, type ReportEntry } from "./report.js";
import { decode, isAlias } from "./values.js";

export interface ImportOptions {
  /** `seed.<scheme>.<role>`, `seed.font-family`, or a semantic baseline path → a DTCG token path. */
  readonly mapping?: Readonly<Record<string, string>>;
  readonly id?: string;
  readonly name?: string;
  readonly restoreDerivations?: boolean;
}

export interface ImportResult {
  readonly theme: object | null;
  readonly text: string | null;
  readonly report: readonly ReportEntry[];
  readonly diagnostics: readonly Diagnostic[];
}

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const MAX_BYTES = 1_048_576;
const MAX_DEPTH = 64;
const SEED_KEY = /^seed\.(light|dark)\.(background|foreground|accent)$/;
const NUMERIC = new Set(["number", "opacity", "fontWeight"]);

interface Source {
  readonly path: string;
  readonly type: string | undefined;
  readonly value: unknown;
  readonly description: string | undefined;
  readonly deprecated: unknown;
  readonly extensions: Rec | undefined;
}

const aliasPath = (a: string) => a.slice(1, -1);

/** Every alias string inside a value, at any depth. */
function aliasesIn(v: unknown, out: string[] = []): string[] {
  if (isAlias(v)) out.push(aliasPath(v));
  else if (Array.isArray(v)) for (const x of v) aliasesIn(x, out);
  else if (isRecord(v)) for (const x of Object.values(v)) aliasesIn(x, out);
  return out;
}

function mapAliases(v: unknown, f: (path: string) => string | null): unknown {
  if (isAlias(v)) {
    const t = f(aliasPath(v));
    return t === null ? v : `{${t}}`;
  }
  if (Array.isArray(v)) return v.map((x) => mapAliases(x, f));
  if (isRecord(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapAliases(x, f)]));
  return v;
}

function newUid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return `uid.${out}`;
}

/** Tokens of a DTCG tree with group `$type` inheritance; iterative, bounded depth. */
function collect(doc: Rec, report: Report): Source[] {
  const out: Source[] = [];
  const stack: { node: Rec; path: string[]; type: string | undefined }[] = [{ node: doc, path: [], type: undefined }];
  while (stack.length > 0) {
    const { node, path, type } = stack.pop()!;
    const t = typeof node.$type === "string" ? node.$type : type;
    if ("$value" in node) {
      out.push({
        path: path.join("."),
        type: t,
        value: node.$value,
        description: typeof node.$description === "string" ? node.$description : undefined,
        deprecated: node.$deprecated,
        extensions: isRecord(node.$extensions) ? node.$extensions : undefined,
      });
      continue;
    }
    if (path.length >= MAX_DEPTH) {
      report.add(path.join("."), "left-out", `groups nested deeper than ${MAX_DEPTH} levels are not imported`);
      continue;
    }
    for (const key of Object.keys(node).sort().reverse()) {
      if (key.startsWith("$")) continue;
      const child = node[key];
      if (!isRecord(child)) continue;
      if (/[.{}]/.test(key)) {
        report.add([...path, key].join("."), "left-out", "DTCG names cannot contain '.', '{', or '}'");
        continue;
      }
      stack.push({ node: child, path: [...path, key], type: t });
    }
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function importTokens(input: string | Uint8Array, options: ImportOptions = {}): ImportResult {
  const report = new Report();
  const fail = (path: string, reason: string): ImportResult => {
    report.add(path, "left-out", reason);
    return { theme: null, text: null, report: report.entries(), diagnostics: [] };
  };
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  if (bytes.length > MAX_BYTES) return fail("", `the document is larger than ${MAX_BYTES} bytes`);
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("", "the document is not UTF-8");
  }
  let doc: unknown;
  try {
    doc = JSON.parse(source);
  } catch {
    return fail("", "the document is not JSON");
  }
  if (!isRecord(doc)) return fail("", "a DTCG document is a JSON object");

  const sources = collect(doc, report);
  const byPath = new Map(sources.map((s) => [s.path, s]));

  // Names (finding D3): convert, then leave out collisions and unconvertible names.
  const converted = new Map<string, string>();
  const claims = new Map<string, string[]>();
  for (const s of sources) {
    const c = convertPath(s.path.split("."));
    if (c === null) {
      report.add(s.path, "left-out", "the name cannot be converted to an OpenTheme path segment");
      continue;
    }
    claims.set(c, [...(claims.get(c) ?? []), s.path]);
    converted.set(s.path, c);
  }
  for (const [c, paths] of claims) {
    if (paths.length > 1) {
      for (const p of paths) {
        converted.delete(p);
        report.add(p, "left-out", `the converted name ${c} collides with ${paths.filter((x) => x !== p).join(", ")}`);
      }
    }
  }
  // A converted token path that is a prefix of another would be both a token and a group.
  const convertedSet = new Set(converted.values());
  for (const [p, c] of [...converted]) {
    const parts = c.split(".");
    for (let i = 1; i < parts.length; i += 1) {
      if (convertedSet.has(parts.slice(0, i).join("."))) {
        converted.delete(p);
        report.add(p, "left-out", "after name conversion the path is both a token and a group");
        break;
      }
    }
  }

  // Types: explicit or inherited, else the alias target's type.
  const typeOf = (path: string, seen = new Set<string>()): string | undefined => {
    const s = byPath.get(path);
    if (!s || seen.has(path)) return undefined;
    if (s.type) return s.type;
    seen.add(path);
    return isAlias(s.value) ? typeOf(aliasPath(s.value), seen) : undefined;
  };

  // Decode until stable: a token whose alias target is left out is left out too.
  const included = new Set(converted.keys());
  const decoded = new Map<string, { type: string; value: unknown; note?: string }>();
  for (let changed = true; changed; ) {
    changed = false;
    decoded.clear();
    for (const path of [...included]) {
      const s = byPath.get(path)!;
      const type = typeOf(path);
      if (!type) {
        included.delete(path);
        report.add(path, "left-out", "the token has no $type and is not an alias to a typed token");
        changed = true;
        continue;
      }
      const dangling = aliasesIn(s.value).find((a) => !byPath.has(a));
      if (dangling !== undefined) {
        included.delete(path);
        report.add(path, "left-out", `alias {${dangling}} refers to no token`);
        changed = true;
        continue;
      }
      const r = decode(type, s.value, (a) => (included.has(aliasPath(a)) ? `{primitive.${converted.get(aliasPath(a))}}` : null));
      if (!r.ok) {
        included.delete(path);
        report.add(path, "left-out", r.reason);
        changed = true;
        continue;
      }
      decoded.set(path, r.note ? { ...r.value, note: r.note } : r.value);
    }
    // Alias cycles are left out (Core would reject them as OT-REF-003).
    if (!changed) {
      const state = new Map<string, number>();
      const cyclic = new Set<string>();
      const visit = (p: string, stack: string[]) => {
        if (state.get(p) === 2) return;
        if (state.get(p) === 1) {
          for (const q of stack.slice(stack.indexOf(p))) cyclic.add(q);
          return;
        }
        state.set(p, 1);
        for (const a of aliasesIn(byPath.get(p)!.value)) if (included.has(a)) visit(a, [...stack, a]);
        state.set(p, 2);
      };
      for (const p of included) visit(p, [p]);
      for (const p of cyclic) {
        included.delete(p);
        report.add(p, "left-out", "the token is part of an alias cycle");
        changed = true;
      }
    }
  }

  // Build the primitive tree.
  const primitive: Rec = {};
  let extensionsDropped = 0;
  for (const path of [...included].sort()) {
    const s = byPath.get(path)!;
    const d = decoded.get(path)!;
    const c = converted.get(path)!;
    if (c !== path) report.add(path, "renamed", `imported as primitive.${c}`);
    if (d.note) report.add(path, "converted", d.note);
    const token: Rec = { $type: d.type };
    const ot = s.extensions && isRecord(s.extensions["org.opentheme"]) ? s.extensions["org.opentheme"] : undefined;
    const derive = ot && "derive" in ot ? ot.derive : undefined;
    let restored = false;
    if (derive !== undefined && options.restoreDerivations) {
      const refs = aliasesIn(derive);
      if (refs.every((r) => included.has(r))) {
        token.$derive = mapAliases(derive, (r) => `primitive.${converted.get(r)}`);
        restored = true;
        report.add(path, "restored", "the kept derivation was restored");
      } else {
        report.add(path, "kept-computed", "the kept derivation refers to a token that was not imported");
      }
    } else if (derive !== undefined) {
      report.add(path, "kept-computed", "the computed value was imported (use derivation restoring to restore the kept derivation)");
    }
    if (!restored) token.$value = d.value;
    if (s.description !== undefined) token.$description = s.description;
    if (s.deprecated === true) token.$deprecated = true;
    else if (typeof s.deprecated === "string") {
      token.$deprecated = true;
      report.add(path, "converted", "the deprecation message was dropped (OpenTheme deprecation names a replacement)");
    }
    if (s.extensions && Object.keys(s.extensions).some((k) => k !== "org.opentheme")) extensionsDropped += 1;
    let node = primitive;
    const parts = c.split(".");
    for (const seg of parts.slice(0, -1)) {
      if (!Object.hasOwn(node, seg)) node[seg] = {};
      node = node[seg] as Rec;
    }
    node[parts[parts.length - 1]!] = token;
  }
  if (extensionsDropped > 0) report.add("", "dropped-extensions", `${extensionsDropped} token(s) had $extensions from other tools, which are not imported`);

  // Mapping (finding D2): seeds take the mapped token's literal value; roles alias the primitive.
  const literal = (path: string): { type: string; value: unknown } | null => {
    let p = path;
    for (let i = 0; i <= included.size; i += 1) {
      const d = decoded.get(p);
      if (!d) return null;
      if (!isAlias(d.value)) return { type: d.type, value: d.value };
      const next = [...converted].find(([, c]) => `{primitive.${c}}` === d.value)?.[0];
      if (next === undefined) return null;
      p = next;
    }
    return null;
  };
  const seeds: Rec = {};
  const roles: Rec = {};
  const mapping = options.mapping ?? {};
  for (const key of Object.keys(mapping).sort()) {
    const target = mapping[key]!;
    if (!included.has(target)) return fail(`mapping:${key}`, `${target} is not an imported token`);
    const m = SEED_KEY.exec(key);
    if (m) {
      const lit = literal(target);
      if (!lit || lit.type !== "color") return fail(`mapping:${key}`, `${target} is not a color`);
      const scheme = (seeds[m[1]!] ??= {}) as Rec;
      scheme[m[2]!] = lit.value;
    } else if (key === "seed.font-family") {
      const lit = literal(target);
      if (!lit || lit.type !== "fontFamily") return fail(`mapping:${key}`, `${target} is not a font family`);
      seeds.fontFamily = lit.value;
    } else if (!key.startsWith("seed.") && Object.hasOwn(BASELINE_TYPES, key)) {
      const want = BASELINE_TYPES[key]!;
      const got = decoded.get(target)!.type;
      if (want !== got && !(NUMERIC.has(want) && NUMERIC.has(got))) return fail(`mapping:${key}`, `${target} is a ${got}, the role is a ${want}`);
      let node = roles;
      const parts = key.split(".");
      for (const seg of parts.slice(0, -1)) {
        if (!Object.hasOwn(node, seg)) node[seg] = {};
        node = node[seg] as Rec;
      }
      node[parts[parts.length - 1]!] = { $value: `{primitive.${converted.get(target)}}` };
    } else {
      return fail(`mapping:${key}`, "not a seed or a semantic baseline role");
    }
  }
  const schemes = (["light", "dark"] as const).filter((s) => seeds[s] !== undefined);
  for (const s of schemes) {
    const missing = ["background", "foreground", "accent"].filter((r) => !Object.hasOwn(seeds[s] as Rec, r));
    if (missing.length > 0) return fail(`mapping:seed.${s}`, `the ${s} seeds are incomplete (missing ${missing.join(", ")})`);
  }
  if (schemes.length === 0) {
    seeds.light = (DEFAULT_SEEDS as Rec).light;
    schemes.push("light");
    report.add("seed.light", "defaulted", "no seeds were mapped; the specification's seed-only example seeds are used");
  }
  if (seeds.fontFamily === undefined) {
    seeds.fontFamily = (DEFAULT_SEEDS as Rec).fontFamily;
    report.add("seed.font-family", "defaulted", "no font family seed was mapped; the example's is used");
  }
  const orderedSeeds: Rec = {};
  for (const s of schemes) orderedSeeds[s] = seeds[s];
  orderedSeeds.fontFamily = seeds.fontFamily;

  const theme = {
    opentheme: "1.0",
    id: options.id ?? newUid(),
    version: "1.0.0",
    name: options.name ?? "Imported Tokens",
    provenance: { origin: "imported" },
    compatibility: { catalog: "1.0" },
    colorSchemes: { supported: schemes, default: schemes[0] },
    seeds: orderedSeeds,
    tokens: { ...roles, primitive },
  };
  const text = `${JSON.stringify(theme, null, 2)}\n`;
  const check = createCore().registry.admit({ kind: "theme", bytes: text, trust: "trusted" });
  if (check.status !== "registered") return { theme: null, text: null, report: report.entries(), diagnostics: check.diagnostics };
  return { theme, text, report: report.entries(), diagnostics: [] };
}
