import { describe, expect, it } from "vitest";
import {
  compareDiagnostics,
  compareKernels,
  compareResolved,
  jcsLike,
} from "../src/compare.js";

describe("compare", () => {
  it("ordered (code, location) pairs must match exactly", () => {
    const expected = [
      { code: "OT-REF-003", location: { document: "theme", pointer: "/tokens/a" } },
      { code: "OT-DOC-001", location: { document: "theme", pointer: "/" } },
    ];
    const ok = compareDiagnostics(expected, [
      { code: "OT-REF-003", location: { document: "theme", pointer: "/tokens/a" } },
      { code: "OT-DOC-001", location: { document: "theme", pointer: "/" } },
    ]);
    expect(ok.ok).toBe(true);

    const wrongOrder = compareDiagnostics(expected, [
      { code: "OT-DOC-001", location: { document: "theme", pointer: "/" } },
      { code: "OT-REF-003", location: { document: "theme", pointer: "/tokens/a" } },
    ]);
    expect(wrongOrder.ok).toBe(false);
  });

  it("resolve results compare by JCS bytes", () => {
    const resolved = {
      applied: { id: "a", version: "1.0.0", fallback: "none" },
      tokens: { "seed.accent": { srgb8: [1, 2, 3] } },
    };
    const full = compareResolved(
      { resolved },
      { resolved: { ...resolved } },
    );
    expect(full.ok).toBe(true);

    const mismatch = compareResolved(
      { resolved },
      {
        resolved: {
          ...resolved,
          tokens: { "seed.accent": { srgb8: [9, 9, 9] } },
        },
      },
    );
    expect(mismatch.ok).toBe(false);
  });

  it("subset: true compares only listed members", () => {
    const result = compareResolved(
      {
        subset: true,
        resolved: {
          "applied.id": "uid.abc",
          "context.contrast": "high",
        },
      },
      {
        resolved: {
          applied: { id: "uid.abc", version: "1.0.0", fallback: "none" },
          context: { contrast: "high", colorScheme: "light" },
          tokens: { extra: true },
        },
      },
    );
    expect(result.ok).toBe(true);

    const bad = compareResolved(
      {
        subset: true,
        resolved: { "applied.id": "uid.abc" },
      },
      { resolved: { applied: { id: "other" } } },
    );
    expect(bad.ok).toBe(false);
  });

  it("kernel results must match bit for bit", () => {
    const vectors: Array<[string, string, string]> = [
      ["cbrt", "3FF0000000000000", "3FF0000000000000"],
      ["cbrt", "4000000000000000", "3FF428A2F98D728B"],
    ];
    expect(compareKernels(vectors, [...vectors]).ok).toBe(true);
    expect(
      compareKernels(vectors, [
        vectors[0]!,
        ["cbrt", "4000000000000000", "0000000000000000"],
      ]).ok,
    ).toBe(false);
  });

  it("jcsLike is deterministic for key order", () => {
    expect(jcsLike({ b: 1, a: 2 })).toBe(jcsLike({ a: 2, b: 1 }));
  });
});
