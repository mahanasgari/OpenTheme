/**
 * Declaration sets (data-model §1 and §2; research WR10; FR-W001, FR-W004).
 *
 * Only `resolved.tokens` and `resolved.components` are written. A path whose name falls outside
 * the grammar, or whose value has no serializer, is omitted and reported by JSON pointer.
 */
import type { ResolvedTheme } from "@opentheme/core";
import { componentName, memberSuffix, tokenName, type VariantKey } from "./naming.js";
import { isCompositeValue, serializeLeaf, serializeShorthand } from "./serialize.js";

export interface Declaration {
  readonly name: string;
  readonly value: string;
}

export interface Omission {
  /** JSON pointer into the Resolved Theme. */
  readonly path: string;
  readonly reason: "name-grammar" | "value-shape";
}

export interface DeclarationSet {
  readonly declarations: readonly Declaration[];
  readonly omissions: readonly Omission[];
}

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const esc = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

/** The final guard (T020): names and values only from the contract's character sets. */
const SAFE_NAME = /^--otc?-[a-z0-9_-]+$/;
const SAFE_VALUE = /^[A-Za-z0-9 ._,()/"\\+-]+$/;

export function toDeclarations(resolved: ResolvedTheme): DeclarationSet {
  const declarations: Declaration[] = [];
  const omissions: Omission[] = [];

  const push = (name: string, value: string | null, path: string) => {
    if (value === null || !SAFE_VALUE.test(value) || !SAFE_NAME.test(name)) omissions.push({ path, reason: "value-shape" });
    else declarations.push({ name, value });
  };

  const emit = (name: string | null, v: unknown, path: string) => {
    if (name === null) {
      omissions.push({ path, reason: "name-grammar" });
      return;
    }
    if (!isCompositeValue(v)) {
      push(name, serializeLeaf(v), path);
      return;
    }
    for (const [member, mv] of Object.entries(v)) {
      if (member === "physical") continue; // affects resolution only (contracts/css-output.md)
      const suffix = memberSuffix(member);
      if (suffix === null) omissions.push({ path: `${path}/${esc(member)}`, reason: "name-grammar" });
      else push(name + suffix, serializeLeaf(mv), `${path}/${esc(member)}`);
    }
    const shorthand = serializeShorthand(v);
    if (shorthand !== null) push(name, shorthand, path);
  };

  const tokens = isRecord(resolved.tokens) ? resolved.tokens : {};
  for (const [path, v] of Object.entries(tokens)) emit(tokenName(path), v, `/tokens/${esc(path)}`);

  const parts = (contract: string, body: Rec, base: string, variant?: VariantKey) => {
    for (const [part, props] of Object.entries(body)) {
      if (!variant && part === "$variants") continue;
      if (!isRecord(props)) continue;
      for (const [prop, states] of Object.entries(props)) {
        if (!isRecord(states)) continue;
        for (const [state, v] of Object.entries(states)) {
          const path = `${base}/${esc(part)}/${esc(prop)}/${esc(state)}`;
          emit(componentName(contract, part, prop, state, variant), v, path);
        }
      }
    }
  };

  const components = isRecord(resolved.components) ? resolved.components : {};
  for (const [contract, entry] of Object.entries(components)) {
    if (!isRecord(entry)) continue;
    const base = `/components/${esc(contract)}`;
    parts(contract, entry, base);
    const variants = entry.$variants;
    if (!isRecord(variants)) continue;
    for (const [axis, values] of Object.entries(variants)) {
      if (!isRecord(values)) continue;
      for (const [value, body] of Object.entries(values)) {
        if (isRecord(body)) parts(contract, body, `${base}/$variants/${esc(axis)}/${esc(value)}`, { axis, value });
      }
    }
  }

  declarations.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { declarations, omissions };
}
