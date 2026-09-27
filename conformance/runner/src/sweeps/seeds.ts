/**
 * SC-015 seed sweep: ≥1000 AA-valid seed combinations resolve completely
 * in every declared mode with AA (standard) / enhanced (high) pairs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "@opentheme/reference-checker";
import type { SweepImpl } from "./impl.js";

type Color = { colorSpace: string; components: number[] };
type Mode = { colorScheme: string; contrast: "standard" | "high" };

type SweepConfig = {
  grid: { steps: number };
  accents: Color[];
  modes: Mode[];
  aaTarget: number;
  minCombinations: number;
};

function loadConfig(): SweepConfig {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../sweeps/seeds.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as SweepConfig;
}

/** 10×10×10 grid: values i/(steps-1) for i in 0..steps-1 */
function gridColors(steps: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  const denom = steps - 1;
  for (let r = 0; r < steps; r += 1) {
    for (let g = 0; g < steps; g += 1) {
      for (let b = 0; b < steps; b += 1) {
        out.push([r / denom, g / denom, b / denom]);
      }
    }
  }
  return out;
}

function aa(
  fg: [number, number, number],
  bg: [number, number, number],
  target: number,
): boolean {
  return (
    contrastRatio(
      { r: fg[0], g: fg[1], b: fg[2], alpha: 1 },
      { r: bg[0], g: bg[1], b: bg[2], alpha: 1 },
    ) >= target
  );
}

function buildTheme(
  idSuffix: string,
  bg: [number, number, number],
  fg: [number, number, number],
  accent: Color,
): Record<string, unknown> {
  return {
    opentheme: "1.0",
    id: `uid.${idSuffix}`,
    version: "1.0.0",
    name: "Sweep",
    provenance: { origin: "user-created" },
    compatibility: { catalog: "1.0" },
    colorSchemes: { supported: ["light"], default: "light" },
    seeds: {
      light: {
        background: { colorSpace: "srgb", components: [...bg] },
        foreground: { colorSpace: "srgb", components: [...fg] },
        accent,
      },
      fontFamily: ["system-ui", "sans-serif"],
    },
  };
}

/** Encode a unique 26-char base32-ish suffix from indices (a-z2-7). */
function uidSuffix(bgIndex: number, accentIndex: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let n = bgIndex * 4 + accentIndex;
  let out = "";
  for (let i = 0; i < 26; i += 1) {
    out = alphabet[n % 32]! + out;
    n = Math.floor(n / 32);
  }
  return out;
}

export type SweepResult = {
  combinations: number;
  resolutions: number;
  failures: string[];
};

export async function runSeedSweep(
  impl: SweepImpl,
  options: { limit?: number } = {},
): Promise<SweepResult> {
  const config = loadConfig();
  const colors = gridColors(config.grid.steps);
  const failures: string[] = [];
  let combinations = 0;
  let resolutions = 0;

  for (let bi = 0; bi < colors.length; bi += 1) {
    const bg = colors[bi]!;
    // First AA-valid foreground in fixed grid order
    let fg: [number, number, number] | undefined;
    for (const candidate of colors) {
      if (aa(candidate, bg, config.aaTarget)) {
        fg = candidate;
        break;
      }
    }
    if (!fg) continue;
    if (options.limit !== undefined && combinations >= options.limit) break;

    for (let ai = 0; ai < config.accents.length; ai += 1) {
      const accent = config.accents[ai]!;
      combinations += 1;
      const theme = buildTheme(uidSuffix(bi, ai), bg, fg, accent);

      for (const mode of config.modes) {
        try {
          const resolved = await impl.resolve({
            theme,
            selection: { id: String(theme.id) },
            previous: null,
            platform: {
              colorScheme: mode.colorScheme as "light" | "dark",
              contrast: mode.contrast,
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
            policy: {
              availableThemes: [String(theme.id)],
            },
          });
          resolutions += 1;
          if (!resolved.accessibility.complete) {
            failures.push(
              `incomplete bg=${bi} accent=${ai} ${mode.contrast}`,
            );
          }
          // Seed pair itself must still meet target in standard; HC uses enhanced floor via resolver
          if (mode.contrast === "standard") {
            const sBg = resolved.tokens["seed.background"] as
              | { srgb8?: number[] }
              | undefined;
            const sFg = resolved.tokens["seed.foreground"] as
              | { srgb8?: number[] }
              | undefined;
            if (sBg?.srgb8 && sFg?.srgb8) {
              const ratio = contrastRatio(
                {
                  r: sFg.srgb8[0]! / 255,
                  g: sFg.srgb8[1]! / 255,
                  b: sFg.srgb8[2]! / 255,
                  alpha: 1,
                },
                {
                  r: sBg.srgb8[0]! / 255,
                  g: sBg.srgb8[1]! / 255,
                  b: sBg.srgb8[2]! / 255,
                  alpha: 1,
                },
              );
              if (ratio < config.aaTarget) {
                failures.push(
                  `AA fail bg=${bi} accent=${ai} ratio=${ratio.toFixed(3)}`,
                );
              }
            }
          }
        } catch (err) {
          failures.push(
            `resolve error bg=${bi} accent=${ai} ${mode.contrast}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  if (options.limit === undefined && combinations < config.minCombinations) {
    failures.push(
      `only ${combinations} combinations, need ≥ ${config.minCombinations}`,
    );
  }

  return { combinations, resolutions, failures };
}
