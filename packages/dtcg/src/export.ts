/**
 * Export (chapter 16; research IR2 to IR4): one DTCG 2025.10 document per mode with Core's
 * resolved values. A token the theme declares as a derivation keeps that `$derive`, as declared,
 * under `$extensions["org.opentheme"].derive` (finding D1).
 */
import type { Core, OperationalError, RegistryEntryRef } from "@opentheme/core";
import { BASELINE_TYPES } from "./generated/data.js";
import { Report, type ReportEntry } from "./report.js";
import { encode } from "./values.js";

export interface Mode {
  readonly scheme: "light" | "dark";
  readonly contrast: "standard" | "high";
}

export type ExportResult =
  | { readonly ok: true; readonly documents: readonly { readonly mode: Mode; readonly document: object }[]; readonly report: readonly ReportEntry[] }
  | { readonly ok: false; readonly error: OperationalError };

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

interface Declared {
  readonly type: string | undefined;
  readonly derive: unknown;
  readonly description: string | undefined;
}

/** Leaf declarations of a token tree, with group `$type` inheritance. */
function declarations(tree: unknown): Map<string, Declared> {
  const out = new Map<string, Declared>();
  const walk = (node: unknown, path: string[], inherited: string | undefined) => {
    if (!isRecord(node)) return;
    const type = typeof node.$type === "string" ? node.$type : inherited;
    if ("$value" in node || "$derive" in node) {
      out.set(path.join("."), {
        type,
        derive: "$derive" in node ? node.$derive : undefined,
        description: typeof node.$description === "string" ? node.$description : undefined,
      });
      return;
    }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith("$")) walk(v, [...path, k], type);
  };
  walk(tree, [], undefined);
  return out;
}

/** Paths any context overlay declares: their active declaration depends on the mode. */
function overlaid(contexts: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(contexts)) return out;
  for (const o of contexts) if (isRecord(o)) for (const p of declarations(o.tokens).keys()) out.add(p);
  return out;
}

export function exportTheme(core: Core, theme: RegistryEntryRef, options: { readonly modes?: readonly Mode[] } = {}): ExportResult {
  const snapshot = core.registry.snapshot();
  const flat = core.documents.flatten(theme, snapshot);
  if ("ok" in flat) return { ok: false, error: flat.error };
  const doc = flat.document as Rec;
  const declared = declarations(doc.tokens);
  const overlays = overlaid(doc.contexts);
  const supported = isRecord(doc.colorSchemes) && Array.isArray(doc.colorSchemes.supported) ? (doc.colorSchemes.supported as string[]) : ["light"];
  const modes: readonly Mode[] =
    options.modes ?? (["light", "dark"] as const).filter((s) => supported.includes(s)).map((scheme) => ({ scheme, contrast: "standard" as const }));
  const report = new Report();
  const seen = new Set<string>();
  const note = (path: string, action: ReportEntry["action"], reason: string) => {
    const key = `${path}\u0000${action}\u0000${reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      report.add(path, action, reason);
    }
  };

  const documents: { mode: Mode; document: object }[] = [];
  for (const mode of modes) {
    const r = core.resolve(snapshot, {
      selection: { id: theme.id, ...(theme.version ? { version: theme.version } : {}) },
      previous: null,
      preferences: {},
      platform: { colorScheme: mode.scheme, contrast: mode.contrast, forcedColors: false, reducedMotion: false, textScale: 1 },
      environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
      policy: { availableThemes: [theme.id], defaultTheme: theme.id },
    });
    if (!r.ok) return { ok: false, error: r.error };
    const applied = r.resolved.applied as { id: string; fallback: string };
    if (applied.id !== theme.id || applied.fallback !== "none") {
      return {
        ok: false,
        error: { kind: "unknown-theme", operation: "dtcg.exportTheme", message: `The theme was not applied (fell back to ${applied.id}).`, hint: "Export a valid theme.", docs: "" },
      };
    }
    const root: Rec = {
      $extensions: { "org.opentheme": { theme: theme.id, version: theme.version, mode: { scheme: mode.scheme, contrast: mode.contrast } } },
    };
    const tokens = r.resolved.tokens as Rec;
    for (const path of Object.keys(tokens).sort()) {
      if (path.includes("/")) {
        note(path, "left-out", "host tokens are outside DTCG (chapter 16)");
        continue;
      }
      const d = declared.get(path);
      const type = d?.type ?? BASELINE_TYPES[path];
      if (!type) {
        note(path, "left-out", "the token's type is unknown");
        continue;
      }
      const e = encode(type, tokens[path]);
      if (!e.ok) {
        note(path, "left-out", e.reason);
        continue;
      }
      const token: Rec = { $type: e.value.type, $value: e.value.value };
      if (d?.description) token.$description = d.description;
      if (d?.derive !== undefined) {
        if (overlays.has(path)) note(path, "kept-computed", "a context overlay also declares this token, so only the computed value is exported");
        else token.$extensions = { "org.opentheme": { derive: d.derive } };
      }
      const segments = path.split(".");
      let node = root;
      let conflict = false;
      for (const s of segments.slice(0, -1)) {
        const next = node[s];
        if (isRecord(next) && "$value" in next) {
          conflict = true;
          break;
        }
        node = (node[s] ??= {}) as Rec;
      }
      const last = segments[segments.length - 1]!;
      if (conflict || isRecord(node[last])) {
        note(path, "left-out", "the path is both a token and a group");
        continue;
      }
      node[last] = token;
    }
    documents.push({ mode, document: root });
  }
  return { ok: true, documents, report: report.entries() };
}
