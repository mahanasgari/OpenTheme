/** The playground page: its controls drive the scope, and its CSS takes every color from the theme. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pageData, prerender } from "../scripts/build.js";
import { mountPlayground, type Playground } from "../src/app.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = pageData();
let app: Playground;
const rule = () =>
  (document.querySelector<HTMLStyleElement>('style[data-opentheme-scope="playground"]')!.sheet!.cssRules[0] as CSSStyleRule).style;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const settle = () => new Promise((r) => setTimeout(r, 0));
const change = (id: string, value: string, type = "change") => {
  const input = $<HTMLInputElement>(id);
  input.value = value;
  input.dispatchEvent(new Event(type));
};

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = "";
  document.body.innerHTML = '<div id="app"></div>';
  app = mountPlayground($("app"), data);
});
afterEach(() => app.dispose());

describe("playground", () => {
  it("renders the controls, preview, and inspector", () => {
    expect($<HTMLSelectElement>("theme").options).toHaveLength(2);
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(100);
    expect($("count").textContent).toMatch(/of \d+/);
    expect(rule().getPropertyValue("--ot-color_surface_base")).toMatch(/^rgb\(/);
  });

  it("switching the theme changes the applied properties", async () => {
    const before = rule().getPropertyValue("--ot-color_action_primary_background");
    change("theme", "org.opentheme.graphite");
    await settle();
    expect((app.scope.controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.graphite");
    expect(rule().getPropertyValue("--ot-color_action_primary_background")).not.toBe(before);
    expect(JSON.parse(localStorage.getItem("opentheme:playground")!)).toMatchObject({ selection: { id: "org.opentheme.graphite" } });
  });

  it("personalization points update the page, and reset clears them", async () => {
    const accent = rule().getPropertyValue("--ot-seed_accent");
    change("accent", "#cc3300", "input");
    await settle();
    expect(rule().getPropertyValue("--ot-seed_accent")).not.toBe(accent);
    const light = rule().getPropertyValue("--ot-color_surface_base");
    change("scheme", "dark");
    await settle();
    expect(rule().getPropertyValue("--ot-color_surface_base")).not.toBe(light);
    change("text-size", "1.5", "input");
    await settle();
    expect(rule().getPropertyValue("--ot-text_body___font-size")).toBe("24px");
    // Core rejects this accent in the dark scheme, and the page says so.
    expect($("status").textContent).toContain("dark");
    expect($("status").textContent).toContain("accent rejected");
    $("reset").click();
    await settle();
    expect(rule().getPropertyValue("--ot-text_body___font-size")).toBe("16px");
    expect($<HTMLSelectElement>("scheme").value).toBe("");
  });

  it("the inspector filters", () => {
    change("filter", "color_action_primary", "input");
    const names = [...document.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
    expect(names.length).toBeGreaterThan(2);
    expect(names.every((n) => n!.includes("color_action_primary"))).toBe(true);
  });
});

describe("page build", () => {
  it("prerenders the default theme's style element", () => {
    expect(prerender(data)).toMatch(/^<style data-opentheme-scope="playground">:root \{ --ot/);
  });

  it("the stylesheet uses theme properties for every color", () => {
    const css = readFileSync(join(here, "../src/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i);
    expect(css).not.toMatch(/:[^;{]*\b(white|black|red|blue|green|gray|grey)\b/i);
  });
});
