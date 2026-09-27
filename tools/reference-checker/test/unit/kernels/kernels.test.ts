import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyKernel,
  toHex64,
  type KernelName,
} from "../../../src/kernels/index.js";

const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../conformance/fixtures/kernels",
);

type KernelFixture = {
  kind: string;
  expect: { vectors: [string, string, string][] };
};

describe("kernel golden vectors", () => {
  let files: string[] = [];
  try {
    files = readdirSync(ROOT).filter((f) => f.endsWith(".json"));
  } catch {
    files = [];
  }

  it("has kernel fixture files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`replays ${file}`, () => {
      const fixture = JSON.parse(
        readFileSync(join(ROOT, file), "utf8"),
      ) as KernelFixture;
      expect(fixture.kind).toBe("kernel");
      expect(fixture.expect.vectors.length).toBeGreaterThan(0);
      for (const [fn, inputHex, outputHex] of fixture.expect.vectors) {
        const out = applyKernel(fn as KernelName, hexToNumber(inputHex));
        expect(toHex64(out), `${fn}(${inputHex})`).toBe(outputHex.toUpperCase());
      }
    });
  }
});

function hexToNumber(hex: string): number {
  const buf = new ArrayBuffer(8);
  const u = new Uint8Array(buf);
  for (let i = 0; i < 8; i += 1) {
    u[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return new DataView(buf).getFloat64(0, false);
}
