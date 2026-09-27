/**
 * Migration manifests (chapter 14, FR-081, FR-082): `{ from, to, operations }` with
 * rename-path, move-member, map-value, and drop-member. Lossy drops emit OT-VER-004; a migrated
 * document emits OT-VER-003 at /opentheme.
 */
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { isRecord } from "../engine/model.js";

export interface MigrationManifest {
  readonly from: string;
  readonly to: string;
  readonly operations: readonly Record<string, unknown>[];
}

function parsePointer(p: string): string[] {
  if (p === "" || p === "/") return [];
  return p
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function getAt(root: unknown, segs: readonly string[]): { parent: Record<string, unknown>; key: string } | null {
  let cur: unknown = root;
  for (let i = 0; i < segs.length - 1; i += 1) {
    if (!isRecord(cur)) return null;
    cur = cur[segs[i]!];
  }
  return isRecord(cur) && segs.length > 0 ? { parent: cur, key: segs[segs.length - 1]! } : null;
}

function setAt(root: Record<string, unknown>, segs: readonly string[], value: unknown): void {
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const k = segs[i]!;
    if (!isRecord(cur[k])) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]!] = value;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function majorOf(v: string): string {
  return v.split(".")[0] ?? "";
}

export function migrateTheme(
  theme: Readonly<Record<string, unknown>>,
  manifest: MigrationManifest,
): { migrated: boolean; document: Record<string, unknown>; diagnostics: Diagnostic[] } {
  const c = new DiagnosticCollector("theme");
  const doc = clone(theme) as Record<string, unknown>;
  if (typeof doc.opentheme !== "string" || majorOf(doc.opentheme) !== majorOf(manifest.from)) {
    return { migrated: false, document: doc, diagnostics: c.finish() };
  }
  for (const op of manifest.operations) {
    switch (op.op) {
      case "rename-path": {
        const from = ["tokens", ...String(op.from).split(".")];
        const to = ["tokens", ...String(op.to).split(".")];
        const at = getAt(doc, from);
        if (at && at.key in at.parent) {
          const v = at.parent[at.key];
          delete at.parent[at.key];
          setAt(doc, to, v);
        }
        break;
      }
      case "move-member": {
        const at = getAt(doc, parsePointer(String(op.from)));
        if (at && at.key in at.parent) {
          const v = at.parent[at.key];
          delete at.parent[at.key];
          setAt(doc, parsePointer(String(op.to)), v);
        }
        break;
      }
      case "map-value": {
        const at = getAt(doc, parsePointer(String(op.at)));
        const mapping = isRecord(op.mapping) ? op.mapping : {};
        if (at && at.key in at.parent) {
          const key = JSON.stringify(at.parent[at.key]);
          const hit = Object.entries(mapping).find(([k]) => k === at.parent[at.key] || k === key);
          if (hit) at.parent[at.key] = hit[1];
        }
        break;
      }
      case "drop-member": {
        const ptr = String(op.at);
        const at = getAt(doc, parsePointer(ptr));
        if (at && at.key in at.parent) {
          delete at.parent[at.key];
          if (op.lossy === true) c.add("OT-VER-004", { document: "theme", pointer: ptr });
        }
        break;
      }
      default:
        break;
    }
  }
  doc.opentheme = manifest.to;
  c.add("OT-VER-003", { document: "theme", pointer: "/opentheme" });
  return { migrated: true, document: doc, diagnostics: c.finish() };
}
