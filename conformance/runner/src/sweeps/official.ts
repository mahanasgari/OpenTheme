/**
 * SC-006 official theme sweep: baseline + reference themes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "@opentheme/reference-checker";
import type { SweepImpl } from "./impl.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".opentheme.json")) out.push(full);
  }
}

export type OfficialSweepResult = {
  themes: number;
  resolutions: number;
  failures: string[];
};

export async function runOfficialThemeSweep(impl: SweepImpl): Promise<OfficialSweepResult> {
  const failures: string[] = [];
  const files: string[] = [];
  walk(join(repoRoot, "specification/themes/baseline"), files);
  walk(join(repoRoot, "specification/themes/reference"), files);

  let resolutions = 0;
  for (const file of files) {
    const theme = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    const id = String(theme.id);
    const schemes =
      (theme.colorSchemes as { supported?: string[] })?.supported ?? [];

    for (const colorScheme of schemes) {
      for (const contrast of ["standard", "high"] as const) {
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
            preferences: {},
            policy: { availableThemes: [id] },
          });
          resolutions += 1;
          if (!resolved.accessibility.complete) {
            failures.push(`${id} ${colorScheme}/${contrast}: incomplete`);
          }
          for (const pair of resolved.accessibility.pairs) {
            if (!pair.pass) {
              failures.push(
                `${id} ${colorScheme}/${contrast}: ${pair.foreground} vs ${pair.background} ratio=${pair.ratio.toFixed(2)} < ${pair.threshold}`,
              );
            }
          }
          // Seed pair floor
          const bg = resolved.tokens["seed.background"] as
            | { srgb8?: number[] }
            | undefined;
          const fg = resolved.tokens["seed.foreground"] as
            | { srgb8?: number[] }
            | undefined;
          if (bg?.srgb8 && fg?.srgb8) {
            const ratio = contrastRatio(
              {
                r: fg.srgb8[0]! / 255,
                g: fg.srgb8[1]! / 255,
                b: fg.srgb8[2]! / 255,
                alpha: 1,
              },
              {
                r: bg.srgb8[0]! / 255,
                g: bg.srgb8[1]! / 255,
                b: bg.srgb8[2]! / 255,
                alpha: 1,
              },
            );
            const floor = contrast === "high" ? 7 : 4.5;
            if (ratio < floor) {
              failures.push(
                `${id} ${colorScheme}/${contrast}: seed pair ${ratio.toFixed(2)} < ${floor}`,
              );
            }
          }

          // SC-006: interactive target size ≥ 24 px at every density
          for (const density of ["compact", "standard", "comfortable"] as const) {
            const densResolved =
              density === "standard"
                ? resolved
                : await impl.resolve({
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
                    preferences: { "std.density": density },
                    policy: {
                      availableThemes: [id],
                      permittedPoints: { "std.density": {} },
                    },
                  });
            for (const path of [
              "size.target.min",
              "size.control.height.sm",
              "size.control.height.md",
              "size.control.height.lg",
            ]) {
              const tok = densResolved.tokens[path] as
                | { value?: number; unit?: string }
                | undefined;
              if (
                tok &&
                typeof tok.value === "number" &&
                tok.unit === "px" &&
                tok.value < 24
              ) {
                failures.push(
                  `${id} ${colorScheme}/${contrast}/${density}: ${path}=${tok.value} < 24`,
                );
              }
            }
          }
        } catch (err) {
          failures.push(
            `${id} ${colorScheme}/${contrast}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  return { themes: files.length, resolutions, failures };
}
