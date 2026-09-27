/**
 * Resolution Request + snapshot → the Foundation resolution input (FR-C070; data-model §6). The
 * compilation is lossless: request members pass through unchanged, and the snapshot contributes
 * `themes` (trusted entries first, F1) and `host`.
 */
import { isRecord } from "../engine/model.js";
import type { RegistryEntry, Snapshot, SnapshotData } from "../registry/snapshot.js";
import type { ResolutionInput } from "./pipeline.js";
import type { AbstractPolicy } from "./presets.js";

export interface ResolutionRequest {
  readonly selection: { readonly id: string; readonly version?: string };
  readonly previous: { readonly id: string; readonly version: string } | null;
  readonly platform: ResolutionInput["platform"];
  readonly environment: ResolutionInput["environment"];
  readonly preferences: Readonly<Record<string, unknown>>;
}

/** Theme entries whose gate admits them (FR-C027, FR-C028). */
export function admitted(entry: RegistryEntry): boolean {
  return entry.kind === "theme" && (entry.gate === "pass" || entry.gate === "not-applicable");
}

/**
 * The theme entries a resolution can reach: every admitted entry, plus the entries its
 * inheritance can reach by identifier (bases are resolved from the same theme set, chapter 10).
 */
export function reachableEntries(snapshot: Snapshot, data: SnapshotData): RegistryEntry[] {
  const included = new Set(snapshot.entries.filter(admitted));
  const pending = [...included];
  while (pending.length > 0) {
    const doc = data.documents.get(pending.pop()!)!;
    const ext = doc.extends;
    if (!isRecord(ext) || typeof ext.id !== "string") continue;
    for (const e of snapshot.entries) {
      if (e.kind === "theme" && e.id === ext.id && !included.has(e)) {
        included.add(e);
        pending.push(e);
      }
    }
  }
  // Snapshot order is canonical: trusted entries first.
  return snapshot.entries.filter((e) => included.has(e));
}

export function compileInput(
  snapshot: Snapshot,
  data: SnapshotData,
  request: ResolutionRequest,
  policy: AbstractPolicy,
): ResolutionInput {
  const themes = reachableEntries(snapshot, data);
  // An identifier held only by gated entries (present as bases) is never selectable (FR-C027).
  const selectableIds = new Set(themes.filter(admitted).map((e) => e.id));
  const baseOnly = new Set(themes.filter((e) => !selectableIds.has(e.id)).map((e) => e.id));
  const available = policy.availableThemes?.filter((id) => !baseOnly.has(id));
  return {
    themes: themes.map((e) => ({ trust: e.trust, document: data.documents.get(e)! })),
    host: data.hostDocument,
    selection: request.selection,
    previous: request.previous ?? null,
    platform: request.platform,
    environment: request.environment,
    preferences: request.preferences ?? {},
    policy: available === undefined ? policy : { ...policy, availableThemes: available },
  };
}
