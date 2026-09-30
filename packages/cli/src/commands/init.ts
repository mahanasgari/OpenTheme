/**
 * `opentheme init <file>` (US6; research LR8; FR-T070): a valid minimal theme from the seed-only
 * example, with a fresh `uid.` identifier (26 base32 characters of 128 random bits, chapter 02).
 */
import { randomBytes } from "node:crypto";
import { createCore } from "@opentheme/core";
import { parse } from "../args.js";
import { toJson } from "../format.js";
import { MINIMAL_THEME } from "../generated/minimal-theme.js";
import { type Io, UsageError, writeOutput } from "../io.js";

const HELP = `Usage: opentheme init <file> [options]

Creates a new, valid, minimal theme (the specification's seed-only example) with a fresh
uid. identifier.

  --name <name>        Theme name (default "My Theme")
  --force              Overwrite an existing file
  --json               One JSON document
`;

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
  const { values, positionals } = parse(argv, { name: { type: "string" }, force: { type: "boolean" } });
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (positionals.length !== 1) throw new UsageError("init needs exactly one output file");
  const path = positionals[0]!;
  const id = newUid();
  const theme = { ...MINIMAL_THEME, id, version: "1.0.0", name: typeof values.name === "string" ? values.name : "My Theme" };
  const text = `${JSON.stringify(theme, null, 2)}\n`;
  // The new theme must be valid before it is written (a name outside the display-text rules is not).
  const check = createCore().registry.admit({ kind: "theme", bytes: text, trust: "trusted" });
  if (check.status !== "registered") throw new UsageError(`the new theme would not be valid: ${check.diagnostics.map((d) => d.code).join(", ")}`);
  writeOutput(path, text, values.force === true);
  if (values.json) io.stdout(toJson({ command: "init", path, id, status: 0 }));
  else io.stdout(`created ${path} (${id})\nnext: opentheme validate ${path}\n`);
  return 0;
}
