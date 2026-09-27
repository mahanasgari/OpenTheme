/** The shipped schemas (NFR-C006) are the specification's, byte for byte. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../helpers.js";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : n.endsWith(".json") ? [join(dir, n)] : []));

describe("shipped schemas", () => {
  it("equal specification/schemas exactly", () => {
    const source = join(ROOT, "specification/schemas");
    const shipped = join(ROOT, "packages/core/schemas");
    const a = walk(source).map((f) => relative(source, f)).sort();
    expect(walk(shipped).map((f) => relative(shipped, f)).sort()).toEqual(a);
    for (const f of a) expect(readFileSync(join(shipped, f), "utf8"), f).toBe(readFileSync(join(source, f), "utf8"));
  });
});
