/** Controller behavior (quickstart scenarios 3 and 4; US3, US4). */
import { describe, expect, it } from "vitest";
import { createCore, createMemoryStore, type PreferenceStore } from "../../src/index.js";
import { AURORA, GRAPHITE, LIGHT_CONTEXT, NOTES_HOST, read } from "../helpers.js";

function setup(preset: "closed" | "common-personalization" = "closed", store?: PreferenceStore) {
  const core = createCore();
  core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
  core.registry.admit({ kind: "theme", bytes: read(GRAPHITE), trust: "trusted" });
  core.registry.admit({ kind: "host", bytes: read(NOTES_HOST), trust: "trusted" });
  const controller = core.createController({
    policy: { preset, defaultTheme: "org.opentheme.aurora" },
    context: LIGHT_CONTEXT,
    ...(store ? { store, scope: "user" } : {}),
  });
  return { core, controller };
}

const bytes = (v: unknown) => JSON.stringify(v);

describe("live context (scenario 3)", () => {
  it("notifies once per effective change and never for no-ops", () => {
    const { controller } = setup();
    const seen: unknown[] = [];
    controller.subscribe((r) => seen.push(r));
    controller.setContext({ platform: { ...LIGHT_CONTEXT.platform, contrast: "high" } });
    expect(seen).toHaveLength(1);
    const current = controller.current.resolved as { context: { contrast: string }; applied: { id: string } };
    expect([current.context.contrast, current.applied.id]).toEqual(["high", "org.opentheme.aurora"]);
    controller.setContext({ platform: { ...LIGHT_CONTEXT.platform, contrast: "high" } });
    expect(seen).toHaveLength(1);
  });

  it("applies reduced motion and rejects invalid context without guessing", () => {
    const { controller } = setup();
    controller.setContext({ platform: { ...LIGHT_CONTEXT.platform, reducedMotion: true } });
    const tokens = controller.current.resolved.tokens as Record<string, { value: number }>;
    for (const [path, v] of Object.entries(tokens)) if (path.startsWith("motion.duration.")) expect(v.value).toBe(0);
    expect(() => controller.setContext({ environment: { ...LIGHT_CONTEXT.environment, sizeClass: "huge" as never } })).toThrow(
      /invalid-context/,
    );
  });
});

describe("personalization, preview, persistence (scenario 4)", () => {
  it("keeps stored values exactly as set while enforcement clamps them", async () => {
    const store = createMemoryStore();
    const { controller } = setup("common-personalization", store);
    await controller.setValue("std.text-size", 5);
    const prefs = controller.current.resolved.preferences as Record<string, { status: string }>;
    expect(prefs["std.text-size"]?.status).toBe("clamped");
    expect(JSON.parse(String(await store.read("user"))).values["std.text-size"]).toBe(5);
  });

  it("previews without writing and restores the exact prior bytes on cancel", async () => {
    const store = createMemoryStore();
    const { controller } = setup("closed", store);
    await controller.select({ id: "org.opentheme.aurora" });
    const stored = await store.read("user");
    const before = bytes(controller.current.resolved);
    controller.preview({ selection: { id: "org.opentheme.graphite" } });
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.graphite");
    expect(await store.read("user")).toBe(stored);
    controller.cancelPreview();
    expect(bytes(controller.current.resolved)).toBe(before);
    controller.preview({ selection: { id: "org.opentheme.graphite" } });
    await controller.acceptPreview();
    expect(JSON.parse(String(await store.read("user"))).selection).toEqual({ id: "org.opentheme.graphite" });
  });

  it("reset equals resolving the developer default with no values", async () => {
    const { core, controller } = setup("common-personalization");
    await controller.select({ id: "org.opentheme.graphite" });
    await controller.setValue("std.corner-roundness", 1.5);
    await controller.reset();
    const direct = core.resolve(core.registry.snapshot(), {
      policy: { preset: "common-personalization", defaultTheme: "org.opentheme.aurora" },
      selection: { id: "org.opentheme.aurora" },
      previous: { id: "org.opentheme.graphite", version: "1.0.0" },
      preferences: {},
      ...LIGHT_CONTEXT,
    });
    expect(direct.ok && bytes(direct.resolved)).toBe(bytes(controller.current.resolved));
  });

  it("applies changes even when the store fails, and reports store-write-failed", async () => {
    const failing: PreferenceStore = {
      read: () => null,
      write: () => Promise.reject(new Error("disk full")),
      clear: () => undefined,
    };
    const { controller } = setup("closed", failing);
    await controller.select({ id: "org.opentheme.graphite" });
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.graphite");
    expect(controller.errors.map((e) => e.kind)).toContain("store-write-failed");
  });

  it("exports canonical bytes and imports only usable documents", async () => {
    const store = createMemoryStore();
    const { controller } = setup("closed", store);
    await controller.select({ id: "org.opentheme.graphite" });
    const exported = controller.exportDocument();
    expect(exported.startsWith('{"openthemePreferences":"1.0"')).toBe(true);
    const newer = await controller.importDocument('{"openthemePreferences":"1.9","selection":null,"previous":null,"values":{}}');
    expect(newer.imported).toBe(false);
    expect(newer.diagnostics.map((d) => d.code)).toEqual(["OT-PREF-004"]);
    expect(controller.exportDocument()).toBe(exported);
    const ok = await controller.importDocument('{"openthemePreferences":"1.0","selection":{"id":"org.opentheme.aurora"},"previous":null,"values":{}}');
    expect(ok.imported).toBe(true);
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.aurora");
  });

  it("uses a stored document once it arrives, unless a newer change superseded it", async () => {
    const store = createMemoryStore();
    await store.write("user", '{"openthemePreferences":"1.0","selection":{"id":"org.opentheme.graphite"},"previous":null,"values":{}}');
    const { controller } = setup("closed", store);
    await Promise.resolve();
    await Promise.resolve();
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.graphite");
  });

  it("updates previous only for a selection applied without fallback, and falls back to it", async () => {
    const store = createMemoryStore();
    const { controller } = setup("closed", store);
    await controller.select({ id: "org.opentheme.graphite" });
    expect(JSON.parse(controller.exportDocument()).previous).toEqual({ id: "org.opentheme.graphite", version: "1.0.0" });
    await controller.select({ id: "com.example.missing" });
    const applied = controller.current.resolved.applied as { id: string; fallback: string };
    expect([applied.id, applied.fallback]).toEqual(["org.opentheme.graphite", "previous"]);
    const doc = JSON.parse(controller.exportDocument());
    expect([doc.selection, doc.previous]).toEqual([{ id: "com.example.missing" }, { id: "org.opentheme.graphite", version: "1.0.0" }]);
  });

  it("throws disposed after dispose", () => {
    const { controller } = setup();
    controller.dispose();
    expect(() => controller.setPolicy({ preset: "closed", defaultTheme: "org.opentheme.aurora" })).toThrow(/disposed/);
  });
});
