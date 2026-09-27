/**
 * The Core benchmark cases (research R22; NFR-C001), shared by the Node runner (bench/node.ts) and
 * the browser page (bench/browser.ts). Pure: the caller supplies theme bytes and a clock.
 */
import { createCore } from "../src/index.js";

export const BUDGETS = { typical: 25, atLimit: 250, reject: 5, reresolve: 4 } as const;

export const PLATFORM = { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 } as const;
export const ENVIRONMENT = { sizeClass: "expanded", locale: "en", direction: "ltr" } as const;

function median(fn: () => void, runs: number, now: () => number): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = now();
    fn();
    samples.push(now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}

const seeds = {
  light: {
    background: { colorSpace: "srgb", components: [0.98, 0.97, 0.95] },
    foreground: { colorSpace: "srgb", components: [0.12, 0.12, 0.14] },
    accent: { colorSpace: "oklch", components: [0.55, 0.15, 250] },
  },
  dark: {
    background: { colorSpace: "srgb", components: [0.1, 0.1, 0.12] },
    foreground: { colorSpace: "srgb", components: [0.93, 0.93, 0.95] },
    accent: { colorSpace: "oklch", components: [0.72, 0.13, 250] },
  },
  fontFamily: ["system-ui", "sans-serif"],
};

/** 64 distinct overlay conditions over color scheme, contrast, density, size class, and motion. */
const WHENS: Record<string, string>[] = [];
for (const colorScheme of ["light", "dark"])
  for (const contrast of ["standard", "high"])
    for (const density of ["compact", "standard", "comfortable", undefined])
      for (const sizeClass of ["compact", "expanded"])
        for (const motion of ["reduced", undefined]) {
          if (WHENS.length === 64) break;
          WHENS.push({ colorScheme, contrast, ...(density ? { density } : {}), sizeClass, ...(motion ? { motion } : {}) });
        }

/** 10,000 tokens (3,500 colors, 3,500 color.mix derivations, 3,000 numbers in, 15-deep alias chains) and 64 overlays. */
export function atLimitTheme(): Record<string, unknown> {
  const bench: Record<string, unknown> = {};
  const key = (p: string, i: number) => `${p}${String(i).padStart(4, "0")}`;
  for (let i = 0; i < 3500; i += 1) {
    bench[key("c", i)] = { $type: "color", $value: { colorSpace: "oklch", components: [(30 + (i % 50)) / 100, 0.1, i % 360] } };
  }
  for (let i = 0; i < 3500; i += 1) {
    bench[key("m", i)] = {
      $type: "color",
      $derive: { op: "color.mix", args: { color: "{seed.accent}", toward: `{bench.${key("c", i)}}`, ratio: (i % 10) / 10 } },
    };
  }
  for (let i = 0; i < 3000; i += 1) {
    const chain = i % 15;
    bench[key("n", i)] = chain === 0 ? { $type: "number", $value: i / 3000 } : { $type: "number", $value: `{bench.${key("n", i - 1)}}` };
  }
  const contexts = Array.from({ length: 64 }, (_, o) => ({
    when: WHENS[o]!,
    tokens: { bench: Object.fromEntries(Array.from({ length: 30 }, (_, j) => [key("c", (o * 30 + j) % 3500), { $value: { colorSpace: "srgb", components: [(j % 10) / 10, 0.5, 0.5] } }])) },
  }));
  return {
    opentheme: "1.0",
    id: "com.example.at-limit",
    version: "1.0.0",
    name: "At limit",
    provenance: { origin: "developer-authored" },
    compatibility: { catalog: "1.0" },
    colorSchemes: { supported: ["light", "dark"], default: "light" },
    seeds,
    tokens: { bench },
    contexts,
  };
}

function admitAndResolve(bytes: string, id: string): void {
  const core = createCore({ cache: { results: 0 } });
  const r = core.registry.admit({ kind: "theme", bytes, trust: "trusted" });
  if (r.status !== "registered") throw new Error(`bench theme ${id} not valid: ${r.diagnostics.map((d) => d.code).join(",")}`);
  const result = core.resolve(core.registry.snapshot(), {
    policy: { availableThemes: [id], defaultTheme: "org.opentheme.baseline" },
    selection: { id },
    previous: null,
    preferences: {},
    platform: PLATFORM,
    environment: ENVIRONMENT,
  });
  if (!result.ok || (result.resolved.applied as { id: string }).id !== id) throw new Error(`bench theme ${id} fell back`);
}


export interface BenchResult {
  readonly name: string;
  readonly ms: number;
  readonly budget: number;
}

/** Runs every case; `typical` and `aurora` are the theme files' bytes. */
export function runBench(typical: string, aurora: string, now: () => number): BenchResult[] {
  const results: BenchResult[] = [];
  const typicalId = String((JSON.parse(typical) as { id: string }).id);
  admitAndResolve(typical, typicalId);
  results.push({ name: "typical admit+resolve", ms: median(() => admitAndResolve(typical, typicalId), 21, now), budget: BUDGETS.typical });

  const limit = JSON.stringify(atLimitTheme());
  if (limit.length > 1_048_576) throw new Error(`at-limit theme is ${limit.length} bytes`);
  admitAndResolve(limit, "com.example.at-limit");
  results.push({ name: "at-limit admit+resolve", ms: median(() => admitAndResolve(limit, "com.example.at-limit"), 11, now), budget: BUDGETS.atLimit });

  const huge = "x".repeat(10 * 1024 * 1024);
  const rejecting = createCore();
  results.push({
    name: "reject-10MiB",
    ms: median(() => rejecting.registry.admit({ kind: "theme", bytes: huge, trust: "trusted" }), 11, now),
    budget: BUDGETS.reject,
  });

  const core = createCore({ cache: { results: 0 } });
  core.registry.admit({ kind: "theme", bytes: aurora, trust: "trusted" });
  const controller = core.createController({
    policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
    context: { platform: PLATFORM, environment: ENVIRONMENT },
  });
  let dark = false;
  results.push({
    name: "re-resolve (context change)",
    ms: median(() => {
      dark = !dark;
      controller.setContext({ platform: { ...PLATFORM, colorScheme: dark ? "dark" : "light" } });
    }, 41, now),
    budget: BUDGETS.reresolve,
  });
  return results;
}
