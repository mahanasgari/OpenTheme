/** FR-R011: the built module starts with the "use client" directive. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("use client directive", () => {
  beforeAll(() => {
    execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], { cwd: pkg, stdio: "pipe" });
  }, 120_000);

  it("is the first statement of dist/index.js", () => {
    const first = readFileSync(join(pkg, "dist/index.js"), "utf8").split("\n")[0];
    expect(first).toBe('"use client";');
  });
});
