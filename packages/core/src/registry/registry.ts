/**
 * The Theme Registry (FR-C030 to FR-C034, FR-C074). Entries are kept distinct by
 * `(kind, trust, id, version, integrity)`; nothing is overwritten or evicted. The specification
 * baseline is built in and trusted. Resolution works on immutable snapshots.
 */
import { checkTrustAndSource, type Trust } from "../admission/sources.js";
import { computeIntegrity } from "../canonical/integrity.js";
import type { Diagnostic } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";
import { DiagnosticCollector } from "../diagnostics/collector.js";
import { migrateTheme, type MigrationManifest } from "../versioning/migrate.js";
import { SUPPORTED_SPEC } from "../validate/theme.js";
import { limit } from "../engine/registry.js";
import { JsonParseError, parseIJson } from "../parse/ijson.js";
import { OpenThemeCoreError, type OperationalError, operationalError } from "../errors/operational.js";
import { baselineTheme } from "../generated/baseline.js";
import type { EffectiveSettings, UntrustedSource } from "../settings.js";
import { comparePrecedence } from "../versioning/semver.js";
import { validateHost } from "../validate/host.js";
import { validateTheme, validateThemeDocument, type BaseEntry } from "../validate/theme.js";
import { evaluateTheme, type ThemeEvaluation } from "./reevaluate.js";
import { Prepared } from "../resolve/prepare.js";
import {
  attachData,
  deepFreeze,
  type EntryKind,
  type RegistryEntry,
  type RegistryEntryRef,
  sameRef,
  type Snapshot,
  type Validity,
} from "./snapshot.js";

export interface AdmissionRequest {
  readonly kind: EntryKind;
  readonly bytes: Uint8Array | string;
  readonly trust: Trust;
  readonly source?: UntrustedSource;
  /**
   * A migration manifest for a theme of the previous specification major (FR-C101; chapter 14).
   * It applies only when the document's major is exactly one below the supported major and the
   * manifest targets the supported major; the migrated document keeps this admission's trust.
   */
  readonly migration?: MigrationManifest;
}

export interface AdmissionResult {
  readonly status: "registered" | "already-registered" | "invalid" | "refused";
  /** `null` when refused, or when the bytes are not a JSON object (nothing to identify). */
  readonly entry: RegistryEntry | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly error: OperationalError | null;
}

export interface ThemeSource {
  load(): Promise<Uint8Array | string>;
}

export interface ThemeRegistry {
  admit(request: AdmissionRequest): AdmissionResult;
  admitFrom(source: ThemeSource, request: Omit<AdmissionRequest, "bytes">): Promise<AdmissionResult>;
  remove(entry: RegistryEntryRef): Snapshot;
  snapshot(): Snapshot;
}

interface Stored {
  readonly kind: EntryKind;
  readonly id: string;
  readonly version: string | null;
  readonly integrity: string;
  readonly trust: Trust;
  readonly source: UntrustedSource | null;
  readonly document: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly Diagnostic[];
  /** Host validity is fixed; theme validity is re-evaluated per snapshot. */
  readonly hostValid: boolean;
  cached?: { readonly key: string; readonly value: ThemeEvaluation };
}

const BASELINE_DOC = deepFreeze(baselineTheme as Record<string, unknown>);
const BASELINE_ENTRY: RegistryEntry = deepFreeze({
  kind: "theme",
  id: String(BASELINE_DOC.id),
  version: String(BASELINE_DOC.version),
  integrity: computeIntegrity(BASELINE_DOC).integrity,
  trust: "trusted",
  source: null,
  validity: "valid",
  gate: "not-applicable",
  diagnostics: [],
});

/** Documents are parsed JSON, so a JSON round trip copies them exactly. */
function cloneJson(doc: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
}

/**
 * Migration findings merged with the admission's, in chapter 13 order and cap. The earlier cap
 * marker is dropped first, so the merged list is capped (and marked) exactly once.
 */
function withMigration(migration: readonly Diagnostic[], admission: readonly Diagnostic[]): Diagnostic[] {
  if (migration.length === 0) return [...admission];
  const all = new DiagnosticCollector("theme");
  all.addAll(migration);
  all.addAll(admission.filter((d) => d.code !== "OT-LIM-099"));
  return all.finish();
}

function isManifest(v: unknown): v is MigrationManifest {
  return isRecord(v) && typeof v.from === "string" && typeof v.to === "string" && Array.isArray(v.operations) && v.operations.every(isRecord);
}

const SUPPORTED_MAJOR = Number(SUPPORTED_SPEC.split(".")[0]);
const majorOf = (v: unknown): number => (typeof v === "string" ? Number(v.split(".")[0]) : Number.NaN);

/**
 * The migrated document when `manifest` applies (chapter 14): the document is of the previous
 * major, and the manifest migrates from that major to the supported one. Otherwise `null`, and the
 * document is admitted as it is (and reported as unsupported by validation).
 */
function migrateForAdmission(
  doc: Readonly<Record<string, unknown>>,
  manifest: MigrationManifest,
): { document: Readonly<Record<string, unknown>>; diagnostics: readonly Diagnostic[] } | null {
  const major = majorOf(doc.opentheme);
  if (major !== SUPPORTED_MAJOR - 1 || majorOf(manifest.from) !== major || majorOf(manifest.to) !== SUPPORTED_MAJOR) return null;
  const r = migrateTheme(doc, manifest);
  if (!r.migrated) return null;
  return { document: deepFreeze(r.document), diagnostics: r.diagnostics };
}

/** The bytes as a freshly parsed, bounded JSON object, or `null`. */
function parseObject(bytes: Uint8Array | string): Record<string, unknown> | null {
  try {
    // Frozen as built: the registry never mutates a document (FR-C032).
    const v = parseIJson(bytes, { maxBytes: limit("documentBytes"), maxDepth: limit("nestingDepth"), freeze: true });
    return isRecord(v) ? v : null;
  } catch (e) {
    if (e instanceof JsonParseError) return null;
    throw e;
  }
}

function keyOf(e: RegistryEntryRef): string {
  return JSON.stringify([e.kind, e.trust, e.id, e.version, e.integrity]);
}

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Canonical entry order (data-model §5). */
function compareEntries(a: RegistryEntry, b: RegistryEntry): number {
  if (a.trust !== b.trust) return a.trust === "trusted" ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === "theme" ? -1 : 1;
  if (a.id !== b.id) return codeUnitCompare(a.id, b.id);
  if (a.version !== b.version) {
    if (a.version === null || b.version === null) return a.version === null ? -1 : 1;
    const p = comparePrecedence(a.version, b.version);
    if (p !== 0) return p;
    return codeUnitCompare(a.version, b.version);
  }
  return codeUnitCompare(a.integrity, b.integrity);
}

function refused(error: OperationalError, diagnostics: readonly Diagnostic[] = []): AdmissionResult {
  return deepFreeze({ status: "refused", entry: null, diagnostics: [...diagnostics], error });
}

export class Registry implements ThemeRegistry {
  readonly #stored = new Map<string, Stored>();
  readonly #settings: () => EffectiveSettings;
  #sequence = 0;
  #themeGeneration = 0;
  #settingsGeneration = 0;
  #snapshot: Snapshot | null = null;

  /** Prepared-theme reuse for this Core (FR-C071, FR-C072). */
  readonly prepared: Prepared;

  constructor(settings: () => EffectiveSettings) {
    this.#settings = settings;
    this.prepared = new Prepared(settings().cache.preparedThemes);
  }

  /** Called when the untrusted-source or gate settings change (FR-C027). */
  settingsChanged(): void {
    this.#settingsGeneration += 1;
    this.#changed();
  }

  #changed(): void {
    this.#sequence += 1;
    this.#snapshot = null;
  }

  admit(request: AdmissionRequest): AdmissionResult {
    const op = "registry.admit";
    if (!isRecord(request)) {
      throw new OpenThemeCoreError(operationalError("invalid-argument", op, "The admission request must be an object."));
    }
    if (request.kind !== "theme" && request.kind !== "host") {
      throw new OpenThemeCoreError(operationalError("invalid-argument", op, 'kind must be "theme" or "host".', "/kind"));
    }
    // Trust and source first: cheap refusals, before any size check or parsing (research CR13).
    const denied = checkTrustAndSource(request.trust, request.source, this.#settings(), op);
    if (denied) return refused(denied);
    const bytes = request.bytes;
    if (typeof bytes !== "string" && !(bytes instanceof Uint8Array)) {
      throw new OpenThemeCoreError(operationalError("invalid-argument", op, "bytes must be a string or a Uint8Array.", "/bytes"));
    }
    const trust = request.trust;
    const source = trust === "untrusted" ? (request.source ?? null) : null;
    const migration = request.migration;
    if (migration !== undefined && (request.kind !== "theme" || !isManifest(migration))) {
      throw new OpenThemeCoreError(
        operationalError("invalid-argument", op, "migration must be a theme manifest { from, to, operations }.", "/migration"),
      );
    }
    return request.kind === "host" ? this.#admitHost(bytes, trust, source) : this.#admitTheme(bytes, trust, source, migration);
  }

  async admitFrom(source: ThemeSource, request: Omit<AdmissionRequest, "bytes">): Promise<AdmissionResult> {
    const op = "registry.admitFrom";
    const denied = isRecord(request) ? checkTrustAndSource(request.trust, request.source, this.#settings(), op) : null;
    if (denied) return refused(denied);
    let bytes: Uint8Array | string;
    try {
      bytes = await source.load();
    } catch {
      return refused(operationalError("source-load-failed", op, "The theme source failed to load."));
    }
    return this.admit({ ...request, bytes } as AdmissionRequest);
  }

  #admitHost(bytes: Uint8Array | string, trust: Trust, source: UntrustedSource | null): AdmissionResult {
    const v = validateHost(bytes);
    const doc = v.document;
    if (!doc) return deepFreeze({ status: "invalid", entry: null, diagnostics: v.diagnostics, error: null });
    const stored: Stored = {
      kind: "host",
      id: typeof doc.id === "string" ? doc.id : "",
      version: null,
      integrity: computeIntegrity(doc).integrity,
      trust,
      source,
      document: deepFreeze(cloneJson(doc)),
      diagnostics: deepFreeze([...v.diagnostics]),
      hostValid: v.valid,
    };
    return this.#existing(stored) ?? this.#full(stored) ?? this.#store(stored, v.valid ? "valid" : "invalid", "not-applicable");
  }

  #admitTheme(bytes: Uint8Array | string, trust: Trust, source: UntrustedSource | null, migration?: MigrationManifest): AdmissionResult {
    // A full registry needs only the identity (for `already-registered`), not a validation.
    if (this.#stored.size >= this.#settings().registryCapacity) {
      const identity = this.#identityOnly(bytes, trust);
      const known = identity ? this.#stored.get(identity) : undefined;
      if (known) return this.#existing(known)!;
      return refused(operationalError("registry-capacity", "registry.admit", "The registry is full."));
    }
    // Admission-time validation uses the current theme set and host declaration (FR-C013).
    const bases = this.#bases();
    const host = this.#hostDocument();
    const parsed = parseObject(bytes);
    if (!parsed) {
      // Not a bounded JSON object: `validateTheme` reports the parse failure.
      return deepFreeze({ status: "invalid", entry: null, diagnostics: validateTheme(bytes, { bases, host }).diagnostics, error: null });
    }
    // Frozen (by the parser) before validation, so the result is shared with every later
    // snapshot and resolution. A previous-major document is migrated first (FR-C101).
    const migrated = migration ? migrateForAdmission(parsed, migration) : null;
    const document = migrated ? migrated.document : parsed;
    const migrationDiagnostics = migrated?.diagnostics ?? [];
    const doc = document;
    const validation = validateThemeDocument(document, { bases, host, prepared: this.prepared });
    const identity: Stored = {
      kind: "theme",
      id: typeof doc.id === "string" ? doc.id : "",
      version: typeof doc.version === "string" ? doc.version : null,
      integrity: computeIntegrity(document).integrity,
      trust,
      source,
      document,
      diagnostics: [],
      hostValid: false,
    };
    const known = this.#existing(identity) ?? this.#full(identity, validation.diagnostics);
    if (known) return known;
    const evaluation = evaluateTheme(document, trust, source, bases, host, this.#settings(), this.prepared, validation);
    const diagnostics = withMigration(migrationDiagnostics, evaluation.diagnostics);
    if (evaluation.gate === "refused-accessibility") {
      return refused(
        operationalError("accessibility-gate", "registry.admit", "The untrusted theme misses WCAG 2.2 AA in a mode it supports."),
        diagnostics,
      );
    }
    return this.#store({ ...identity, diagnostics: deepFreeze(diagnostics) }, evaluation.validity, evaluation.gate, evaluation);
  }

  /** The identity key of theme bytes, or `null` when they are not a bounded JSON object. */
  #identityOnly(bytes: Uint8Array | string, trust: Trust): string | null {
    let doc: unknown;
    try {
      doc = parseIJson(bytes, { maxBytes: limit("documentBytes"), maxDepth: limit("nestingDepth") });
    } catch (e) {
      if (e instanceof JsonParseError) return null;
      throw e;
    }
    if (!isRecord(doc)) return null;
    return keyOf({
      kind: "theme",
      trust,
      id: typeof doc.id === "string" ? doc.id : "",
      version: typeof doc.version === "string" ? doc.version : null,
      integrity: computeIntegrity(doc).integrity,
    });
  }

  /** An identical admission returns the registered entry (data-model §4). */
  #existing(s: Stored): AdmissionResult | null {
    const existing = this.#stored.get(keyOf(s));
    if (!existing) return null;
    const entry = this.snapshot().entries.find((e) => sameRef(e, existing))!;
    return deepFreeze({ status: "already-registered", entry, diagnostics: [...existing.diagnostics], error: null });
  }

  /** The capacity bound refuses; nothing is ever evicted (FR-C074). */
  #full(s: Stored, diagnostics: readonly Diagnostic[] = s.diagnostics): AdmissionResult | null {
    if (this.#stored.size < this.#settings().registryCapacity) return null;
    return refused(operationalError("registry-capacity", "registry.admit", "The registry is full."), diagnostics);
  }

  #store(stored: Stored, validity: Validity, gate: RegistryEntry["gate"], evaluation?: ThemeEvaluation): AdmissionResult {
    this.#stored.set(keyOf(stored), stored);
    if (stored.kind === "theme") this.#themeGeneration += 1;
    this.#changed();
    // A theme that does not inherit is evaluated exactly as admission just did; reuse it.
    if (evaluation && stored.document.extends === undefined) {
      stored.cached = { key: this.#evaluationKey(stored, this.#activeHost()), value: evaluation };
    }
    return deepFreeze({
      status: validity === "valid" ? "registered" : "invalid",
      entry: this.#publicEntry(stored, validity, gate),
      diagnostics: [...stored.diagnostics],
      error: null,
    });
  }

  remove(ref: RegistryEntryRef): Snapshot {
    for (const [key, s] of this.#stored) {
      if (sameRef(s, ref)) {
        this.#stored.delete(key);
        if (s.kind === "theme") this.#themeGeneration += 1;
        this.#changed();
        break;
      }
    }
    return this.snapshot();
  }

  #bases(): BaseEntry[] {
    const out: BaseEntry[] = [];
    for (const s of this.#stored.values()) if (s.kind === "theme") out.push({ trust: s.trust, document: s.document });
    return out;
  }

  /** The active host declaration: the most recently admitted valid one (FR-C030). */
  #activeHost(): Stored | null {
    let active: Stored | null = null;
    for (const s of this.#stored.values()) if (s.kind === "host" && s.hostValid) active = s;
    return active;
  }

  #hostDocument(): Readonly<Record<string, unknown>> | null {
    return this.#activeHost()?.document ?? null;
  }

  #publicEntry(s: Omit<Stored, "cached">, validity: Validity, gate: RegistryEntry["gate"]): RegistryEntry {
    return deepFreeze({
      kind: s.kind,
      id: s.id,
      version: s.version,
      integrity: s.integrity,
      trust: s.trust,
      source: s.source,
      validity,
      gate,
      diagnostics: s.diagnostics,
    });
  }

  #evaluationKey(s: Stored, host: Stored | null): string {
    const inherits = s.document.extends !== undefined;
    return `${host?.integrity ?? ""}|${inherits ? this.#themeGeneration : ""}|${this.#settingsGeneration}`;
  }

  #evaluate(s: Stored, host: Stored | null, bases: readonly BaseEntry[]): ThemeEvaluation {
    // Re-evaluate only when an input that can change the outcome changed (FR-C041).
    const key = this.#evaluationKey(s, host);
    if (s.cached?.key === key) return s.cached.value;
    const value = evaluateTheme(s.document, s.trust, s.source, bases, host?.document ?? null, this.#settings(), this.prepared);
    s.cached = { key, value };
    return value;
  }

  snapshot(): Snapshot {
    if (this.#snapshot) return this.#snapshot;
    const host = this.#activeHost();
    const bases = this.#bases();
    const documents = new Map<RegistryEntry, Readonly<Record<string, unknown>>>();
    const merged = new Map<RegistryEntry, Readonly<Record<string, unknown>>>();
    const entries: RegistryEntry[] = [];
    let hostEntry: RegistryEntry | null = null;
    for (const s of this.#stored.values()) {
      let entry: RegistryEntry;
      if (s.kind === "host") {
        entry = this.#publicEntry(s, s.hostValid ? "valid" : "invalid", "not-applicable");
        if (s === host) hostEntry = entry;
      } else {
        const ev = this.#evaluate(s, host, bases);
        entry = this.#publicEntry(s, ev.validity, ev.gate);
        if (ev.merged) merged.set(entry, ev.merged);
      }
      documents.set(entry, s.document);
      entries.push(entry);
    }
    entries.sort(compareEntries);
    documents.set(BASELINE_ENTRY, BASELINE_DOC);
    merged.set(BASELINE_ENTRY, BASELINE_DOC);
    const snapshot: Snapshot = Object.freeze({
      sequence: this.#sequence,
      entries: Object.freeze(entries),
      host: hostEntry,
      baseline: BASELINE_ENTRY,
    });
    this.#snapshot = attachData(snapshot, { documents, merged, hostDocument: host?.document ?? null });
    return this.#snapshot;
  }
}
