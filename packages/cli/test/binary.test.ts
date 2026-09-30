/**
 * The built binary (T029): it runs, its exit statuses match the contract, its output is identical
 * across runs, and it never loads a network, process, or code-evaluation module (FR-T002 to FR-T004).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AURORA, ROOT } from "./helpers.js";

const BIN = join(ROOT, "packages/cli/dist/main.js");
const GUARD = join(ROOT, "packages/cli/test/fixtures/guard.mjs");
const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", GUARD, BIN, ...args], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

describe.skipIf(!existsSync(BIN))("opentheme binary", () => {
  it.each([
    [["--version"], 0],
    [["validate", "--trusted", AURORA], 0],
    [["validate", join(ROOT, "conformance/fixtures/invalid/meta/bad-id.json")], 1],
    [["validate"], 2],
    [["validate", "/no/such.json"], 3],
    [["resolve", "--trusted", AURORA, "--path", "color.text.primary"], 0],
    [["report", "--trusted", AURORA], 0],
    [["css", "--trusted", AURORA], 0],
  ] as const)("%j exits %i and loads no forbidden module", (args, status) => {
    const r = run(...args);
    expect(r.status, r.stderr).toBe(status);
    expect(r.stderr).not.toContain("GUARD:");
  });

  it("prints byte-identical output across runs", () => {
    for (const args of [["resolve", "--json", "--trusted", AURORA], ["css", "--trusted", AURORA, "--scheme", "dark"]]) {
      expect(run(...args).stdout).toBe(run(...args).stdout);
    }
  });

  it("is executable with a shebang", () => {
    const r = spawnSync(BIN, ["--version"], { encoding: "utf8" });
    expect(r.stdout).toMatch(/^opentheme 0\.1\.0-draft\.0 \(Theme Specification 1\.0\.0-draft\.\d+\)\n$/);
  });
});
