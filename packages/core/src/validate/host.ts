/**
 * Host declaration validation (chapter 17).
 */
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { escapeSegment, isRecord } from "../engine/model.js";
import { TOKEN_TYPES, limit } from "../engine/registry.js";
import { JsonParseError, parseIJson } from "../parse/ijson.js";
import { hostSchemaFindings, reportSchema } from "./schema.js";

const H = "host";
const STATES = new Set(["default", "hover", "focus-visible", "pressed", "disabled", "selected", "invalid"]);
const RESERVED = ["std", "org.opentheme", "uid"];
const MAX_LAYOUT_VARIANTS = 16;

export interface HostValidation {
  readonly valid: boolean;
  readonly diagnostics: Diagnostic[];
  readonly document?: Readonly<Record<string, unknown>>;
}

export function validateHost(input: string | Uint8Array | unknown): HostValidation {
  const c = new DiagnosticCollector(H);
  let value: unknown = input;
  if (typeof input === "string" || input instanceof Uint8Array) {
    try {
      value = parseIJson(input, { maxBytes: limit("documentBytes"), maxDepth: limit("nestingDepth") });
    } catch (e) {
      if (!(e instanceof JsonParseError)) throw e;
      const code = { bytes: "OT-LIM-001", depth: "OT-LIM-002", syntax: "OT-DOC-001", duplicate: "OT-DOC-002" }[e.failure];
      c.add(code, { document: H, pointer: e.failure === "duplicate" ? e.pointer : "/" });
      return { valid: false, diagnostics: c.finish() };
    }
  }
  if (!isRecord(value)) {
    c.add("OT-DOC-001", { document: H, pointer: "/" });
    return { valid: false, diagnostics: c.finish() };
  }
  const doc = value;
  const schema = hostSchemaFindings(doc);
  const semantic = new DiagnosticCollector(H);
  if (typeof doc.id === "string" && RESERVED.some((r) => doc.id === r || (doc.id as string).startsWith(`${r}.`))) {
    semantic.add("OT-HOST-001", { document: H, pointer: "/id" });
  }
  if (Array.isArray(doc.contracts)) {
    const seen = new Set<string>();
    doc.contracts.forEach((raw, i) => {
      if (!isRecord(raw)) return;
      const ptr = `/contracts/${i}`;
      if (typeof raw.id === "string") {
        if (seen.has(raw.id)) semantic.add("OT-HOST-004", { document: H, pointer: `${ptr}/id` });
        seen.add(raw.id);
      }
      if (Array.isArray(raw.states) && raw.states.some((s) => typeof s !== "string" || !STATES.has(s))) {
        semantic.add("OT-HOST-002", { document: H, pointer: `${ptr}/states` });
      }
      const props = isRecord(raw.properties) ? raw.properties : {};
      const defaults = isRecord(raw.defaults) ? raw.defaults : {};
      for (const [part, pprops] of Object.entries(props)) {
        if (!isRecord(pprops)) continue;
        for (const [prop, type] of Object.entries(pprops)) {
          if (typeof type !== "string" || !TOKEN_TYPES.has(type)) {
            semantic.add("OT-HOST-002", { document: H, pointer: `${ptr}/properties/${escapeSegment(part)}/${escapeSegment(prop)}` });
          }
        }
        const partDefaults = defaults[part];
        const missing = Object.keys(pprops).some((prop) => !isRecord(partDefaults) || partDefaults[prop] === undefined);
        if (missing) semantic.add("OT-HOST-003", { document: H, pointer: `${ptr}/defaults/${escapeSegment(part)}` });
      }
    });
  }
  if (isRecord(doc.layoutVariants)) {
    for (const [region, entry] of Object.entries(doc.layoutVariants)) {
      if (isRecord(entry) && Array.isArray(entry.variants) && entry.variants.length > MAX_LAYOUT_VARIANTS) {
        semantic.add("OT-LIM-005", { document: H, pointer: `/layoutVariants/${escapeSegment(region)}/variants` });
      }
    }
  }
  // A semantic host finding supersedes schema failures at or below its location (chapter 17).
  const semanticFindings = semantic.finish();
  const covered = semanticFindings.map((d) => d.location.pointer);
  reportSchema(
    c,
    H,
    schema.filter((f) => !covered.some((p) => f.pointer === p || f.pointer.startsWith(`${p}/`))),
  );
  c.addAll(semanticFindings);
  const diagnostics = c.finish();
  return { valid: !diagnostics.some((d) => d.severity === "error"), diagnostics, document: doc };
}
