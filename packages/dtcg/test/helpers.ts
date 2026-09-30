import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCore, type Core, type RegistryEntry } from "@opentheme/core";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
export const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
export const AURORA = "specification/themes/reference/org.opentheme.aurora.opentheme.json";
export const GRAPHITE = "specification/themes/reference/org.opentheme.graphite.opentheme.json";

export function admitted(bytes: string, trust: "trusted" | "untrusted" = "trusted"): { core: Core; entry: RegistryEntry } {
  const core = createCore({ untrustedSources: { imported: true } });
  const r = core.registry.admit(trust === "trusted" ? { kind: "theme", bytes, trust } : { kind: "theme", bytes, trust, source: "imported" });
  if (!r.entry || (r.status !== "registered" && r.status !== "already-registered")) throw new Error(`not admitted: ${r.status}`);
  return { core, entry: r.entry };
}

export function resolveMode(core: Core, entry: RegistryEntry, scheme: "light" | "dark", contrast: "standard" | "high") {
  const r = core.resolve(core.registry.snapshot(), {
    selection: { id: entry.id, version: entry.version! },
    previous: null,
    preferences: {},
    platform: { colorScheme: scheme, contrast, forcedColors: false, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    policy: { availableThemes: [entry.id], defaultTheme: entry.id },
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.resolved;
}

/** Every `$value` token in a DTCG tree, by dotted path. */
export function dtcgTokens(doc: unknown, prefix = ""): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!doc || typeof doc !== "object") return out;
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$") || !v || typeof v !== "object") continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if ("$value" in v) out.set(path, v as Record<string, unknown>);
    else for (const [p, t] of dtcgTokens(v, path)) out.set(p, t);
  }
  return out;
}
export const NOTES_HOST = "specification/hosts/com.example.notes.opentheme-host.json";
