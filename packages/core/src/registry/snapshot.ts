/**
 * Registry entries and immutable snapshots (data-model §4, §5; FR-C030 to FR-C033). A snapshot is
 * deeply frozen; later admissions or removals never change it or any result computed from it.
 */
import type { Diagnostic } from "../diagnostics/collector.js";
import type { Gate } from "../admission/a11y-gate.js";
import type { Trust } from "../admission/sources.js";
import type { UntrustedSource } from "../settings.js";

export type EntryKind = "theme" | "host";
export type Validity = "valid" | "invalid" | "unsupported";

export interface RegistryEntry {
  readonly kind: EntryKind;
  /** From the document; identity only, never trust (FR-C021). `null` for a host's version. */
  readonly id: string;
  readonly version: string | null;
  readonly integrity: string;
  readonly trust: Trust;
  readonly source: UntrustedSource | null;
  /** Under the snapshot's theme set and host declaration (FR-C041). */
  readonly validity: Validity;
  /** Under the snapshot's settings, theme set, and host declaration (FR-C027, FR-C028). */
  readonly gate: Gate;
  /** The admission-time diagnostics (FR-C013). */
  readonly diagnostics: readonly Diagnostic[];
}

export type RegistryEntryRef = Pick<RegistryEntry, "kind" | "id" | "version" | "integrity" | "trust">;

export interface Snapshot {
  /** Monotonic per registry; not a clock. */
  readonly sequence: number;
  /** Canonical order: trusted first, then id, version precedence, and integrity. */
  readonly entries: readonly RegistryEntry[];
  /** The active host declaration, if any. */
  readonly host: RegistryEntry | null;
  /** The built-in specification baseline; always trusted (FR-C022). */
  readonly baseline: RegistryEntry;
}

/** Documents behind a snapshot's entries; never exposed. */
export interface SnapshotData {
  readonly documents: ReadonlyMap<RegistryEntry, Readonly<Record<string, unknown>>>;
  /** Inheritance-merged documents of valid theme entries. */
  readonly merged: ReadonlyMap<RegistryEntry, Readonly<Record<string, unknown>>>;
  readonly hostDocument: Readonly<Record<string, unknown>> | null;
}

const DATA = new WeakMap<Snapshot, SnapshotData>();

export function attachData(snapshot: Snapshot, data: SnapshotData): Snapshot {
  DATA.set(snapshot, data);
  return snapshot;
}

/** The documents behind a snapshot this Core produced, or `undefined` for any other object. */
export function snapshotData(snapshot: unknown): SnapshotData | undefined {
  return typeof snapshot === "object" && snapshot !== null ? DATA.get(snapshot as Snapshot) : undefined;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

export function sameRef(entry: RegistryEntryRef, ref: RegistryEntryRef): boolean {
  return (
    entry.kind === ref.kind &&
    entry.id === ref.id &&
    entry.version === ref.version &&
    entry.integrity === ref.integrity &&
    entry.trust === ref.trust
  );
}
