/**
 * Theme migration via migration manifests (FR-081, FR-082).
 */
import type { Diagnostic } from "../diagnostics/collector.js";
import { DiagnosticCollector } from "../diagnostics/collector.js";

export interface MigrationManifest {
  from: string;
  to: string;
  operations: MigrationOp[];
}

export type MigrationOp =
  | { op: "rename-path"; from: string; to: string }
  | { op: "move-member"; from: string; to: string }
  | { op: "map-value"; at: string; mapping: Record<string, unknown> }
  | { op: "drop-member"; at: string; lossy: true };

function getAtPointer(doc: Record<string, unknown>, pointer: string): unknown {
  if (!pointer || pointer === "/") return doc;
  const parts = pointer.replace(/^\//, "").split("/");
  let cur: unknown = doc;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return cur;
}

function setAtPointer(
  doc: Record<string, unknown>,
  pointer: string,
  value: unknown,
): void {
  const parts = pointer.replace(/^\//, "").split("/");
  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!(key in cur) || typeof cur[key] !== "object" || cur[key] === null) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!.replace(/~1/g, "/").replace(/~0/g, "~");
  cur[last] = value;
}

function deleteAtPointer(doc: Record<string, unknown>, pointer: string): boolean {
  const parts = pointer.replace(/^\//, "").split("/");
  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!(key in cur) || typeof cur[key] !== "object") return false;
    cur = cur[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!.replace(/~1/g, "/").replace(/~0/g, "~");
  if (!(last in cur)) return false;
  delete cur[last];
  return true;
}

function renameTokenPath(
  doc: Record<string, unknown>,
  fromPath: string,
  toPath: string,
): void {
  const tokens = doc.tokens as Record<string, unknown> | undefined;
  if (!tokens) return;
  const fromParts = fromPath.split(".");
  const toParts = toPath.split(".");
  let src: unknown = tokens;
  for (const p of fromParts) {
    if (!src || typeof src !== "object") return;
    src = (src as Record<string, unknown>)[p];
  }
  if (src === undefined) return;
  let dest: Record<string, unknown> = tokens;
  for (let i = 0; i < toParts.length - 1; i += 1) {
    const k = toParts[i]!;
    if (!(k in dest) || typeof dest[k] !== "object") dest[k] = {};
    dest = dest[k] as Record<string, unknown>;
  }
  dest[toParts[toParts.length - 1]!] = src;
  // remove old
  let cur: Record<string, unknown> = tokens;
  for (let i = 0; i < fromParts.length - 1; i += 1) {
    cur = cur[fromParts[i]!] as Record<string, unknown>;
    if (!cur) return;
  }
  delete cur[fromParts[fromParts.length - 1]!];
}

export interface MigrateResult {
  document: Record<string, unknown>;
  diagnostics: Diagnostic[];
  migrated: boolean;
}

/**
 * Apply a migration manifest. Under profile `simulated-previous-major`,
 * themes targeting the previous major are accepted with OT-VER-003.
 * Themes outside that window are unsupported (migrated: false, no rewrite).
 */
export function migrateTheme(
  theme: Record<string, unknown>,
  manifest: MigrationManifest,
  options: { profile?: string } = {},
): MigrateResult {
  const collector = new DiagnosticCollector();
  const doc = structuredClone(theme) as Record<string, unknown>;
  const target = String(doc.opentheme ?? "");
  const fromMajor = manifest.from.split(".")[0]!;
  const toMajor = manifest.to.split(".")[0]!;

  if (options.profile === "simulated-previous-major") {
    if (target.split(".")[0] !== fromMajor) {
      return {
        document: doc,
        diagnostics: collector.finish(),
        migrated: false,
      };
    }
    collector.add({
      code: "OT-VER-003",
      rule: "R-VER-003",
      location: { document: "theme", pointer: "/opentheme" },
      params: { detail: manifest.to },
      severity: "info",
    });
  } else if (target.split(".")[0] === toMajor) {
    // Already on target major — no-op
    return {
      document: doc,
      diagnostics: collector.finish(),
      migrated: false,
    };
  }

  for (const op of manifest.operations) {
    if (op.op === "rename-path") {
      renameTokenPath(doc, op.from, op.to);
    } else if (op.op === "move-member") {
      const val = getAtPointer(doc, op.from);
      if (val !== undefined) {
        setAtPointer(doc, op.to, val);
        deleteAtPointer(doc, op.from);
      }
    } else if (op.op === "map-value") {
      const cur = getAtPointer(doc, op.at);
      const key =
        typeof cur === "string" || typeof cur === "number"
          ? String(cur)
          : JSON.stringify(cur);
      if (key in op.mapping) {
        setAtPointer(doc, op.at, op.mapping[key]);
      }
    } else if (op.op === "drop-member") {
      if (deleteAtPointer(doc, op.at)) {
        collector.add({
          code: "OT-VER-004",
          rule: "R-VER-004",
          location: { document: "theme", pointer: op.at },
          params: { detail: op.at },
          severity: "warning",
        });
      }
    }
  }

  doc.opentheme = manifest.to;

  return {
    document: doc,
    diagnostics: collector.finish(),
    migrated: true,
  };
}
