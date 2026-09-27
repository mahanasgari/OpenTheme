/**
 * Memory bounds (FR-C072, FR-C074; SC-C010): 10,000 admissions and 100,000 resolutions stay within
 * the configured registry and cache bounds, and memory does not grow with the call count.
 */
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { createCore } from "../../src/index.js";
import { Lru } from "../../src/resolve/cache.js";
import { LIGHT_CONTEXT } from "../helpers.js";

const CAPACITY = 64;

// A real collection before each measurement, so heap numbers do not depend on GC timing.
setFlagsFromString("--expose-gc");
const gc = runInNewContext("gc") as () => void;

function smallTheme(i: number): string {
  return JSON.stringify({
    opentheme: "1.0",
    id: `com.example.t${i}`,
    version: "1.0.0",
    name: `Theme ${i}`,
    provenance: { origin: "user-created" },
    compatibility: { catalog: "1.0" },
    colorSchemes: { supported: ["light"], default: "light" },
    seeds: {
      light: {
        background: { colorSpace: "srgb", components: [1, 1, 1] },
        foreground: { colorSpace: "srgb", components: [0.1, 0.1, 0.1] },
        accent: { colorSpace: "oklch", components: [0.5, 0.15, (i * 7) % 360] },
      },
      fontFamily: ["system-ui", "sans-serif"],
    },
  });
}

describe("stress", () => {
  it("never holds more than registryCapacity entries across 10,000 admissions", () => {
    const core = createCore({ registryCapacity: CAPACITY, untrustedSources: { "user-created": true } });
    let refused = 0;
    for (let i = 0; i < 10_000; i += 1) {
      const bytes = i < CAPACITY ? smallTheme(i) : smallTheme(i % 3 === 0 ? i % CAPACITY : i);
      const r = core.registry.admit({ kind: "theme", bytes, trust: "untrusted", source: "user-created" });
      if (r.status === "refused") refused += 1;
      expect(core.registry.snapshot().entries.length).toBeLessThanOrEqual(CAPACITY);
    }
    expect(core.registry.snapshot().entries).toHaveLength(CAPACITY);
    expect(refused).toBeGreaterThan(6000);
  }, 300_000);

  it("keeps memory flat across 100,000 resolutions", () => {
    const core = createCore({ cache: { results: 32 } });
    const snapshot = core.registry.snapshot();
    const scales = Array.from({ length: 24 }, (_, i) => 1 + i / 8);
    const run = (n: number) => {
      for (let i = 0; i < n; i += 1) {
        const r = core.resolve(snapshot, {
          policy: { preset: "closed", defaultTheme: "org.opentheme.baseline" },
          selection: { id: "org.opentheme.baseline" },
          previous: null,
          preferences: {},
          platform: { ...LIGHT_CONTEXT.platform, textScale: scales[i % scales.length]! },
          environment: LIGHT_CONTEXT.environment,
        });
        if (!r.ok) throw new Error("unexpected");
      }
    };
    run(1_000);
    gc();
    const before = process.memoryUsage().heapUsed;
    run(99_000);
    gc();
    const growth = process.memoryUsage().heapUsed - before;
    expect(growth).toBeLessThan(64 * 1024 * 1024);
  }, 300_000);

  it("bounds the LRU at its capacity, and 0 disables it", () => {
    const lru = new Lru<number>(32);
    for (let i = 0; i < 100_000; i += 1) lru.set(String(i), i);
    expect(lru.size).toBe(32);
    const off = new Lru<number>(0);
    off.set("a", 1);
    expect([off.size, off.get("a")]).toEqual([0, undefined]);
  });
});
