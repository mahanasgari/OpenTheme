/** Names and value shapes outside the contract are omitted and reported (findings W1, W2; T019). */
import type { ResolvedTheme } from "@opentheme/core";
import { describe, expect, it } from "vitest";
import { toDeclarations, toStylesheet } from "../../src/index.js";

const color = { srgb8: [1, 2, 3], alpha: 1 };
const resolved = (components: Record<string, unknown>, tokens: Record<string, unknown> = {}) =>
  ({ tokens, components }) as unknown as ResolvedTheme;

describe("omissions", () => {
  it.each([
    ["part", { "com.example.x/card": { "My Part": { color: { default: color } } } }, "/components/com.example.x~1card/My Part/color/default"],
    ["part with _", { "com.example.x/card": { a_b: { color: { default: color } } } }, "/components/com.example.x~1card/a_b/color/default"],
    ["property", { "com.example.x/card": { body: { "x}y": { default: color } } } }, "/components/com.example.x~1card/body/x}y/default"],
    ["contract", { "com.example.x/Card": { body: { color: { default: color } } } }, "/components/com.example.x~1Card/body/color/default"],
    [
      "variant",
      { "com.example.x/card": { $variants: { "Tone!": { calm: { body: { color: { default: color } } } } } } },
      "/components/com.example.x~1card/$variants/Tone!/calm/body/color/default",
    ],
  ])("a %s outside the grammar", (_what, components, path) => {
    const out = toDeclarations(resolved(components));
    expect(out.declarations).toEqual([]);
    expect(out.omissions).toEqual([{ path, reason: "name-grammar" }]);
  });

  it("a gradient or other unknown shape", () => {
    const gradient = { stops: [{ color, position: 0 }], angle: 90 };
    const out = toDeclarations(
      resolved({ "com.example.x/card": { body: { fill: { default: gradient, hover: "linear-gradient(red, blue)" }, color: { default: color } } } }),
    );
    expect(out.declarations).toEqual([{ name: "--otc-com_example_x__card_body_color_default", value: "rgb(1 2 3)" }]);
    expect(out.omissions).toEqual([
      { path: "/components/com.example.x~1card/body/fill/default", reason: "value-shape" },
      { path: "/components/com.example.x~1card/body/fill/hover", reason: "value-shape" },
    ]);
  });

  it("unresolved composite members and bad token paths", () => {
    const out = toDeclarations(
      resolved({}, { "text.body": { fontSize: { value: 14, unit: "px" }, lineHeight: null }, "Bad.path": color, "font.x": { families: ['a"b'] } }),
    );
    expect(out.declarations).toEqual([{ name: "--ot-text_body___font-size", value: "14px" }]);
    expect(out.omissions).toEqual([
      { path: "/tokens/text.body/lineHeight", reason: "value-shape" },
      { path: "/tokens/Bad.path", reason: "name-grammar" },
      { path: "/tokens/font.x", reason: "value-shape" },
    ]);
  });

  it("the stylesheet never contains an omitted name or value", () => {
    const css = toStylesheet(resolved({ "com.example.x/card": { "x}y": { color: { default: color } }, body: { c: { default: "red;}" } } } }), {
      scope: "s",
      element: true,
    });
    expect(css).toBe('<style data-opentheme-scope="s">[data-opentheme-scope="s"] {  }</style>');
  });
});
