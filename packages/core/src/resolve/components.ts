/**
 * Resolved components (chapter 08, "Resolved components"; finding F23).
 */
import { type EvalContext, applicableOverlays } from "../engine/evaluate.js";
import { encodeValue, isComposite, resolveComposite } from "../engine/encode.js";
import { aliasTarget, isRecord, type ThemeModel } from "../engine/model.js";
import { BASELINE, type Contract } from "../engine/registry.js";
import { decodeLiteral } from "../engine/values.js";

type StateMap = Record<string, unknown>;

function compatiblePin(pin: unknown, version: string): boolean {
  if (typeof pin !== "string") return true;
  const [pm, pn] = pin.split(".").map(Number);
  const [cm, cn] = version.split(".").map(Number);
  return pm === cm && (pn ?? 0) <= (cn ?? 0);
}

/** A styled or default value → per-state raw values. */
function statesOf(raw: unknown): StateMap {
  if (isRecord(raw) && isRecord(raw.$states)) return { ...raw.$states };
  if (isRecord(raw) && "$value" in raw) return { default: raw.$value };
  return raw === undefined ? {} : { default: raw };
}

/** Synthetic evaluation path for a styled derivation (never part of the token output). */
export function styledPath(contract: string, variant: string, part: string, prop: string, state: string): string {
  return `components.${contract}${variant}.parts.${part}.${prop}.${state}`;
}

function encodeRaw(
  raw: unknown,
  type: string,
  tokens: ReadonlyMap<string, unknown>,
  derived: ReadonlyMap<string, unknown>,
  synthetic: string,
): unknown {
  const target = aliasTarget(raw);
  if (target !== null) {
    const v = tokens.get(target);
    return isComposite(v) ? resolveComposite(v, tokens, new Set([target])) : (v ?? null);
  }
  if (isRecord(raw) && "$derive" in raw) return derived.get(synthetic) ?? null;
  const decoded = decodeLiteral(type, raw);
  if (!decoded) return raw;
  const enc = encodeValue(decoded);
  return isComposite(enc) ? resolveComposite(enc, tokens, new Set()) : enc;
}

export function resolveComponents(
  contracts: ReadonlyMap<string, Contract>,
  model: ThemeModel,
  ctx: EvalContext,
  tokens: ReadonlyMap<string, unknown>,
  locks: Readonly<Record<string, unknown>>,
  forcedColors: boolean,
  hostSupplied: boolean,
  derived: ReadonlyMap<string, unknown> = new Map(),
): Record<string, unknown> {
  const layers: Record<string, unknown>[] = [model.components];
  for (const o of applicableOverlays(model, ctx)) if (o.components) layers.push(o.components as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const contract of contracts.values()) {
    const known = contract.id.startsWith("std/") || hostSupplied;
    const stylings = known
      ? layers
          .map((l) => l[contract.id])
          .filter((s): s is Record<string, unknown> => isRecord(s) && compatiblePin(s.contract, contract.version))
      : [];
    const entry: Record<string, unknown> = {};
    for (const [part, props] of Object.entries(contract.properties)) {
      const partOut: Record<string, unknown> = {};
      for (const [prop, type] of Object.entries(props)) {
        const defaults = statesOf(contract.defaults?.[part]?.[prop]);
        const merged: StateMap = { ...defaults };
        for (const s of stylings) {
          const parts = isRecord(s.parts) ? s.parts : {};
          const pp = isRecord(parts[part]) ? parts[part] : undefined;
          if (pp && prop in pp) Object.assign(merged, statesOf(pp[prop]));
        }
        const lockKey = `components.${contract.id}.parts.${part}.${prop}`;
        const lock = locks[lockKey];
        const result: Record<string, unknown> = {};
        const states = ["default", ...contract.states.filter((s) => s !== "default" && s in merged)];
        for (const state of states) {
          const raw = lock !== undefined ? lock : merged[state] ?? merged.default;
          let value = encodeRaw(raw, type, tokens, derived, styledPath(contract.id, "", part, prop, state));
          if (forcedColors && type === "color") {
            const def = aliasTarget(defaults[state] ?? defaults.default);
            const role = def ? BASELINE.get(def)?.forcedColor : undefined;
            value = { system: role ?? "canvas-text" };
          }
          result[state] = value;
        }
        partOut[prop] = result;
      }
      entry[part] = partOut;
    }
    const variantsOut: Record<string, unknown> = {};
    for (const s of stylings) {
      if (!isRecord(s.variants)) continue;
      for (const [axis, values] of Object.entries(s.variants)) {
        if (!isRecord(values) || !contract.variants?.[axis]) continue;
        for (const [value, body] of Object.entries(values)) {
          if (!contract.variants[axis]!.includes(value) || !isRecord(body) || !isRecord(body.parts)) continue;
          for (const [part, pprops] of Object.entries(body.parts)) {
            if (!isRecord(pprops)) continue;
            for (const [prop, raw] of Object.entries(pprops)) {
              const type = contract.properties[part]?.[prop];
              if (!type) continue;
              const axisOut = (variantsOut[axis] ??= {}) as Record<string, Record<string, Record<string, Record<string, unknown>>>>;
              const vOut = (axisOut[value] ??= {});
              const partOut = (vOut[part] ??= {});
              const states = statesOf(raw);
              const res: Record<string, unknown> = {};
              for (const [state, sraw] of Object.entries(states)) {
                res[state] = encodeRaw(sraw, type, tokens, derived, styledPath(contract.id, `.$variants.${axis}.${value}`, part, prop, state));
              }
              partOut[prop] = { ...(partOut[prop] ?? {}), ...res };
            }
          }
        }
      }
    }
    if (Object.keys(variantsOut).length > 0) entry.$variants = variantsOut;
    out[contract.id] = entry;
  }
  return out;
}

/** Styled derivations as synthetic declarations, so they evaluate with the token graph. */
export function styledDerivations(
  contracts: ReadonlyMap<string, Contract>,
  model: ThemeModel,
  ctx: EvalContext,
  hostSupplied: boolean,
): { path: string; type: string; raw: unknown }[] {
  const out: { path: string; type: string; raw: unknown }[] = [];
  const layers: Record<string, unknown>[] = [model.components];
  for (const o of applicableOverlays(model, ctx)) if (o.components) layers.push(o.components as Record<string, unknown>);
  for (const contract of contracts.values()) {
    if (!contract.id.startsWith("std/") && !hostSupplied) continue;
    for (const layer of layers) {
      const s = layer[contract.id];
      if (!isRecord(s) || !compatiblePin(s.contract, contract.version)) continue;
      const visit = (parts: unknown, variant: string) => {
        if (!isRecord(parts)) return;
        for (const [part, pp] of Object.entries(parts)) {
          if (!isRecord(pp)) continue;
          for (const [prop, raw] of Object.entries(pp)) {
            const type = contract.properties[part]?.[prop];
            if (!type) continue;
            for (const [state, sraw] of Object.entries(statesOf(raw))) {
              if (isRecord(sraw) && "$derive" in sraw) out.push({ path: styledPath(contract.id, variant, part, prop, state), type, raw: sraw });
            }
          }
        }
      };
      visit(s.parts, "");
      if (isRecord(s.variants)) {
        for (const [axis, values] of Object.entries(s.variants)) {
          if (!isRecord(values)) continue;
          for (const [value, body] of Object.entries(values)) if (isRecord(body)) visit(body.parts, `.$variants.${axis}.${value}`);
        }
      }
    }
  }
  return out;
}
