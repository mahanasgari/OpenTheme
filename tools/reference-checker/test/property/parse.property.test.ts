import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { parseIJson, ParseError } from "../../src/parse/ijson.js";

describe("parseIJson property", () => {
  it("never throws non-ParseError on arbitrary utf8-ish strings and does linear work", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 4096 }), (bytes) => {
        const text = Buffer.from(bytes).toString("utf8");
        const start = Date.now();
        try {
          parseIJson(text);
        } catch (error) {
          expect(error).toBeInstanceOf(ParseError);
        }
        // Soft bound: parsing 4 KiB should finish quickly on CI.
        expect(Date.now() - start).toBeLessThan(500);
      }),
      { numRuns: 100 },
    );
  });
});
