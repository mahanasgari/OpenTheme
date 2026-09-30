/** Value encodings both ways (research IR3, IR5; T005). */
import { describe, expect, it } from "vitest";
import { generatedSource } from "../scripts/generate.js";
import { decode, encode } from "../src/values.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const none = () => null;
const keep = (a: string) => `{primitive.${a.slice(1, -1)}}`;
const val = <T>(r: { ok: boolean; value?: T }) => (r.ok ? r.value : undefined);

describe("export encodings", () => {
  it.each([
    ["color", { srgb8: [255, 0, 51], alpha: 1 }, { type: "color", value: { colorSpace: "srgb", components: [1, 0, 0.2], hex: "#ff0033" } }],
    ["color", { srgb8: [0, 0, 0], alpha: 0.45 }, { type: "color", value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.45, hex: "#000000" } }],
    ["dimension", { value: 12, unit: "px" }, { type: "dimension", value: { value: 12, unit: "px" } }],
    ["duration", { value: 200, unit: "ms" }, { type: "duration", value: { value: 200, unit: "ms" } }],
    ["opacity", { number: 0.4 }, { type: "number", value: 0.4 }],
    ["fontWeight", { number: 600 }, { type: "fontWeight", value: 600 }],
    ["fontFamily", { families: ["Inter", "sans-serif"] }, { type: "fontFamily", value: ["Inter", "sans-serif"] }],
    ["cubicBezier", [0.4, 0, 0.2, 1], { type: "cubicBezier", value: [0.4, 0, 0.2, 1] }],
    [
      "typography",
      { fontFamily: { families: ["Inter", "sans-serif"] }, fontSize: { value: 16, unit: "px" }, fontWeight: 400, lineHeight: 1.5 },
      { type: "typography", value: { fontFamily: ["Inter", "sans-serif"], fontSize: { value: 16, unit: "px" }, fontWeight: 400, lineHeight: 1.5 } },
    ],
  ])("%s %j", (type, v, want) => expect(val(encode(type, v))).toEqual(want.value === undefined ? want : want));

  it.each([
    ["color", { system: "canvas" }, /system color/],
    ["density", "standard", /density/],
    ["typography", { fontSize: { value: 16, unit: "px" }, lineHeight: { value: 24, unit: "px" } }, /line height/],
    ["shadow", { offsetX: { value: 0, unit: "px" } }, /missing/],
  ])("%s %j is reported", (type, v, reason) => {
    const r = encode(type, v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });
});

describe("import decodings", () => {
  it.each([
    ["color", { colorSpace: "srgb", components: [1, 0, 0.2], hex: "#ff0033" }, { colorSpace: "srgb", components: [1, 0, 0.2], hex: "#ff0033" }],
    ["color", { colorSpace: "oklch", components: [0.6, 0.1, 250], alpha: 0.5 }, { colorSpace: "oklch", components: [0.6, 0.1, 250], alpha: 0.5 }],
    ["dimension", { value: 4, unit: "px" }, { value: 4, unit: "px" }],
    ["duration", { value: 0.25, unit: "s" }, { value: 250, unit: "ms" }],
    ["fontWeight", "semi-bold", 600],
    ["fontFamily", "Inter", ["Inter"]],
    ["border", { color: "{a.b}", width: { value: 1, unit: "px" }, style: "dashed" }, { color: "{primitive.a.b}", width: { value: 1, unit: "px" }, style: "dashed" }],
    ["shadow", { color: "{c}", offsetX: { value: 0, unit: "px" }, offsetY: { value: 1, unit: "px" }, blur: { value: 2, unit: "px" }, spread: { value: 0, unit: "px" }, inset: false }, { color: "{primitive.c}", offsetX: { value: 0, unit: "px" }, offsetY: { value: 1, unit: "px" }, blur: { value: 2, unit: "px" }, spread: { value: 0, unit: "px" } }],
  ])("%s %j", (type, v, want) => expect((val(decode(type, v, keep)) as { value: unknown }).value).toEqual(want));

  it("reports exact conversions", () => {
    const r = decode("duration", { value: 0.25, unit: "s" }, keep);
    expect(r.ok && r.note).toBe("0.25s converted to 250ms");
    expect(decode("fontWeight", "bold", keep)).toMatchObject({ note: 'font weight "bold" converted to 700' });
  });

  it.each([
    ["dimension", { value: 1, unit: "rem" }, /rem/],
    ["duration", { value: 0.0005, unit: "s" }, /exact/],
    ["color", "#ff0000", /string color/],
    ["color", { colorSpace: "display-p3", components: [1, 0, 0] }, /display-p3/],
    ["color", { colorSpace: "srgb", components: ["none", 0, 0] }, /none/],
    ["strokeStyle", { dashArray: [], lineCap: "round" }, /object stroke/],
    ["strokeStyle", "double", /double/],
    ["shadow", [{}], /list of shadows/],
    ["shadow", { inset: true }, /inset/],
    ["gradient", [], /gradient/],
    ["transition", {}, /transition/],
    ["color", { $ref: "#/x" }, /\$ref/],
    ["color", "{gone}", /left out/],
    ["typography", { fontFamily: "A", textDecoration: "none" }, /textDecoration/],
  ])("%s %j is left out", (type, v, reason) => {
    const r = decode(type, v, type === "color" && v === "{gone}" ? none : keep);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });
});

describe("generated data", () => {
  it("is current", () => expect(readFileSync(join(here, "../src/generated/data.ts"), "utf8")).toBe(generatedSource()));
});
