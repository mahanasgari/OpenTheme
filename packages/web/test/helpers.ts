import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

export const AURORA = "specification/themes/reference/org.opentheme.aurora.opentheme.json";
export const GRAPHITE = "specification/themes/reference/org.opentheme.graphite.opentheme.json";
export const NOTES_HOST = "specification/hosts/com.example.notes.opentheme-host.json";

export const LIGHT_CONTEXT = {
  platform: { colorScheme: "light", contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
  environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
} as const;
