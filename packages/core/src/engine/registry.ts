/**
 * Typed views over the embedded normative registries (specification/registry/1.0).
 */
import {
  componentCatalog,
  contextDimensions,
  customizationPoints,
  limits,
  semanticBaseline,
  transformations,
} from "../generated/registries.js";

export type TokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "number"
  | "opacity"
  | "duration"
  | "cubicBezier"
  | "strokeStyle"
  | "border"
  | "shadow"
  | "typography"
  | "density";

export const TOKEN_TYPES: ReadonlySet<string> = new Set<TokenType>([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "number",
  "opacity",
  "duration",
  "cubicBezier",
  "strokeStyle",
  "border",
  "shadow",
  "typography",
  "density",
]);

export interface BaselineToken {
  readonly path: string;
  readonly type: TokenType;
  readonly default: unknown;
  readonly highContrastDefault?: unknown;
  readonly range: { readonly min?: number; readonly max?: number } | null;
  readonly deprecated: unknown;
  readonly reserved?: boolean;
  readonly forcedColor?: string;
  readonly reducedMotionDefault?: unknown;
}

export interface Pair {
  readonly foreground: string;
  readonly background: string;
  readonly backdrop?: string;
  readonly kind: "text" | "large-text" | "non-text" | "disabled";
}

interface BaselineRegistry {
  readonly tokens: readonly BaselineToken[];
  readonly pairs: readonly Pair[];
  readonly distinguishable: readonly { readonly a: string; readonly b: string }[];
  readonly distinguishableThreshold: number;
}

export interface Contract {
  readonly id: string;
  readonly version: string;
  readonly parts: readonly string[];
  readonly states: readonly string[];
  readonly variants?: Readonly<Record<string, readonly string[]>>;
  readonly properties: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly defaults?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly pairs?: readonly { foreground: string; background: string; kind: Pair["kind"] }[];
  readonly interactiveParts?: readonly string[];
}

export interface TransformArgDef {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly domain?: {
    readonly min?: number;
    readonly max?: number;
    readonly exclusiveMinimum?: number;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly opaque?: boolean;
  };
}

export interface TransformDef {
  readonly id: string;
  readonly outputType: string;
  readonly effortCost: number;
  readonly arguments: readonly TransformArgDef[];
}

export interface StandardPoint {
  readonly id: string;
  readonly type: string;
  readonly target: unknown;
  readonly constraints?: unknown;
  readonly default?: unknown;
  readonly label?: string;
  readonly description?: string;
  readonly localizationKey?: string;
  readonly effectiveRange?: { readonly min: number; readonly max: number };
}

const baseline = semanticBaseline as BaselineRegistry;

export const BASELINE: ReadonlyMap<string, BaselineToken> = new Map(baseline.tokens.map((t) => [t.path, t]));
export const BASELINE_PATHS: readonly string[] = baseline.tokens.map((t) => t.path);
export const BASELINE_PAIRS: readonly Pair[] = baseline.pairs;
export const DISTINGUISHABLE = baseline.distinguishable;
export const DISTINGUISHABLE_THRESHOLD = baseline.distinguishableThreshold;

export const CATALOG: readonly Contract[] = (componentCatalog as { contracts: Contract[] }).contracts;
export const CATALOG_VERSION: string = (componentCatalog as { catalog: string }).catalog;

export const TRANSFORMS: ReadonlyMap<string, TransformDef> = new Map(
  (transformations as { transformations: TransformDef[] }).transformations.map((t) => [t.id, t]),
);

export const STANDARD_POINTS: ReadonlyMap<string, StandardPoint> = new Map(
  (customizationPoints as { points: StandardPoint[] }).points.map((p) => [p.id, p]),
);

export interface DimensionDef {
  readonly values: readonly string[];
  readonly default?: string;
  readonly variantsAllowed?: boolean;
  readonly thresholds?: Readonly<Record<string, { readonly value: number; readonly unit: string }>>;
}

const dims = contextDimensions as {
  readonly priority: readonly string[];
  readonly dimensions: Readonly<Record<string, DimensionDef>>;
};

/** Overlay tie-break priority (chapter 06): contrast > colorScheme > density > sizeClass > motion. */
export const DIMENSION_PRIORITY: readonly string[] = dims.priority;
export const DIMENSIONS: Readonly<Record<string, DimensionDef>> = dims.dimensions;

const limitValues = (limits as { limits: Record<string, { value: number }> }).limits;

export function limit(name: string): number {
  const v = limitValues[name];
  if (!v) throw new Error(`unknown limit ${name}`);
  return v.value;
}

export const EFFORT_BUDGET = 200_000;
