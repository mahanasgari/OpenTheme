/** quickstart.md scenario 1, verbatim (SC-C004). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../src/index.js";
import { BASELINE_PATHS, CATALOG } from "../../src/engine/registry.js";
import { AURORA, GRAPHITE, LIGHT_CONTEXT, NOTES_HOST, read } from "../helpers.js";

describe("quickstart scenario 1", () => {
  it("ships prebuilt themes with zero theme authoring", () => {
    const core = createCore();
    for (const path of [AURORA, GRAPHITE]) {
      const r = core.registry.admit({ kind: "theme", bytes: read(path), trust: "trusted" });
      expect(r.status).toBe("registered");
    }
    expect(core.registry.admit({ kind: "host", bytes: read(NOTES_HOST), trust: "trusted" }).status).toBe("registered");

    const result = core.resolve(core.registry.snapshot(), {
      policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
      selection: { id: "org.opentheme.aurora" },
      previous: null,
      preferences: {},
      ...LIGHT_CONTEXT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("selected");
    const applied = result.resolved.applied as { id: string; fallback: string };
    expect(applied).toMatchObject({ id: "org.opentheme.aurora", fallback: "none" });
    const tokens = result.resolved.tokens as Record<string, unknown>;
    for (const path of BASELINE_PATHS) expect(tokens, path).toHaveProperty([path]);
    const components = result.resolved.components as Record<string, Record<string, Record<string, unknown>>>;
    for (const contract of CATALOG) {
      for (const [part, props] of Object.entries(contract.properties)) {
        for (const prop of Object.keys(props)) {
          expect(components[contract.id]?.[part]?.[prop], `${contract.id} ${part}.${prop}`).toHaveProperty("default");
        }
      }
    }
    expect(Object.isFrozen(result.resolved)).toBe(true);
  });

  it("is deterministic and cache-invisible", () => {
    const run = (cache: number) => {
      const core = createCore({ cache: { results: cache } });
      core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
      const request = {
        policy: { preset: "closed" as const, defaultTheme: "org.opentheme.aurora" },
        selection: { id: "org.opentheme.aurora" },
        previous: null,
        preferences: {},
        ...LIGHT_CONTEXT,
      };
      const a = core.resolve(core.registry.snapshot(), request);
      const b = core.resolve(core.registry.snapshot(), request);
      return [JSON.stringify(a), JSON.stringify(b)];
    };
    const [a, b] = run(32);
    const [c, d] = run(0);
    expect(new Set([a, b, c, d]).size).toBe(1);
  });
});
