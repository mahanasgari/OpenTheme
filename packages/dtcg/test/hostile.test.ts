/** Hostile inputs are handled without a crash or a hang (FR-D016, SC-D004; T009). */
import { describe, expect, it } from "vitest";
import { importTokens } from "../src/index.js";

const ID = { id: "uid.abcdefghijklmnopqrstuv2345" };

describe("hostile inputs", () => {
  it.each([
    ["not JSON", "{ nope", /not JSON/],
    ["not an object", "[1, 2]", /JSON object/],
    ["a string", '"x"', /JSON object/],
    ["too large", `{"x":"${"a".repeat(1_100_000)}"}`, /larger than/],
  ])("%s", (_n, text, reason) => {
    const r = importTokens(text, ID);
    expect(r.theme).toBeNull();
    expect(r.report.some((e) => reason.test(e.reason))).toBe(true);
  });

  it("invalid UTF-8 is rejected", () => {
    const r = importTokens(new Uint8Array([0x7b, 0xff, 0x7d]), ID);
    expect(r.report.some((e) => /UTF-8/.test(e.reason))).toBe(true);
  });

  it("deep nesting is bounded", () => {
    let doc = '{"$type":"number","$value":1}';
    for (let i = 0; i < 80; i += 1) doc = `{"g":${doc}}`;
    const r = importTokens(doc, ID);
    expect(r.report.some((e) => /nested deeper/.test(e.reason))).toBe(true);
  });

  it("a long alias chain and a large alias cycle finish", () => {
    const n: Record<string, unknown> = { $type: "number", t0: { $value: 1 } };
    for (let i = 1; i < 3000; i += 1) n[`t${i}`] = { $value: `{n.t${i - 1}}` };
    const cyc: Record<string, unknown> = { $type: "number" };
    for (let i = 0; i < 3000; i += 1) cyc[`c${i}`] = { $value: `{cyc.c${(i + 1) % 3000}}` };
    const t0 = Date.now();
    const r = importTokens(JSON.stringify({ n, cyc }), ID);
    expect(Date.now() - t0).toBeLessThan(20_000);
    expect(r.report.filter((e) => /alias cycle/.test(e.reason))).toHaveLength(3000);
  });

  it("__proto__ and constructor names are ordinary names", () => {
    const r = importTokens('{"__proto__":{"$type":"number","$value":1},"constructor":{"$type":"number","$value":2},"toString":{"$type":"number","x":{"$value":3}}}', ID);
    expect(r.theme).not.toBeNull();
    const prim = ((r.theme as Record<string, Record<string, unknown>>).tokens as Record<string, Record<string, unknown>>).primitive!;
    expect(Object.keys(prim).sort()).toEqual(["constructor", "proto", "tostring"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
