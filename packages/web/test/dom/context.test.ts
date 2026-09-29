/** Live browser context (US2; FR-W010 to FR-W014; T022). */
import type { Core, ThemeController } from "@opentheme/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachTheme, type WebScope } from "../../src/index.js";
import { referenceCore, reset, ruleOf } from "./setup.js";

/** A controllable matchMedia: `flip(query, matches)` fires change events like a browser. */
function stubMedia(initial: Record<string, boolean> = {}) {
  const state = new Map(Object.entries(initial));
  const lists = new Map<string, { listeners: Set<() => void> }>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const entry = lists.get(query) ?? { listeners: new Set<() => void>() };
    lists.set(query, entry);
    return {
      media: query,
      get matches() {
        return state.get(query) === true;
      },
      addEventListener: (_: string, l: () => void) => entry.listeners.add(l),
      removeEventListener: (_: string, l: () => void) => entry.listeners.delete(l),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    flip(query: string, matches: boolean) {
      state.set(query, matches);
      for (const l of lists.get(query)?.listeners ?? []) l();
    },
    listenerCount: () => [...lists.values()].reduce((n, e) => n + e.listeners.size, 0),
    restore: () => {
      window.matchMedia = original;
    },
  };
}

/** Core whose controllers record the context they are created with and every setContext call. */
function countingCore(): { core: Core; calls: () => number; contexts: unknown[]; current: () => unknown } {
  const inner = referenceCore();
  const contexts: unknown[] = [];
  let initial: unknown;
  const wrap = (c: ThemeController): ThemeController =>
    new Proxy({} as ThemeController, {
      get(_, k) {
        if (k === "setContext") return (x: unknown) => (contexts.push(x), c.setContext(x as never));
        const v = Reflect.get(c, k);
        return typeof v === "function" ? v.bind(c) : v;
      },
    });
  const core = new Proxy({} as Core, {
    get(_, k) {
      if (k === "createController") {
        return (o: { context: unknown }) => ((initial = o.context), wrap(inner.createController(o as never)));
      }
      const v = Reflect.get(inner, k);
      return typeof v === "function" ? v.bind(inner) : v;
    },
  });
  return { core, calls: () => contexts.length, contexts, current: () => contexts.at(-1) ?? initial };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const policy = { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" } as const;
let media: ReturnType<typeof stubMedia>;
const live: WebScope[] = [];
const attach = (o: Omit<Parameters<typeof attachTheme>[0], "policy" | "sizeClass" | "store">) => {
  const s = attachTheme({ policy, sizeClass: "medium", store: false, ...o });
  live.push(s);
  return s;
};

beforeEach(reset);
afterEach(() => {
  for (const s of live.splice(0)) s.detach();
  media?.restore();
  reset();
});

describe("media features", () => {
  it("map to Core's context, with defaults when absent", () => {
    media = stubMedia();
    const a = countingCore();
    const s = attach({ core: a.core, target: document, scope: "app" });
    expect(a.current()).toEqual({
      platform: { colorScheme: "no-preference", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
      environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    });
    s.detach();
    media.restore();
    media = stubMedia({
      "(prefers-color-scheme: dark)": true,
      "(prefers-contrast: more)": true,
      "(forced-colors: active)": true,
      "(prefers-reduced-motion: reduce)": true,
    });
    const b = countingCore();
    attach({ core: b.core, target: document, scope: "app" });
    expect(b.current()).toMatchObject({
      platform: { colorScheme: "dark", contrast: "high", forcedColors: true, reducedMotion: true },
    });
    // Forced colors write CSS system colors.
    expect(ruleOf("app")!.style.getPropertyValue("--ot-color_text_primary")).toBe("CanvasText");
  });

  it.each([
    ["(prefers-color-scheme: dark)", { colorScheme: "dark" }],
    ["(prefers-contrast: more)", { contrast: "high" }],
    ["(forced-colors: active)", { forcedColors: true }],
    ["(prefers-reduced-motion: reduce)", { reducedMotion: true }],
  ])("a change of %s causes exactly one setContext; a repeat causes none", (query, platform) => {
    media = stubMedia();
    const { core, calls, contexts } = countingCore();
    const s = attach({ core, target: document, scope: "app" });
    media.flip(query, true);
    expect(calls()).toBe(1);
    expect(contexts[0]).toMatchObject({ platform });
    const before = s.report;
    media.flip(query, true);
    expect(calls()).toBe(1);
    expect(s.report).toBe(before);
    media.flip(query, false);
    expect(calls()).toBe(2);
  });

  it("the user's explicit color scheme stays applied when the system setting changes", async () => {
    media = stubMedia({ "(prefers-color-scheme: light)": true });
    const c = countingCore();
    const s = attach({ core: c.core, target: document, scope: "app" });
    await s.controller.setValue("std.color-scheme", "dark");
    const dark = ruleOf("app")!.style.getPropertyValue("--ot-color_surface_base");
    media.flip("(prefers-color-scheme: light)", false);
    media.flip("(prefers-color-scheme: dark)", true);
    media.flip("(prefers-color-scheme: dark)", false);
    media.flip("(prefers-color-scheme: light)", true);
    expect(ruleOf("app")!.style.getPropertyValue("--ot-color_surface_base")).toBe(dark);
    expect(c.current()).toMatchObject({ platform: { colorScheme: "light" } });
    expect(c.calls()).toBe(4);
  });

  it("detach removes every media listener", () => {
    media = stubMedia();
    const s = attach({ core: referenceCore(), target: document, scope: "app" });
    expect(media.listenerCount()).toBe(5);
    s.detach();
    expect(media.listenerCount()).toBe(0);
  });
});

describe("document attributes and host inputs", () => {
  it("lang and dir on the document or an ancestor update locale and direction", async () => {
    media = stubMedia();
    const el = document.createElement("div");
    const wrapper = document.createElement("div");
    wrapper.append(el);
    document.body.append(wrapper);
    const { core, calls, current } = countingCore();
    attach({ core, target: el, scope: "panel" });
    document.documentElement.setAttribute("lang", "de-CH");
    await tick();
    expect(current()).toMatchObject({ environment: { locale: "de-CH", direction: "ltr" } });
    wrapper.setAttribute("dir", "rtl");
    wrapper.setAttribute("lang", "ar");
    await tick();
    expect(current()).toMatchObject({ environment: { locale: "ar", direction: "rtl" } });
    const n = calls();
    wrapper.setAttribute("lang", "ar");
    await tick();
    expect(calls()).toBe(n);
  });

  it("without a usable lang attribute the locale option is used", async () => {
    media = stubMedia();
    const { core, current } = countingCore();
    attach({ core, target: document, scope: "app", locale: "fr" });
    expect(current()).toMatchObject({ environment: { locale: "fr" } });
    document.documentElement.setAttribute("lang", "not a tag!");
    await tick();
    expect(current()).toMatchObject({ environment: { locale: "fr" } });
  });

  it("setSizeClass and setTextScale update the context and validate their input", () => {
    media = stubMedia();
    const { core, calls, current } = countingCore();
    const s = attach({ core, target: document, scope: "app", textScale: 1.25 });
    expect(current()).toMatchObject({ platform: { textScale: 1.25 } });
    s.setSizeClass("compact");
    s.setTextScale(2);
    expect(current()).toMatchObject({ platform: { textScale: 2 }, environment: { sizeClass: "compact" } });
    expect(s.controller.current.resolved.context).toMatchObject({ sizeClass: "compact", textScale: 2 });
    s.setSizeClass("compact");
    expect(calls()).toBe(2);
    expect(() => s.setTextScale(0)).toThrow(expect.objectContaining({ kind: "invalid-argument" }));
    expect(() => s.setSizeClass("huge" as never)).toThrow(expect.objectContaining({ kind: "invalid-argument" }));
  });
});
