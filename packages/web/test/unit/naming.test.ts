/** Naming contract (contracts/css-output.md "Names"; FR-W002, T006). */
import { describe, expect, it } from "vitest";
import { componentName, memberSuffix, tokenName } from "../../src/naming.js";
import { decodeName } from "../decode.js";
import { read } from "../helpers.js";

interface Contract {
  id: string;
  states: string[];
  variants?: Record<string, string[]>;
  properties: Record<string, Record<string, string>>;
}
const baseline = JSON.parse(read("specification/registry/1.0/semantic-baseline.json")) as { tokens: { path: string }[] };
const catalog = JSON.parse(read("specification/registry/1.0/component-catalog.json")) as { contracts: Contract[] };

describe("naming table", () => {
  it.each([
    ["color.text.primary", "--ot-color_text_primary"],
    ["com.example.notes/color.rail", "--ot-com_example_notes__color_rail"],
    ["focus.ring-width", "--ot-focus_ring-width"],
    ["space.4", "--ot-space_4"],
  ])("token %s", (path, name) => expect(tokenName(path)).toBe(name));

  it("composite members use a kebab-case ___ suffix", () => {
    expect(`${tokenName("text.body")}${memberSuffix("fontSize")}`).toBe("--ot-text_body___font-size");
    expect(memberSuffix("offsetX")).toBe("___offset-x");
    expect(memberSuffix("width")).toBe("___width");
  });

  it("component values and variants", () => {
    expect(componentName("std/button", "container", "background", "hover")).toBe("--otc-std__button_container_background_hover");
    expect(componentName("std/button", "label", "color", "default", { axis: "emphasis", value: "primary" })).toBe(
      "--otc-std__button_v_emphasis_primary_label_color_default",
    );
    expect(componentName("com.example.notes/timeline", "date-label", "text-style", "default")).toBe(
      "--otc-com_example_notes__timeline_date-label_text-style_default",
    );
  });
});

describe("grammar", () => {
  it.each(["Color.text", "color..text", "color.text_primary", "color.-x", "color.te xt", "", "a/b/c", "Bad.Host/a"])(
    "rejects token path %j",
    (path) => expect(tokenName(path)).toBeNull(),
  );
  it.each([
    ["std/button", "My Part", "color", "default"],
    ["std/button", "a_b", "color", "default"],
    ["std/button", "label", "x}y", "default"],
    ["std/button", "label", "color", "HOVER"],
    ["std", "label", "color", "default"],
    ["std/but_ton", "label", "color", "default"],
  ])("rejects component %s %s %s %s", (c, p, q, s) => expect(componentName(c, p, q, s)).toBeNull());
  it("rejects bad variant axes and values and members", () => {
    expect(componentName("std/button", "label", "color", "default", { axis: "Emphasis", value: "primary" })).toBeNull();
    expect(componentName("std/button", "label", "color", "default", { axis: "emphasis", value: "pri mary" })).toBeNull();
    expect(memberSuffix("font-size")).toBeNull();
    expect(memberSuffix("FontSize")).toBeNull();
  });
});

describe("injectivity", () => {
  it("hyphens inside segments never collide with separators", () => {
    expect(tokenName("a.b-c")).not.toBe(tokenName("a-b.c"));
  });

  it("every standard token and component path has a unique, decodable name", () => {
    const names = new Map<string, string>();
    const add = (name: string | null, key: string) => {
      expect(name, key).not.toBeNull();
      expect(names.has(name!), `${key} collides with ${names.get(name!)}`).toBe(false);
      names.set(name!, key);
    };
    for (const t of baseline.tokens) {
      add(tokenName(t.path), t.path);
      expect(decodeName(tokenName(t.path)!)).toEqual({ kind: "token", path: t.path });
    }
    for (const c of catalog.contracts) {
      for (const [part, props] of Object.entries(c.properties)) {
        for (const prop of Object.keys(props)) {
          for (const state of c.states) {
            const name = componentName(c.id, part, prop, state);
            add(name, `${c.id} ${part} ${prop} ${state}`);
            expect(decodeName(name!)).toEqual({ kind: "component", contract: c.id, part, property: prop, state });
            for (const [axis, values] of Object.entries(c.variants ?? {})) {
              for (const value of values) {
                const v = componentName(c.id, part, prop, state, { axis, value });
                add(v, `${c.id} ${axis}=${value} ${part} ${prop} ${state}`);
                expect(decodeName(v!)).toEqual({ kind: "component", contract: c.id, part, property: prop, state, variant: { axis, value } });
              }
            }
          }
        }
      }
    }
    expect(names.size).toBeGreaterThan(1000);
  });
});
