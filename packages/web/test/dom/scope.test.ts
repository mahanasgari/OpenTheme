/** Scopes (FR-W005, FR-W007, FR-W031 to FR-W033; T013). */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachTheme as attach, OpenThemeWebError, type WebScope } from "../../src/index.js";
import { AURORA_POLICY, referenceCore, reset, ruleOf, spyWrites } from "./setup.js";

const base = { policy: AURORA_POLICY, sizeClass: "medium", store: false } as const;

const live: WebScope[] = [];
const attachTheme = (o: Parameters<typeof attach>[0]) => {
  const s = attach(o);
  live.push(s);
  return s;
};

beforeEach(reset);
afterEach(() => {
  for (const s of live.splice(0)) s.detach();
  reset();
});

describe("scopes", () => {
  it("the document scope writes one :root rule", () => {
    const s = attachTheme({ ...base, core: referenceCore(), target: document, scope: "app" });
    const els = document.querySelectorAll("style[data-opentheme-scope]");
    expect(els).toHaveLength(1);
    const sheet = (els[0] as HTMLStyleElement).sheet!;
    expect(sheet.cssRules).toHaveLength(1);
    expect((sheet.cssRules[0] as CSSStyleRule).selectorText).toBe(":root");
    expect(ruleOf("app")!.style.getPropertyValue("--ot-color_text_primary")).toMatch(/^rgb\(/);
    expect(s.report.omissions).toEqual([]);
    expect(s.report.set).toBeGreaterThan(300);
    s.detach();
  });

  it("element scopes see only their own values", async () => {
    const a = document.createElement("section");
    const b = document.createElement("aside");
    document.body.append(a, b);
    const core = referenceCore();
    const sa = attachTheme({ ...base, core, target: a, scope: "main" });
    const sb = attachTheme({ ...base, core, target: b, scope: "side", policy: { preset: "closed", defaultTheme: "org.opentheme.graphite" } });
    expect(a.getAttribute("data-opentheme-scope")).toBe("main");
    expect(ruleOf("main")!.selectorText).toBe('[data-opentheme-scope="main"]');
    expect(ruleOf("side")!.selectorText).toBe('[data-opentheme-scope="side"]');
    const pa = ruleOf("main")!.style.getPropertyValue("--ot-color_surface_base");
    const pb = ruleOf("side")!.style.getPropertyValue("--ot-color_surface_base");
    expect(pa).toMatch(/^rgb\(/);
    expect(pb).toMatch(/^rgb\(/);
    expect(pa).not.toBe(pb);
    sa.detach();
    sb.detach();
  });

  it("an update sets and removes only changed properties", async () => {
    const s = attachTheme({ ...base, core: referenceCore(), target: document, scope: "app", policy: { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" } });
    const writes = spyWrites("app");
    try {
      s.controller.setContext({ platform: { colorScheme: "dark" } } as never);
      expect(writes.set).toBe(s.report.set);
      expect(writes.removed).toBe(s.report.removed);
      expect(writes.set).toBeGreaterThan(0);
      writes.reset();
      await s.controller.select({ id: "org.opentheme.graphite" });
      expect(writes.set).toBe(s.report.set);
      expect(writes.set).toBeLessThan(700);
      writes.reset();
      s.controller.setContext({});
      expect(writes.set + writes.removed).toBe(0);
    } finally {
      writes.restore();
      s.detach();
    }
  });

  it("detach removes everything and is idempotent", async () => {
    const el = document.createElement("div");
    document.body.append(el);
    const s = attach({ ...base, core: referenceCore(), target: el, scope: "panel" });
    s.detach();
    s.detach();
    expect(document.querySelector("style[data-opentheme-scope]")).toBeNull();
    expect(el.hasAttribute("data-opentheme-scope")).toBe(false);
    await expect(s.controller.select({ id: "org.opentheme.aurora" })).rejects.toThrow(/disposed/);
    // The target can be attached again after detach.
    attach({ ...base, core: referenceCore(), target: el, scope: "panel" }).detach();
  });

  it("refuses a managed target or a reused scope id", () => {
    const core = referenceCore();
    const s = attachTheme({ ...base, core, target: document, scope: "app" });
    const conflict = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        expect(e).toBeInstanceOf(OpenThemeWebError);
        expect((e as OpenThemeWebError).kind).toBe("scope-conflict");
        return;
      }
      throw new Error("expected scope-conflict");
    };
    conflict(() => attachTheme({ ...base, core, target: document, scope: "other" }));
    const el = document.createElement("div");
    document.body.append(el);
    conflict(() => attachTheme({ ...base, core, target: el, scope: "app" }));
    expect(el.hasAttribute("data-opentheme-scope")).toBe(false);
    s.detach();
  });

  it.each(["", "App", "1app", "a b", 'x"]', "a_b"])("refuses the scope id %j", (id) => {
    expect(() => attachTheme({ ...base, core: referenceCore(), target: document, scope: id })).toThrow(
      expect.objectContaining({ kind: "invalid-argument" }),
    );
    expect(document.querySelector("style[data-opentheme-scope]")).toBeNull();
  });
});
