/** Persistence (US3; FR-W020 to FR-W023; T026). */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachTheme, createBrowserStore, type WebScope } from "../../src/index.js";
import { referenceCore, reset } from "./setup.js";

const policy = { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" } as const;
const live: WebScope[] = [];
const attach = (o: Omit<Parameters<typeof attachTheme>[0], "policy" | "sizeClass" | "core" | "target">) => {
  const s = attachTheme({ core: referenceCore(), target: document, policy, sizeClass: "medium", ...o });
  live.push(s);
  return s;
};
const appliedId = (s: WebScope) => (s.controller.current.resolved.applied as { id: string }).id;
const settle = () => new Promise((r) => setTimeout(r, 0));

/** A Storage whose every access throws, like disabled storage or a sandboxed frame. */
const throwing = new Proxy({} as Storage, {
  get() {
    return () => {
      throw new DOMException("denied", "SecurityError");
    };
  },
});

beforeEach(() => {
  reset();
  localStorage.clear();
});
afterEach(() => {
  for (const s of live.splice(0)) s.detach();
  reset();
});

describe("browser store", () => {
  it("reads, writes, and clears opentheme:<scope>, or a custom prefix", async () => {
    const store = createBrowserStore();
    await store.write("app", "bytes");
    expect(localStorage.getItem("opentheme:app")).toBe("bytes");
    expect(await store.read("app")).toBe("bytes");
    expect(store.readInitial("app")).toBe("bytes");
    await store.clear("app");
    expect(localStorage.getItem("opentheme:app")).toBeNull();
    expect(store.readInitial("app")).toBeNull();
    const custom = createBrowserStore({ prefix: "acme/" });
    await custom.write("app", "x");
    expect(localStorage.getItem("acme/app")).toBe("x");
  });

  it("storage exceptions reject, and readInitial throws", async () => {
    const store = createBrowserStore({ storage: throwing });
    await expect(store.read("app")).rejects.toThrow();
    await expect(store.write("app", "x")).rejects.toThrow();
    await expect(store.clear("app")).rejects.toThrow();
    expect(() => store.readInitial("app")).toThrow();
  });
});

describe("scopes persist preferences", () => {
  it("a re-attached scope's first resolution uses the stored selection", async () => {
    const s = attach({ scope: "app" });
    await s.controller.select({ id: "org.opentheme.graphite" });
    expect(JSON.parse(localStorage.getItem("opentheme:app")!)).toMatchObject({ selection: { id: "org.opentheme.graphite" } });
    s.detach();
    const t = attach({ scope: "app" });
    expect(appliedId(t)).toBe("org.opentheme.graphite");
  });

  it("two scopes do not overwrite each other", async () => {
    const a = document.createElement("div");
    document.body.append(a);
    const main = attach({ scope: "main" });
    const side = attachTheme({ core: referenceCore(), target: a, scope: "side", policy, sizeClass: "medium" });
    live.push(side);
    await main.controller.select({ id: "org.opentheme.graphite" });
    await side.controller.setValue("std.color-scheme", "dark");
    expect(JSON.parse(localStorage.getItem("opentheme:main")!)).toMatchObject({ selection: { id: "org.opentheme.graphite" } });
    expect(JSON.parse(localStorage.getItem("opentheme:side")!)).toMatchObject({ values: { "std.color-scheme": "dark" } });
    expect(JSON.parse(localStorage.getItem("opentheme:side")!).selection ?? null).toBeNull();
  });

  it("failing storage still applies and reports store-read-failed and store-write-failed", async () => {
    const s = attach({ scope: "app", store: createBrowserStore({ storage: throwing }) });
    expect(document.querySelector("style[data-opentheme-scope]")).not.toBeNull();
    expect(s.errors.map((e) => e.kind)).toEqual(["store-read-failed"]);
    await s.controller.select({ id: "org.opentheme.graphite" });
    expect(appliedId(s)).toBe("org.opentheme.graphite");
    expect(s.errors.map((e) => e.kind)).toEqual(["store-read-failed", "store-write-failed"]);
  });

  it("a host store without readInitial is read by Core, and its failure is reported", async () => {
    const s = attach({
      scope: "app",
      store: { read: () => Promise.reject(new Error("x")), write: () => undefined, clear: () => undefined },
    });
    await settle();
    expect(s.errors.map((e) => e.kind)).toEqual(["store-read-failed"]);
  });

  it.each([
    ["corrupt", "{not json"],
    ["oversized", `{"openthemePreferences":"1.0","selection":{"id":"org.opentheme.graphite"},"$extensions":{"x.y":"${"a".repeat(70_000)}"}}`],
    ["newer format", '{"openthemePreferences":"2.0","selection":{"id":"org.opentheme.graphite"}}'],
  ])("%s stored data is ignored and left untouched", async (_what, bytes) => {
    localStorage.setItem("opentheme:app", bytes);
    const s = attach({ scope: "app" });
    expect(appliedId(s)).toBe("org.opentheme.aurora");
    await settle();
    expect(localStorage.getItem("opentheme:app")).toBe(bytes);
    expect(s.errors).toEqual([]);
  });

  it("store: false keeps nothing", async () => {
    const s = attach({ scope: "app", store: false });
    await s.controller.select({ id: "org.opentheme.graphite" });
    expect(localStorage.length).toBe(0);
  });
});
