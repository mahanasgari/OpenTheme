import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { parseIJson, ParseError } from "../parse/index.js";
import { validateThemeDocument } from "../schema/validate.js";
import { validateMetadata } from "./metadata.js";
import { validateSeeds } from "./seeds.js";
import { validateAccessibility } from "./a11y.js";
import { validateTokens } from "./tokens.js";
import { validateDerivations } from "./derivations.js";
import { validateContexts } from "./contexts.js";
import { validateComponents } from "./components.js";
import { validateCustomization } from "./customization.js";
import { validateLimits } from "./limits.js";
import { validateLayout } from "./layout.js";
import {
  mergeThemeDocuments,
  resolveInheritanceChain,
  type ThemeWithTrust,
} from "./inheritance.js";

const MAX_BYTES = 1_048_576;

export interface ValidateResult {
  valid: boolean;
  diagnostics: Diagnostic[];
  document?: Record<string, unknown>;
  /** The inheritance-merged document, when inheritance succeeded. */
  merged?: Record<string, unknown>;
}

export interface ValidateOptions {
  bases?: ThemeWithTrust[];
  host?: Record<string, unknown> | null;
}

function ruleFromCode(code: string): string {
  return code.replace(/^OT-/, "R-");
}

/**
 * Validation pipeline: size → parse → schema → version/metadata → seeds →
 * inheritance → tokens/derivations/contexts/components/customization/a11y/limits.
 */
export function validateTheme(
  bytes: Uint8Array | string,
  options: ValidateOptions = {},
): ValidateResult {
  const collector = new DiagnosticCollector();
  const text = typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
  const byteLength =
    typeof bytes === "string" ? Buffer.byteLength(text, "utf8") : bytes.byteLength;

  if (byteLength > MAX_BYTES) {
    collector.add({
      code: "OT-LIM-001",
      rule: "R-LIM-001",
      location: { document: "theme", pointer: "/" },
      params: { bytes: byteLength },
    });
    return { valid: false, diagnostics: collector.finish() };
  }

  let value: unknown;
  try {
    const parsed = parseIJson(text);
    value = parsed.value;
  } catch (err) {
    if (err instanceof ParseError) {
      collector.add({
        code: err.code,
        rule: ruleFromCode(err.code),
        location: { document: "theme", pointer: err.pointer || "/" },
        params: {},
      });
      return { valid: false, diagnostics: collector.finish() };
    }
    throw err;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    collector.add({
      code: "OT-DOC-001",
      rule: "R-DOC-001",
      location: { document: "theme", pointer: "/" },
      params: {},
    });
    return { valid: false, diagnostics: collector.finish() };
  }

  const doc = value as Record<string, unknown>;
  const schema = validateThemeDocument(doc);
  for (const d of schema.diagnostics) {
    // Token-tree value grammar is enforced by semantic validators (TOK/REF/DRV)
    // and the `$` allowlist in validateTokens (B1). Ajv oneOf noise under /tokens
    // is suppressed; unknown `$` members are never allowed via this suppression —
    // they are rejected by the explicit allowlist.
    if (d.location.pointer.startsWith("/tokens")) continue;
    // Overlay count is OT-LIM-005 (limits.json), not schema maxItems.
    if (d.location.pointer === "/contexts" && d.code === "OT-DOC-004") continue;
    collector.add({
      code: d.code,
      rule: d.rule,
      location: d.location,
      params: d.params,
      ...(d.related ? { related: d.related } : {}),
    });
  }

  const versionOk = validateMetadata(doc, collector);
  let merged: Record<string, unknown> | undefined;
  if (versionOk) {
    let working = doc;
    if (doc.extends !== undefined) {
      const inherited = resolveInheritanceChain(
        doc,
        options.bases ?? [],
        collector,
      );
      if (!inherited) {
        const diagnostics = collector.finish();
        return { valid: false, diagnostics, document: doc };
      }
      working = mergeThemeDocuments(inherited.chain, doc);
    }
    validateSeeds(working, collector);
    validateTokens(working, collector, options.host);
    validateDerivations(working, collector);
    validateContexts(working, collector);
    validateComponents(working, collector, options.host);
    validateCustomization(working, collector);
    // Step 12 evaluates the token graph, so it runs only on an error-free document (chapter 13).
    if (!collector.hasError()) validateAccessibility(working, collector);
    validateLimits(working, collector);
    // Host layout pairing is checked at resolve/selection time via selectLayoutVariants;
    // do not emit OT-LAY-* against host during document validate (keeps select fail-closed
    // focused on theme document validity).
    validateLayout(working, collector);
    merged = working;
  }

  const diagnostics = collector.finish();
  const valid = diagnostics.every((d) => d.severity !== "error");
  return { valid, diagnostics, document: doc, ...(merged ? { merged } : {}) };
}

/** Convenience for already-parsed objects (unit tests). */
export function validateThemeObject(
  doc: Record<string, unknown>,
  options: ValidateOptions = {},
): ValidateResult {
  return validateTheme(JSON.stringify(doc), options);
}
