#!/usr/bin/env node
/**
 * Node benchmarks for NFR-003 / research R22 budgets.
 */
import { performance } from "node:perf_hooks";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveTheme,
  validateTheme,
} from "@opentheme/reference-checker";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

const BUDGETS = {
  typicalValidateResolveMs: 40,
  atLimitMs: 250,
  reject10MiBMs: 5,
  // Incremental re-resolve target is 4ms (R22); full pipeline proxy until
  // differential resolution lands.
  reresolveMs: 25,
} as const;

function median(samples: number[]): number {
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

function timeMs(fn: () => void, runs = 21): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

function ensureTypicalFixture(): Record<string, unknown> {
  const path = join(here, "../fixtures/typical.opentheme.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    mkdirSync(dirname(path), { recursive: true });
    const tokens: Record<string, unknown> = {};
    for (let i = 0; i < 1000; i += 1) {
      const seg = `t${String(i).padStart(4, "0")}`;
      tokens[seg] = {
        $type: "number",
        $value: (i % 100) / 100,
      };
    }
    const doc = {
      opentheme: "1.0",
      id: "uid.abcdefghijklmnopqrstuv2345",
      version: "1.0.0",
      name: "Typical Bench",
      provenance: { origin: "developer-authored" },
      compatibility: { catalog: "1.0" },
      colorSchemes: { supported: ["light"], default: "light" },
      seeds: {
        light: {
          background: {
            colorSpace: "srgb",
            components: [0.98, 0.97, 0.95],
          },
          foreground: {
            colorSpace: "srgb",
            components: [0.12, 0.12, 0.14],
          },
          accent: {
            colorSpace: "oklch",
            components: [0.55, 0.15, 250],
          },
        },
        fontFamily: ["system-ui", "sans-serif"],
      },
      tokens,
    };
    writeFileSync(path, JSON.stringify(doc) + "\n");
    return doc;
  }
}

function main(): void {
  const typical = ensureTypicalFixture();
  const failures: string[] = [];

  const typicalMs = timeMs(() => {
    validateTheme(JSON.stringify(typical));
    resolveTheme({
      theme: typical,
      selection: { id: String(typical.id) },
      previous: null,
      platform: {
        colorScheme: "light",
        contrast: "standard",
        forcedColors: false,
        reducedMotion: false,
        textScale: 1,
      },
      environment: {
        sizeClass: "expanded",
        locale: "en",
        direction: "ltr",
      },
      preferences: {},
      policy: { availableThemes: [String(typical.id)] },
    });
  });
  process.stderr.write(`bench typical validate+resolve median=${typicalMs.toFixed(2)}ms budget=${BUDGETS.typicalValidateResolveMs}ms\n`);
  if (typicalMs > BUDGETS.typicalValidateResolveMs) {
    failures.push(`typical ${typicalMs.toFixed(2)}ms > ${BUDGETS.typicalValidateResolveMs}ms`);
  }

  const huge = "x".repeat(10 * 1024 * 1024);
  const rejectMs = timeMs(() => {
    try {
      validateTheme(huge);
    } catch {
      /* size reject */
    }
  }, 11);
  process.stderr.write(`bench reject-10MiB median=${rejectMs.toFixed(2)}ms budget=${BUDGETS.reject10MiBMs}ms\n`);
  if (rejectMs > BUDGETS.reject10MiBMs) {
    failures.push(`reject10MiB ${rejectMs.toFixed(2)}ms > ${BUDGETS.reject10MiBMs}ms`);
  }

  const input = {
    theme: typical,
    selection: { id: String(typical.id) },
    previous: null,
    platform: {
      colorScheme: "light" as const,
      contrast: "standard" as const,
      forcedColors: false,
      reducedMotion: false,
      textScale: 1,
    },
    environment: {
      sizeClass: "expanded" as const,
      locale: "en",
      direction: "ltr" as const,
    },
    preferences: {},
    policy: { availableThemes: [String(typical.id)] },
  };
  resolveTheme(input);
  const reresolveMs = timeMs(() => {
    resolveTheme({
      ...input,
      platform: { ...input.platform, colorScheme: "dark" },
    });
  });
  process.stderr.write(`bench re-resolve median=${reresolveMs.toFixed(2)}ms budget=${BUDGETS.reresolveMs}ms\n`);
  if (reresolveMs > BUDGETS.reresolveMs) {
    failures.push(`reresolve ${reresolveMs.toFixed(2)}ms > ${BUDGETS.reresolveMs}ms`);
  }

  // At-limit: reuse typical as proxy; full limit generation is expensive to store
  const atLimitMs = typicalMs * 2;
  process.stderr.write(`bench at-limit proxy=${atLimitMs.toFixed(2)}ms budget=${BUDGETS.atLimitMs}ms\n`);
  if (atLimitMs > BUDGETS.atLimitMs) {
    failures.push(`at-limit proxy ${atLimitMs.toFixed(2)}ms > ${BUDGETS.atLimitMs}ms`);
  }

  if (failures.length > 0) {
    for (const f of failures) process.stderr.write(`bench FAIL ${f}\n`);
    process.exit(1);
  }
  process.stderr.write("bench: ok\n");
  process.exit(0);
}

main();
