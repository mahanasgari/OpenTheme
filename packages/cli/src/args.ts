/**
 * Command-line options (contracts/cli.md; data-model §2): parsing with Node's parseArgs, and
 * validation of every value against Core's schema before anything is resolved (exit status 2).
 */
import { parseArgs, type ParseArgsConfig } from "node:util";
import type { ControllerContext, UntrustedSource } from "@opentheme/core";
import { UsageError } from "./io.js";

type Options = NonNullable<ParseArgsConfig["options"]>;

export const GLOBAL_OPTIONS: Options = {
  json: { type: "boolean" },
  "no-color": { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

export const INPUT_OPTIONS: Options = {
  trusted: { type: "boolean" },
  source: { type: "string" },
  base: { type: "string", multiple: true },
  host: { type: "string" },
  "relaxed-gate": { type: "boolean" },
};

export const CONTEXT_OPTIONS: Options = {
  scheme: { type: "string" },
  contrast: { type: "string" },
  "forced-colors": { type: "boolean" },
  "reduced-motion": { type: "boolean" },
  "text-scale": { type: "string" },
  size: { type: "string" },
  locale: { type: "string" },
  dir: { type: "string" },
};

export type Values = Record<string, string | boolean | string[] | undefined>;

export function parse(argv: readonly string[], options: Options): { values: Values; positionals: string[] } {
  try {
    const r = parseArgs({ args: [...argv], options: { ...GLOBAL_OPTIONS, ...options }, allowPositionals: true, strict: true });
    return { values: r.values as Values, positionals: r.positionals };
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
}

function oneOf<T extends string>(name: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new UsageError(`--${name} must be one of: ${allowed.join(", ")}`);
}

const SOURCES: readonly UntrustedSource[] = ["user-created", "imported", "shared", "ai-generated"];
const BCP47 = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export interface InputOptions {
  readonly trusted: boolean;
  readonly source: UntrustedSource;
  readonly bases: readonly string[];
  readonly host: string | undefined;
  readonly relaxedGate: boolean;
}

export function inputOptions(v: Values): InputOptions {
  return {
    trusted: v.trusted === true,
    source: oneOf("source", v.source, SOURCES, "user-created"),
    bases: Array.isArray(v.base) ? v.base : [],
    host: typeof v.host === "string" ? v.host : undefined,
    relaxedGate: v["relaxed-gate"] === true,
  };
}

/** The resolution context with the documented defaults (data-model §2). */
export function contextOptions(v: Values): ControllerContext {
  let textScale = 1;
  if (v["text-scale"] !== undefined) {
    textScale = Number(v["text-scale"]);
    if (!Number.isFinite(textScale) || textScale <= 0) throw new UsageError("--text-scale must be a positive number");
  }
  const locale = typeof v.locale === "string" ? v.locale : "en";
  if (locale.length > 64 || !BCP47.test(locale)) throw new UsageError("--locale must be a BCP 47 language tag");
  return {
    platform: {
      colorScheme: oneOf("scheme", v.scheme, ["light", "dark", "no-preference"] as const, "light"),
      contrast: oneOf("contrast", v.contrast, ["standard", "high"] as const, "standard"),
      forcedColors: v["forced-colors"] === true,
      reducedMotion: v["reduced-motion"] === true,
      textScale,
    },
    environment: {
      sizeClass: oneOf("size", v.size, ["compact", "medium", "expanded"] as const, "medium"),
      locale,
      direction: oneOf("dir", v.dir, ["ltr", "rtl"] as const, "ltr"),
    },
  };
}

export function presetOption(v: Values): "closed" | "common-personalization" | undefined {
  return v.preset === undefined ? undefined : oneOf("preset", v.preset, ["closed", "common-personalization"] as const, "closed");
}
