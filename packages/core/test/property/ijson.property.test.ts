/** Property tests for the parser: agreement with JSON, bounded effort, no pollution. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { JsonParseError, parseIJson } from "../../src/parse/ijson.js";

const LIMITS = { maxBytes: 1_048_576, maxDepth: 16 };

describe("parseIJson properties", () => {
  it("agrees with JSON.parse on I-JSON values", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 10 }), (v) => {
        const text = JSON.stringify(v);
        // Lone surrogates and -0 are outside the comparison: I-JSON rejects the former.
        if (/[\ud800-\udfff]/.test(text)) return;
        expect(JSON.stringify(parseIJson(text, LIMITS))).toBe(text);
      }),
      { numRuns: 2000, seed: 1 },
    );
  });

  it("either parses or throws JsonParseError, quickly, for any string", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => {
        const start = performance.now();
        try {
          parseIJson(s, LIMITS);
        } catch (e) {
          expect(e).toBeInstanceOf(JsonParseError);
        }
        expect(performance.now() - start).toBeLessThan(50);
      }),
      { numRuns: 3000, seed: 2 },
    );
  });

  it("never pollutes Object.prototype and detects every duplicate", () => {
    fc.assert(
      fc.property(fc.constantFrom("__proto__", "constructor", "prototype", "toString"), fc.jsonValue({ maxDepth: 2 }), (k, v) => {
        const once = `{${JSON.stringify(k)}:${JSON.stringify(v)}}`;
        parseIJson(once, LIMITS);
        expect(Object.prototype).not.toHaveProperty("polluted");
        expect(() => parseIJson(`{${JSON.stringify(k)}:1,${JSON.stringify(k)}:2}`, LIMITS)).toThrow(JsonParseError);
      }),
      { numRuns: 500, seed: 3 },
    );
  });
});
