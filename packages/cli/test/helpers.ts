import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS } from "../src/commands/index.js";
import type { Io } from "../src/io.js";
import { run } from "../src/run.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
export const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
export const AURORA = join(ROOT, "specification/themes/reference/org.opentheme.aurora.opentheme.json");
export const GRAPHITE = join(ROOT, "specification/themes/reference/org.opentheme.graphite.opentheme.json");
export const NOTES_HOST = join(ROOT, "specification/hosts/com.example.notes.opentheme-host.json");

/** Runs the CLI in process and captures its output. */
export async function cli(argv: readonly string[], options: { terminal?: boolean; env?: Record<string, string> } = {}) {
  let stdout = "";
  let stderr = "";
  const io: Io = {
    stdout: (t) => {
      stdout += t;
    },
    stderr: (t) => {
      stderr += t;
    },
    isTerminal: options.terminal ?? false,
    env: options.env ?? {},
  };
  const status = await run(argv, io, COMMANDS);
  return { status, stdout, stderr, json: () => JSON.parse(stdout) as Record<string, unknown> };
}

/** A temporary directory with helpers to write JSON files into it. */
export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "opentheme-cli-"));
  return {
    dir,
    file(name: string, content: unknown): string {
      const path = join(dir, name);
      writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
      return path;
    },
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}
