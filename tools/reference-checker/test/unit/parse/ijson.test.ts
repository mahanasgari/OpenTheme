import { describe, expect, it } from "vitest";
import { parseIJson, ParseError } from "../../../src/parse/ijson.js";

describe("parseIJson", () => {
  it("parses a minimal object", () => {
    const result = parseIJson('{"a":1}');
    expect(result.value).toEqual({ a: 1 });
  });

  it("rejects a UTF-8 BOM", () => {
    expect(() => parseIJson('\uFEFF{"a":1}')).toThrow(ParseError);
    try {
      parseIJson('\uFEFF{"a":1}');
    } catch (error) {
      expect((error as ParseError).code).toBe("OT-DOC-001");
    }
  });

  it("rejects documents larger than 1 MiB before parsing", () => {
    const huge = `{"x":"${"a".repeat(1_048_577)}"}`;
    expect(() => parseIJson(huge)).toThrow(ParseError);
    try {
      parseIJson(huge);
    } catch (error) {
      expect((error as ParseError).code).toBe("OT-LIM-001");
    }
  });

  it("rejects duplicate member names", () => {
    expect(() => parseIJson('{"a":1,"a":2}')).toThrow(ParseError);
    try {
      parseIJson('{"a":1,"a":2}');
    } catch (error) {
      expect((error as ParseError).code).toBe("OT-DOC-002");
    }
  });

  it("rejects nesting deeper than 16", () => {
    const deep = `${"[".repeat(17)}0${"]".repeat(17)}`;
    expect(() => parseIJson(deep)).toThrow(ParseError);
    try {
      parseIJson(deep);
    } catch (error) {
      expect((error as ParseError).code).toBe("OT-LIM-002");
    }
  });

  it("accepts nesting of depth 16", () => {
    const ok = `${"[".repeat(16)}0${"]".repeat(16)}`;
    expect(() => parseIJson(ok)).not.toThrow();
  });

  it("rejects non-finite / non-I-JSON number tokens", () => {
    expect(() => parseIJson('{"a":01}')).toThrow(ParseError);
  });

  it("treats __proto__ as an ordinary member", () => {
    const result = parseIJson('{"__proto__":1}');
    expect(Object.getPrototypeOf(result.value)).toBe(null);
    expect((result.value as { __proto__: number }).__proto__).toBe(1);
  });

  it("accepts binary64-representable integers", () => {
    const result = parseIJson('{"n":9007199254740991}');
    expect(result.value).toEqual({ n: 9007199254740991 });
  });

  it("rejects lone surrogates in strings", () => {
    expect(() => parseIJson('{"a":"\\uD800"}')).toThrow(ParseError);
  });
});
