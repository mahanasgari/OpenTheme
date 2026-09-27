/**
 * SC-014 accent sweep: 10×10×10 sRGB accents × reference themes × modes.
 * Asserts accent-related tokens derive, text-on-accent meets AA, and no
 * below-AA pair is applied without OT-A11Y-007 rejection.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "@opentheme/reference-checker";
import type { SweepImpl } from "./impl.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

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

function walkThemes(): string[] {
  const files: string[] = [];
  for (const dir of [
    join(repoRoot, "specification/themes/baseline"),
    join(repoRoot, "specification/themes/reference"),
  ]) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isFile() && name.endsWith(".opentheme.json")) {
        files.push(full);
      }
    }
  }
  return files;
}

export type AccentSweepResult = {
  accents: number;
  resolutions: number;
  failures: string[];
};

export async function runAccentSweep(
  impl: SweepImpl,
  options: { limit?: number } = {},
): Promise<AccentSweepResult> {
  const failures: string[] = [];
  const allAccents = gridColors(10);
  const accents =
    options.limit === undefined ? allAccents : allAccents.slice(0, options.limit);
  const themes = walkThemes();
  let resolutions = 0;

  for (const file of themes) {
    const theme = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    const id = String(theme.id);
    const schemes =
      (theme.colorSchemes as { supported?: string[] })?.supported ?? ["light"];

    for (const colorScheme of schemes) {
      for (const contrast of ["standard", "high"] as const) {
        for (const accent of accents) {
          try {
            const resolved = await impl.resolve({
              theme,
              selection: { id },
              previous: null,
              platform: {
                colorScheme: colorScheme as "light" | "dark",
                contrast,
                forcedColors: false,
                reducedMotion: false,
                textScale: 1,
              },
              environment: {
                sizeClass: "expanded",
                locale: "en",
                direction: "ltr",
              },
              preferences: {
                "std.accent": {
                  colorSpace: "srgb",
                  components: [...accent],
                  alpha: 1,
                },
              },
              policy: {
                availableThemes: [id],
                permittedPoints: {
                  "std.accent": {},
                },
                accessibilityFloor: "wcag22-aa",
              },
            });
            resolutions += 1;

            const accentStatus = resolved.preferences["std.accent"]?.status;
            const onAction = resolved.tokens["color.text.on-action"] as
              | { srgb8?: number[] }
              | undefined;
            const actionBg = resolved.tokens[
              "color.action.primary.background"
            ] as { srgb8?: number[] } | undefined;

            if (accentStatus === "rejected") {
              const has007 = resolved.diagnostics.some(
                (d) => d.code === "OT-A11Y-007",
              );
              if (!has007) {
                failures.push(
                  `${id} ${colorScheme}/${contrast} accent=${accent}: rejected without OT-A11Y-007`,
                );
              }
              continue;
            }

            if (onAction?.srgb8 && actionBg?.srgb8) {
              const ratio = contrastRatio(
                {
                  r: onAction.srgb8[0]! / 255,
                  g: onAction.srgb8[1]! / 255,
                  b: onAction.srgb8[2]! / 255,
                  alpha: 1,
                },
                {
                  r: actionBg.srgb8[0]! / 255,
                  g: actionBg.srgb8[1]! / 255,
                  b: actionBg.srgb8[2]! / 255,
                  alpha: 1,
                },
              );
              const floor = contrast === "high" ? 7 : 4.5;
              if (ratio < floor) {
                failures.push(
                  `${id} ${colorScheme}/${contrast} accent=${accent}: on-action ${ratio.toFixed(2)} < ${floor}`,
                );
              }
            }

            for (const pair of resolved.accessibility.pairs) {
              if (!pair.pass) {
                failures.push(
                  `${id} ${colorScheme}/${contrast}: applied below-AA ${pair.foreground}/${pair.background}`,
                );
              }
            }
          } catch (err) {
            failures.push(
              `${id} ${colorScheme}/${contrast} accent=${accent}: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }

  return { accents: accents.length, resolutions, failures };
}
