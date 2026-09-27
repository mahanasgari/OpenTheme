import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EffectiveContext } from "./context.js";
import type { ResolvedTokenValue } from "./quantize.js";
import { contrastRatio } from "../color/contrast.js";

interface BaselineEntry {
  path: string;
  type: string;
}

interface RegistryPair {
  foreground: string;
  background: string;
  kind: string;
}

interface CatalogContract {
  id: string;
  version?: string;
  states?: string[];
  variants?: Record<string, string[]>;
  properties: Record<string, Record<string, string>>;
  defaults?: Record<string, Record<string, unknown>>;
}

let cachedPairs: RegistryPair[] | undefined;

function loadBaselinePaths(): string[] {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/semantic-baseline.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    tokens: BaselineEntry[];
  };
  return data.tokens.map((t) => t.path);
}

/** Accessibility pairs from the semantic baseline registry (FR-072). */
export function loadAccessibilityPairs(): RegistryPair[] {
  if (cachedPairs) return cachedPairs;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/semantic-baseline.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    pairs: RegistryPair[];
  };
  cachedPairs = data.pairs ?? [];
  return cachedPairs;
}

/** Test helper: clear the pair cache so registry changes are visible. */
export function clearAccessibilityPairCache(): void {
  cachedPairs = undefined;
}

function loadCatalog(): CatalogContract[] {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/component-catalog.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    contracts: CatalogContract[];
  };
  return data.contracts;
}

function asSrgb(
  v: ResolvedTokenValue | undefined,
): { r: number; g: number; b: number; alpha: number } | null {
  if (!v || typeof v !== "object" || !("srgb8" in v)) return null;
  const c = v as { srgb8: number[]; alpha: number };
  return {
    r: (c.srgb8[0] ?? 0) / 255,
    g: (c.srgb8[1] ?? 0) / 255,
    b: (c.srgb8[2] ?? 0) / 255,
    alpha: c.alpha ?? 1,
  };
}

export function thresholdForPair(
  kind: string,
  contrast: string,
): number | null {
  // Disabled pairs are declared but exempt from the floor (FR-072).
  if (kind === "disabled") return null;
  const high = contrast === "high";
  switch (kind) {
    case "non-text":
      return 3;
    case "large-text":
      return high ? 4.5 : 3;
    case "text":
    default:
      return high ? 7 : 4.5;
  }
}

export interface AccessibilityReport {
  mode: string;
  pairs: {
    foreground: string;
    background: string;
    ratio: number;
    threshold: number;
    pass: boolean;
    kind?: string;
  }[];
  complete: boolean;
}

export function checkAccessibility(
  tokens: Map<string, ResolvedTokenValue>,
  ctx: EffectiveContext,
  pairs: RegistryPair[] = loadAccessibilityPairs(),
): AccessibilityReport {
  const report: AccessibilityReport["pairs"] = [];

  // Seed pair is always checked (OT-A11Y-001 at validate; reported here too).
  const seedChecks: RegistryPair[] = [
    {
      foreground: "seed.foreground",
      background: "seed.background",
      kind: "text",
    },
  ];

  for (const pair of [...seedChecks, ...pairs]) {
    const threshold = thresholdForPair(pair.kind, ctx.contrast);
    if (threshold === null) continue;
    const fg = asSrgb(tokens.get(pair.foreground));
    const bg = asSrgb(tokens.get(pair.background));
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    report.push({
      foreground: pair.foreground,
      background: pair.background,
      ratio,
      threshold,
      pass: ratio >= threshold,
      kind: pair.kind,
    });
  }
  return {
    mode: `${ctx.colorScheme}/${ctx.contrast}`,
    pairs: report,
    complete: true,
  };
}

function contractsForResolve(
  host?: Record<string, unknown> | null,
): CatalogContract[] {
  const base = loadCatalog();
  if (!host || !Array.isArray(host.contracts)) return base;
  return [...base, ...(host.contracts as CatalogContract[])];
}

type StateMap = Record<string, unknown>;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function aliasOf(raw: unknown): string | null {
  return typeof raw === "string" && /^\{[^{}]+\}$/.test(raw) ? raw.slice(1, -1) : null;
}

function pinCompatible(pin: unknown, version: string | undefined): boolean {
  if (typeof pin !== "string" || !version) return true;
  const [pm, pn] = pin.split(".").map(Number);
  const [cm, cn] = version.split(".").map(Number);
  return pm === cm && (pn ?? 0) <= (cn ?? 0);
}

/** A styled or default property value as per-state raw values (chapter 08). */
function statesOf(raw: unknown): StateMap {
  if (isObj(raw) && isObj(raw.$states)) return { ...raw.$states };
  if (isObj(raw) && "$value" in raw) return { default: raw.$value };
  return raw === undefined ? {} : { default: raw };
}

/** Evaluation path of a styled value; never part of the token output. */
export function styledValuePath(
  contract: string,
  variant: string,
  part: string,
  prop: string,
  state: string,
): string {
  return `components.${contract}${variant}.parts.${part}.${prop}.${state}`;
}

/** Component stylings that apply: the theme's, then each matching overlay's, in order. */
function stylingLayers(
  theme: Record<string, unknown>,
  overlays: Record<string, unknown>[],
): Record<string, unknown>[] {
  const layers: Record<string, unknown>[] = [];
  if (isObj(theme.components)) layers.push(theme.components);
  for (const o of overlays) if (isObj(o.components)) layers.push(o.components);
  return layers;
}

/**
 * Styled literal and derived values, as declarations for evaluation alongside the token graph.
 * Aliases are not declared: they take the referenced token's resolved value.
 */
export function styledDeclarations(
  theme: Record<string, unknown>,
  overlays: Record<string, unknown>[],
  host?: Record<string, unknown> | null,
): { path: string; type: string; value: unknown }[] {
  const out: { path: string; type: string; value: unknown }[] = [];
  const layers = stylingLayers(theme, overlays);
  for (const contract of contractsForResolve(host)) {
    if (!contract.properties) continue;
    if (!contract.id.startsWith("std/") && !host) continue;
    for (const layer of layers) {
      const s = layer[contract.id];
      if (!isObj(s) || !pinCompatible(s.contract, contract.version)) continue;
      const visit = (parts: unknown, variant: string) => {
        if (!isObj(parts)) return;
        for (const [part, pp] of Object.entries(parts)) {
          if (!isObj(pp)) continue;
          for (const [prop, raw] of Object.entries(pp)) {
            const type = contract.properties[part]?.[prop];
            if (!type) continue;
            for (const [state, sraw] of Object.entries(statesOf(raw))) {
              if (aliasOf(sraw) !== null) continue;
              out.push({ path: styledValuePath(contract.id, variant, part, prop, state), type, value: sraw });
            }
          }
        }
      };
      visit(s.parts, "");
      if (isObj(s.variants)) {
        for (const [axis, values] of Object.entries(s.variants)) {
          if (!isObj(values)) continue;
          for (const [value, body] of Object.entries(values)) {
            if (isObj(body)) visit(body.parts, `.$variants.${axis}.${value}`);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Resolved components (chapter 08, "Resolved components"; finding F23). Every contract property
 * is a per-state object: `default`, plus each contract state some layer declares. Layers are the
 * contract defaults, then the theme's styling and each matching overlay's styling in order;
 * locks replace every state. Aliases take the resolved token value; literals and derivations take
 * their evaluated, encoded value (`styled`). Under forced colors a color property is the system
 * role of the token its contract default aliases, else `canvas-text`.
 */
export function resolveComponents(
  tokens: Map<string, ResolvedTokenValue>,
  styled: Map<string, ResolvedTokenValue>,
  theme: Record<string, unknown>,
  overlays: Record<string, unknown>[],
  forcedColors: boolean,
  forcedRoles: Map<string, string>,
  locks?: Record<string, unknown>,
  host?: Record<string, unknown> | null,
): Record<string, unknown> {
  const layers = stylingLayers(theme, overlays);
  const encode = (raw: unknown, key: string): unknown => {
    const target = aliasOf(raw);
    if (target !== null) return tokens.get(target) ?? null;
    if (styled.has(key)) return styled.get(key);
    return isObj(raw) && "$derive" in raw ? null : raw;
  };
  const components: Record<string, unknown> = {};
  for (const contract of contractsForResolve(host)) {
    if (!contract.properties) continue;
    const known = contract.id.startsWith("std/") || !!host;
    const stylings = known
      ? layers
          .map((l) => l[contract.id])
          .filter((s): s is Record<string, unknown> => isObj(s) && pinCompatible(s.contract, contract.version))
      : [];
    const states = contract.states ?? [];
    const entry: Record<string, unknown> = {};
    for (const [part, props] of Object.entries(contract.properties)) {
      const partOut: Record<string, unknown> = {};
      for (const [prop, type] of Object.entries(props)) {
        const defaults = statesOf(contract.defaults?.[part]?.[prop]);
        const merged: StateMap = { ...defaults };
        for (const s of stylings) {
          const pp = isObj(s.parts) && isObj(s.parts[part]) ? s.parts[part] : undefined;
          if (pp && prop in pp) Object.assign(merged, statesOf(pp[prop]));
        }
        const lockKey = `components.${contract.id}.parts.${part}.${prop}`;
        const locked = locks !== undefined && lockKey in locks;
        const result: Record<string, unknown> = {};
        const present = ["default", ...states.filter((st) => st !== "default" && st in merged)];
        for (const state of present) {
          let value = locked
            ? encode(locks![lockKey], `lock.${lockKey}`)
            : encode(merged[state] ?? merged.default, styledValuePath(contract.id, "", part, prop, state));
          if (forcedColors && type === "color") {
            const def = aliasOf(defaults[state] ?? defaults.default);
            value = { system: (def && forcedRoles.get(def)) || "canvas-text" };
          }
          result[state] = value;
        }
        partOut[prop] = result;
      }
      entry[part] = partOut;
    }
    const variantsOut: Record<string, Record<string, Record<string, Record<string, StateMap>>>> = {};
    for (const s of stylings) {
      if (!isObj(s.variants)) continue;
      for (const [axis, values] of Object.entries(s.variants)) {
        const allowed = contract.variants?.[axis];
        if (!isObj(values) || !allowed) continue;
        for (const [value, body] of Object.entries(values)) {
          if (!allowed.includes(value) || !isObj(body) || !isObj(body.parts)) continue;
          for (const [part, pprops] of Object.entries(body.parts)) {
            if (!isObj(pprops)) continue;
            for (const [prop, raw] of Object.entries(pprops)) {
              if (!contract.properties[part]?.[prop]) continue;
              const partOut = ((variantsOut[axis] ??= {})[value] ??= {})[part] ??= {};
              const res: StateMap = {};
              for (const [state, sraw] of Object.entries(statesOf(raw))) {
                res[state] = encode(sraw, styledValuePath(contract.id, `.$variants.${axis}.${value}`, part, prop, state));
              }
              partOut[prop] = { ...(partOut[prop] ?? {}), ...res };
            }
          }
        }
      }
    }
    if (Object.keys(variantsOut).length > 0) entry.$variants = variantsOut;
    components[contract.id] = entry;
  }
  return components;
}

export function isComplete(
  tokens: Map<string, ResolvedTokenValue>,
): boolean {
  for (const path of loadBaselinePaths()) {
    if (!tokens.has(path)) return false;
  }
  return true;
}
