/**
 * `opentheme init <file>` (US6; research LR8; FR-T070): a valid minimal theme from the seed-only
 * example, with a fresh `uid.` identifier (26 base32 characters of 128 random bits, chapter 02).
 * It declares every standard customization point, so user preferences (such as the color scheme)
 * apply once a policy permits them (chapter 09), and `--dark` adds a dark scheme (FR-T071).
 */
import { randomBytes } from "node:crypto";
import { createCore } from "@opentheme/core";
import { parse } from "../args.js";
import { clean, toJson } from "../format.js";
import { MINIMAL_THEME, STANDARD_POINTS } from "../generated/minimal-theme.js";
import { type Io, UsageError, writeOutput } from "../io.js";

const HELP = `Usage: opentheme init <file> [options]

Creates a new, valid, minimal theme (the specification's seed-only example) with a fresh
uid. identifier. It declares every standard customization point, so users' preferences apply.

  --name <name>        Theme name (default "My Theme")
  --dark               Also support a dark color scheme (with its own seeds)
  --force              Overwrite an existing file
  --json               One JSON document
`;

/** Dark seeds for `--dark`: the light example's hues on a dark background (every pair conforms). */
const DARK_SEEDS = {
  background: { colorSpace: "srgb", components: [0.11, 0.11, 0.13] },
  foreground: { colorSpace: "srgb", components: [0.93, 0.93, 0.95] },
  accent: { colorSpace: "oklch", components: [0.72, 0.13, 250] },
};

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** `uid.` + 26 lowercase base32 characters encoding 128 random bits. */
export function newUid(bytes: Uint8Array = randomBytes(16)): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return `uid.${out}`;
}

export function init(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, { name: { type: "string" }, force: { type: "boolean" }, dark: { type: "boolean" } });
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError("init needs exactly one output file");
  const path = positionals[0]!;
  const id = newUid();
  const dark = values.dark === true;
  const seeds = MINIMAL_THEME.seeds as Record<string, unknown>;
  const theme = {
    ...MINIMAL_THEME,
    id,
    version: "1.0.0",
    name: typeof values.name === "string" ? values.name : "My Theme",
    ...(dark ? { colorSchemes: { supported: ["light", "dark"], default: "light" }, seeds: { ...seeds, dark: DARK_SEEDS } } : {}),
    customization: { points: STANDARD_POINTS.map((point) => ({ id: point })) },
  };
  const text = `${JSON.stringify(theme, null, 2)}\n`;
  // The new theme must be valid before it is written (a name outside the display-text rules is not).
  const check = createCore().registry.admit({ kind: "theme", bytes: text, trust: "trusted" });
  if (check.status !== "registered") throw new UsageError(`the new theme would not be valid: ${check.diagnostics.map((d) => d.code).join(", ")}`);
  writeOutput(path, text, values.force === true);
  if (values.json) io.stdout(toJson({ command: "init", path, id, status: 0 }));
  else io.stdout(`created ${clean(path)} (${id})\nnext: opentheme validate ${clean(path)}\n`);
  return 0;
}
