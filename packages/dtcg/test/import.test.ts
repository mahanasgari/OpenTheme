/** Import (US2; FR-D010 to FR-D016; T008). */
import { describe, expect, it } from "vitest";
import { importTokens } from "../src/index.js";

type Rec = Record<string, unknown>;
const ID = "uid.abcdefghijklmnopqrstuv2345";
const c = (r: number, g: number, b: number) => ({ colorSpace: "srgb", components: [r, g, b] });
const run = (doc: unknown, options: Parameters<typeof importTokens>[1] = {}) => importTokens(JSON.stringify(doc), { id: ID, ...options });
const prim = (r: ReturnType<typeof importTokens>) => ((r.theme as Rec).tokens as Rec).primitive as Rec;
const actions = (r: ReturnType<typeof importTokens>, path: string) => r.report.filter((e) => e.path === path).map((e) => e.action);

const BRAND = {
  brand: {
    $type: "color",
    ink: { $value: c(0.1, 0.1, 0.12) },
    paper: { $value: c(0.98, 0.98, 0.97) },
    accent: { $value: c(0.2, 0.3, 0.8), $description: "Primary brand color" },
    link: { $value: "{brand.accent}" },
  },
  space: { $type: "dimension", Small: { $value: { value: 4, unit: "px" } }, "Extra Large!": { $value: { value: 32, unit: "px" } } },
  motion: { quick: { $type: "duration", $value: { value: 0.1, unit: "s" } } },
};

describe("importTokens", () => {
  it("imports under primitive with group types, aliases, and descriptions", () => {
    const r = run(BRAND);
    expect(r.diagnostics).toEqual([]);
    expect(r.theme).not.toBeNull();
    const p = prim(r);
    expect(p.brand).toMatchObject({
      ink: { $type: "color", $value: c(0.1, 0.1, 0.12) },
      accent: { $type: "color", $description: "Primary brand color" },
      link: { $type: "color", $value: "{primitive.brand.accent}" },
    });
    expect(p.space).toEqual({ small: { $type: "dimension", $value: { value: 4, unit: "px" } }, "extra-large": { $type: "dimension", $value: { value: 32, unit: "px" } } });
    expect(p.motion).toEqual({ quick: { $type: "duration", $value: { value: 100, unit: "ms" } } });
    expect(actions(r, "space.Small")).toEqual(["renamed"]);
    expect(actions(r, "motion.quick")).toEqual(["converted"]);
    expect(r.text!.endsWith("}\n")).toBe(true);
    expect((r.theme as Rec).provenance).toEqual({ origin: "imported" });
  });

  it("uses the default seeds, reported, without a mapping", () => {
    const r = run(BRAND);
    expect((r.theme as Rec).colorSchemes).toEqual({ supported: ["light"], default: "light" });
    expect(actions(r, "seed.light")).toEqual(["defaulted"]);
  });

  it("maps seeds and roles", () => {
    const r = run(BRAND, {
      mapping: {
        "seed.light.background": "brand.paper",
        "seed.light.foreground": "brand.ink",
        "seed.light.accent": "brand.link",
        "color.text.primary": "brand.ink",
        "space.1": "space.Small",
      },
    });
    expect(r.diagnostics).toEqual([]);
    const t = r.theme as Rec;
    expect((t.seeds as Rec).light).toEqual({ background: c(0.98, 0.98, 0.97), foreground: c(0.1, 0.1, 0.12), accent: c(0.2, 0.3, 0.8) });
    expect(((t.tokens as Rec).color as Rec).text).toEqual({ primary: { $value: "{primitive.brand.ink}" } });
    expect(((t.tokens as Rec).space as Rec)["1"]).toEqual({ $value: "{primitive.space.small}" });
  });

  it.each([
    [{ "color.text.primary": "space.Small" }, /dimension, the role is a color/],
    [{ "color.text.primary": "nope" }, /not an imported token/],
    [{ "seed.light.background": "brand.paper" }, /incomplete/],
    [{ "seed.light.background": "space.Small" }, /not a color/],
    [{ "seed.background": "brand.paper" }, /not a seed or a semantic baseline role/],
  ])("rejects the mapping %j", (mapping, reason) => {
    const r = run(BRAND, { mapping });
    expect(r.theme).toBeNull();
    expect(r.report.some((e) => e.path.startsWith("mapping:") && reason.test(e.reason))).toBe(true);
  });

  it("leaves out and reports what OpenTheme cannot represent, never approximating", () => {
    const r = run({
      a: { $type: "dimension", rem: { $value: { value: 1, unit: "rem" } } },
      b: { $type: "color", p3: { $value: { colorSpace: "display-p3", components: [1, 0, 0] } } },
      g: { $type: "gradient", x: { $value: [] } },
      t: { $type: "transition", x: { $value: {} } },
      s: { $type: "shadow", list: { $value: [] } },
      u: { $value: 3 },
      ok: { $type: "number", $value: 1.5 },
      uses: { $type: "dimension", $value: "{a.rem}" },
      dangling: { $type: "number", $value: "{no.where}" },
    });
    expect(r.theme).not.toBeNull();
    const p = prim(r);
    expect(Object.keys(p)).toEqual(["ok"]);
    for (const path of ["a.rem", "b.p3", "g.x", "t.x", "s.list", "u", "uses", "dangling"]) expect(actions(r, path), path).toEqual(["left-out"]);
  });

  it("leaves out collisions and alias cycles", () => {
    const r = run({ x: { $type: "number", "A B": { $value: 1 }, "a-b": { $value: 2 } }, y: { $type: "number", one: { $value: "{y.two}" }, two: { $value: "{y.one}" } }, z: { $type: "number", $value: 7 } });
    expect(Object.keys(prim(r))).toEqual(["z"]);
    expect(r.report.filter((e) => e.action === "left-out").map((e) => e.path)).toEqual(["x.A B", "x.a-b", "y.one", "y.two"]);
  });

  it("restores kept derivations only when asked and resolvable", () => {
    const doc = {
      color: {
        $type: "color",
        base: { $value: c(0.2, 0.3, 0.8) },
        soft: {
          $value: c(0.5, 0.5, 0.9),
          $extensions: { "org.opentheme": { derive: { op: "color.mix", args: { color: "{color.base}", toward: "{color.base}", ratio: 0.5 } } }, "com.figma": { id: 1 } },
        },
        lost: { $value: c(0.5, 0.5, 0.9), $extensions: { "org.opentheme": { derive: { op: "color.mix", args: { color: "{color.gone}", toward: "{color.base}", ratio: 0.5 } } } } },
      },
    };
    const kept = run(doc);
    expect((prim(kept).color as Rec).soft).toMatchObject({ $value: c(0.5, 0.5, 0.9) });
    expect(actions(kept, "color.soft")).toEqual(["kept-computed"]);
    expect(kept.report.some((e) => e.action === "dropped-extensions")).toBe(true);
    const restored = run(doc, { restoreDerivations: true });
    expect((prim(restored).color as Rec).soft).toEqual({
      $type: "color",
      $derive: { op: "color.mix", args: { color: "{primitive.color.base}", toward: "{primitive.color.base}", ratio: 0.5 } },
    });
    expect(actions(restored, "color.soft")).toEqual(["restored"]);
    expect(actions(restored, "color.lost")).toEqual(["kept-computed"]);
  });

  it("keeps $deprecated and reports a dropped message", () => {
    const r = run({ n: { $type: "number", old: { $value: 1, $deprecated: "use n.new" }, gone: { $value: 2, $deprecated: true } } });
    expect(prim(r).n).toEqual({ gone: { $type: "number", $value: 2, $deprecated: true }, old: { $type: "number", $value: 1, $deprecated: true } });
    expect(actions(r, "n.old")).toEqual(["converted"]);
  });

  it("returns no theme when Core rejects it", () => {
    const r = run({ n: { $type: "number", x: { $value: 1 } } }, { id: "Not An Id" });
    expect(r.theme).toBeNull();
    expect(r.diagnostics.map((d) => d.code)).toContain("OT-META-001");
  });

  it("is deterministic with an id", () => expect(run(BRAND).text).toBe(run(BRAND).text));
});
