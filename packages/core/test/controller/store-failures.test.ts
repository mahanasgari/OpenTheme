/** Preference Store failures and stored-value integrity (FR-C063, FB-C002 to FB-C004; SC-C006). */
import { describe, expect, it } from "vitest";
import { createCore, createMemoryStore, type PreferenceStore } from "../../src/index.js";
import { AURORA, GRAPHITE, LIGHT_CONTEXT, read } from "../helpers.js";

function core() {
  const c = createCore();
  c.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
  c.registry.admit({ kind: "theme", bytes: read(GRAPHITE), trust: "trusted" });
  return c;
}

const policy = { preset: "common-personalization" as const, defaultTheme: "org.opentheme.aurora" };
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe("store failures", () => {
  it("reports a read failure and still resolves the developer default", async () => {
    const store: PreferenceStore = { read: () => Promise.reject(new Error("locked")), write: () => undefined, clear: () => undefined };
    const controller = core().createController({ policy, context: LIGHT_CONTEXT, store });
    await settle();
    expect(controller.errors.map((e) => e.kind)).toEqual(["store-read-failed"]);
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.aurora");
  });

  it("treats a newer stored document as absent and never overwrites it on its own", async () => {
    const store = createMemoryStore();
    const newer = '{"openthemePreferences":"1.9","selection":{"id":"org.opentheme.graphite"},"previous":null,"values":{}}';
    await store.write("default", newer);
    const controller = core().createController({ policy, context: LIGHT_CONTEXT, store });
    await settle();
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.aurora");
    controller.setContext({ platform: { ...LIGHT_CONTEXT.platform, colorScheme: "dark" } });
    expect(await store.read("default")).toBe(newer);
  });

  it("discards a stored document that arrives after a newer user change (superseded)", async () => {
    let release!: (v: string) => void;
    const store: PreferenceStore = {
      read: () => new Promise<string>((r) => (release = r)),
      write: () => undefined,
      clear: () => undefined,
    };
    const controller = core().createController({ policy, context: LIGHT_CONTEXT, store });
    await controller.select({ id: "org.opentheme.graphite" });
    release('{"openthemePreferences":"1.0","selection":{"id":"org.opentheme.aurora"},"previous":null,"values":{}}');
    await settle();
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.graphite");
    expect(controller.errors.map((e) => e.kind)).toContain("superseded");
  });

  it("keeps stored values exactly as stored through clamping, fallback, skipping, and rejection", async () => {
    const store = createMemoryStore();
    const c = core();
    const controller = c.createController({ policy, context: LIGHT_CONTEXT, store });
    await controller.setValue("std.text-size", 9); // clamped
    await controller.setValue("std.density", "cozy"); // falls back
    await controller.setValue("brand-tint", 0.5); // not a declared point: skipped
    await controller.setValue("std.accent", { colorSpace: "srgb", components: [0.99, 0.99, 0.98] }); // may be rejected by the floor
    const stored = String(await store.read("default"));
    controller.setContext({ platform: { ...LIGHT_CONTEXT.platform, contrast: "high" } });
    controller.setPolicy({ preset: "closed", defaultTheme: "org.opentheme.graphite" });
    controller.setSnapshot(c.registry.snapshot());
    expect(String(await store.read("default"))).toBe(stored);
    expect(JSON.parse(stored).values).toEqual({
      "std.text-size": 9,
      "std.density": "cozy",
      "brand-tint": 0.5,
      "std.accent": { colorSpace: "srgb", components: [0.99, 0.99, 0.98] },
    });
  });
});
