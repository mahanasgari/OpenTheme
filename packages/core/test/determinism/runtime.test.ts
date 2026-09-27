/**
 * Determinism across runtimes (NFR-C002; SC-C003): result hashes of every resolution fixture
 * match the committed golden hashes, which the browser page (`pnpm bench:core:browser`) checks too.
 * Regenerate after an intended output change with `OT_UPDATE_HASHES=1`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDeterminism } from "../../bench/determinism.js";
import { resolutionCases } from "./cases.js";

const golden = join(dirname(fileURLToPath(import.meta.url)), "hashes.json");

describe("runtime determinism", () => {
  it("matches the golden result hashes", () => {
    const hashes = runDeterminism(resolutionCases());
    if (process.env.OT_UPDATE_HASHES === "1" || !existsSync(golden)) {
      writeFileSync(golden, `${JSON.stringify(hashes, null, 2)}\n`);
    }
    expect(hashes).toEqual(JSON.parse(readFileSync(golden, "utf8")));
    expect(Object.keys(hashes).length).toBeGreaterThan(100);
  });
});
