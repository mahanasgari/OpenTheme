/** Bounded I-JSON parsing (chapter 01, chapter 12; research CR3, R14). */
import { describe, expect, it } from "vitest";
import { JsonParseError, parseIJson } from "../../../src/parse/ijson.js";

const L = { maxBytes: 1024, maxDepth: 4 };
const failure = (input: string | Uint8Array, limits = L) => {
  try {
    parseIJson(input, limits);
    return null;
  } catch (e) {
    if (!(e instanceof JsonParseError)) throw e;
    return [e.failure, e.pointer];
  }
};
const nest = (k: number) => "[".repeat(k) + "0" + "]".repeat(k);

describe("parseIJson", () => {
  it("checks the byte length before decoding", () => {
    expect(failure("x".repeat(2000))).toEqual(["bytes", ""]);
    expect(failure(new Uint8Array(2000).fill(0xff))).toEqual(["bytes", ""]);
    expect(failure(`"${"é".repeat(511)}"`)).toBeNull(); // exactly 1,024 bytes
    expect(failure(`"${"é".repeat(512)}"`)).toEqual(["bytes", ""]); // 1,026 bytes
  });

  it("enforces nesting depth during tokenizing", () => {
    expect(failure(nest(4))).toBeNull();
    expect(failure(nest(5))?.[0]).toBe("depth");
    expect(failure(nest(100_000), { maxBytes: 1e6, maxDepth: 16 })?.[0]).toBe("depth");
  });

  it("rejects duplicate members at their pointer", () => {
    expect(failure('{"a":{"b":1,"b":2}}')).toEqual(["duplicate", "/a/b"]);
    expect(failure('{"a~/":1,"a~/":2}')).toEqual(["duplicate", "/a~0~1"]);
  });

  it("rejects what I-JSON forbids", () => {
    for (const bad of ["﻿{}", '"\\ud800"', "1e400", "[1,]", "{'a':1}", "NaN", "01", '"\u0001"', "{} {}"]) {
      expect(failure(bad)?.[0], bad).toBe("syntax");
    }
  });

  it("creates objects without a prototype", () => {
    const v = parseIJson('{"__proto__":{"polluted":true},"constructor":1}', L) as Record<string, unknown>;
    expect(Object.getPrototypeOf(v)).toBeNull();
    expect(Object.keys(v)).toEqual(["__proto__", "constructor"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
