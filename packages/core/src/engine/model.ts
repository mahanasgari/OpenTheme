/**
 * Theme model: a validated (and inheritance-merged) theme document flattened into typed token
 * declarations, overlays, component styling, and customization points (data model §3–§9).
 */
import { BASELINE, type TokenType } from "./registry.js";

export type Raw = unknown;

export interface TokenDecl {
  readonly path: string;
  readonly type: TokenType;
  /** A literal, an alias string "{path}", or a { $derive } object. */
  readonly raw: Raw;
  readonly pointer: string;
  readonly deprecated?: unknown;
}

export interface Overlay {
  readonly index: number;
  readonly when: Readonly<Record<string, string>>;
  readonly tokens: ReadonlyMap<string, { readonly raw: Raw; readonly pointer: string }>;
  readonly components?: Readonly<Record<string, unknown>>;
  readonly layout?: Readonly<Record<string, unknown>>;
}

export interface ThemeModel {
  readonly doc: Readonly<Record<string, unknown>>;
  readonly id: string;
  readonly version: string;
  readonly tokens: ReadonlyMap<string, TokenDecl>;
  readonly overlays: readonly Overlay[];
  readonly supportedSchemes: readonly string[];
  readonly defaultScheme: string;
  /** Variant scheme → standard fallback scheme. */
  readonly variants: ReadonlyMap<string, string>;
  readonly seeds: Readonly<Record<string, unknown>>;
  readonly components: Readonly<Record<string, unknown>>;
  readonly layout: Readonly<Record<string, unknown>>;
  readonly points: readonly Readonly<Record<string, unknown>>[];
  /** Tokens marked physical (FR-077): `physical: true` or $extensions["org.opentheme.physical"]. */
  readonly physical: ReadonlySet<string>;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const ALIAS = /^\{([^{}]+)\}$/;

export function aliasTarget(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = ALIAS.exec(v);
  return m ? m[1]! : null;
}

export function escapeSegment(s: string): string {
  if (s.indexOf("~") < 0 && s.indexOf("/") < 0) return s;
  return s.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isLeaf(node: Record<string, unknown>): boolean {
  return "$value" in node || "$derive" in node;
}

/** Flatten a token tree: leaves carry $value or $derive; $type is inherited from groups. */
export function flattenTokenTree(
  tree: unknown,
  basePointer: string,
  visit: (path: string, node: Record<string, unknown>, type: string | undefined, pointer: string) => void,
): void {
  // `path` is the dotted path of `node`; `depth` 0 is the root.
  const walk = (node: unknown, path: string, depth: number, inherited: string | undefined, pointer: string) => {
    if (!isRecord(node)) return;
    const type = typeof node.$type === "string" ? node.$type : inherited;
    if (depth > 0 && isLeaf(node)) {
      visit(path, node, type, pointer);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key.charCodeAt(0) === 0x24 /* $ */) continue;
      walk(node[key], depth === 0 ? key : `${path}.${key}`, depth + 1, type, `${pointer}/${escapeSegment(key)}`);
    }
  };
  walk(tree, "", 0, undefined, basePointer);
}

const models = new WeakMap<object, ThemeModel>();

/** The model of a frozen document never changes, so it is built once (FR-C071). */
export function buildModel(doc: Readonly<Record<string, unknown>>): ThemeModel {
  if (!Object.isFrozen(doc)) return buildModelOf(doc);
  let m = models.get(doc);
  if (!m) {
    m = buildModelOf(doc);
    models.set(doc, m);
  }
  return m;
}

function buildModelOf(doc: Readonly<Record<string, unknown>>): ThemeModel {
  const tokens = new Map<string, TokenDecl>();
  const physical = new Set<string>();
  flattenTokenTree(doc.tokens, "/tokens", (path, node, type, pointer) => {
    const ext = isRecord(node.$extensions) ? node.$extensions : {};
    if (node.physical === true || ext["org.opentheme.physical"] === true) physical.add(path);
    const resolvedType = (type ?? BASELINE.get(path)?.type) as TokenType | undefined;
    if (!resolvedType) return;
    tokens.set(path, {
      path,
      type: resolvedType,
      raw: "$derive" in node ? Object.freeze({ $derive: node.$derive }) : node.$value,
      pointer,
      ...(node.$deprecated !== undefined ? { deprecated: node.$deprecated } : {}),
    });
  });

  const overlays: Overlay[] = [];
  const contexts = Array.isArray(doc.contexts) ? doc.contexts : [];
  contexts.forEach((ctx, index) => {
    if (!isRecord(ctx) || !isRecord(ctx.when)) return;
    const otokens = new Map<string, { raw: Raw; pointer: string }>();
    flattenTokenTree(ctx.tokens, `/contexts/${index}/tokens`, (path, node, _type, pointer) => {
      otokens.set(path, { raw: "$derive" in node ? Object.freeze({ $derive: node.$derive }) : node.$value, pointer });
    });
    overlays.push({
      index,
      when: ctx.when as Record<string, string>,
      tokens: otokens,
      ...(isRecord(ctx.components) ? { components: ctx.components } : {}),
      ...(isRecord(ctx.layout) ? { layout: ctx.layout } : {}),
    });
  });

  const cs = isRecord(doc.colorSchemes) ? doc.colorSchemes : {};
  const variants = new Map<string, string>();
  if (isRecord(cs.variants)) {
    for (const [name, v] of Object.entries(cs.variants)) {
      if (isRecord(v) && typeof v.fallback === "string") variants.set(name, v.fallback);
    }
  }
  const custom = isRecord(doc.customization) ? doc.customization : {};
  return {
    doc,
    id: String(doc.id ?? ""),
    version: String(doc.version ?? ""),
    tokens,
    overlays,
    supportedSchemes: Array.isArray(cs.supported) ? (cs.supported as string[]) : [],
    defaultScheme: typeof cs.default === "string" ? cs.default : "light",
    variants,
    seeds: isRecord(doc.seeds) ? doc.seeds : {},
    components: isRecord(doc.components) ? doc.components : {},
    layout: isRecord(doc.layout) ? doc.layout : {},
    points: Array.isArray(custom.points) ? (custom.points as Record<string, unknown>[]) : [],
    physical,
  };
}

/** The standard scheme whose seeds apply (a variant uses its fallback). */
export function seedSchemeOf(model: ThemeModel, scheme: string): string {
  if (scheme === "light" || scheme === "dark") return scheme;
  return model.variants.get(scheme) ?? scheme;
}
