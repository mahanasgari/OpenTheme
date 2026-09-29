import { literalRangeOk, literalShapeOk } from "./literals.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import {
  analyzeTokenGraph,
  flattenTokens,
  type ExternalRef,
} from "../tokens/graph.js";
import { isValidPath, isValidSegment, parseAlias } from "../tokens/paths.js";
import { isTokenType, type TokenType } from "../tokens/types.js";

const RESERVED_HINT = new Set(["seed"]);

/** Normative `$` members on token leaves (theme-document contract). */
const ALLOWED_LEAF_DOLLAR = new Set([
  "$type",
  "$value",
  "$derive",
  "$description",
  "$deprecated",
  "$extensions",
]);

/** Normative `$` members on token groups. */
const ALLOWED_GROUP_DOLLAR = new Set([
  "$type",
  "$description",
  "$deprecated",
  "$extensions",
]);

function isTokenObject(node: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(node, "$value") ||
    Object.prototype.hasOwnProperty.call(node, "$derive")
  );
}

function rejectUnknownDollarMembers(
  node: Record<string, unknown>,
  pointer: string,
  collector: DiagnosticCollector,
): void {
  const allowed = isTokenObject(node) ? ALLOWED_LEAF_DOLLAR : ALLOWED_GROUP_DOLLAR;
  for (const key of Object.keys(node)) {
    if (!key.startsWith("$")) continue;
    if (allowed.has(key)) continue;
    collector.add({
      code: "OT-DOC-003",
      rule: "R-DOC-003",
      location: { document: "theme", pointer: `${pointer}/${key}` },
      params: { detail: key },
    });
  }
}

let baselineRefs: Map<string, ExternalRef> | undefined;

/** Baseline tokens always exist through their specification defaults (FR-016, FR-017; F25). */
function baselineExternalRefs(): Map<string, ExternalRef> {
  if (baselineRefs) return baselineRefs;
  const file = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/semantic-baseline.json",
  );
  const data = JSON.parse(readFileSync(file, "utf8")) as { tokens: { path: string; type: string }[] };
  baselineRefs = new Map(data.tokens.map((t) => [t.path, { type: t.type }]));
  return baselineRefs;
}

function seedExternalRefs(doc: Record<string, unknown>): Map<string, ExternalRef> {
  const out = new Map<string, ExternalRef>();
  const seeds = doc.seeds as Record<string, unknown> | undefined;
  if (!seeds || typeof seeds !== "object") return out;
  for (const [scheme, block] of Object.entries(seeds)) {
    if (scheme === "fontFamily") {
      out.set("seed.font-family", { type: "fontFamily" });
      continue;
    }
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const b = block as Record<string, unknown>;
    if (b.background !== undefined) out.set("seed.background", { type: "color" });
    if (b.foreground !== undefined) out.set("seed.foreground", { type: "color" });
    if (b.accent !== undefined) out.set("seed.accent", { type: "color" });
  }
  return out;
}

function hostExternalRefs(
  host: Record<string, unknown> | null | undefined,
): Map<string, ExternalRef> {
  const out = new Map<string, ExternalRef>();
  if (!host || typeof host.id !== "string" || !host.tokens) return out;
  if (typeof host.tokens !== "object" || Array.isArray(host.tokens)) return out;
  const flat = flattenTokens(host.tokens as Record<string, unknown>);
  for (const [localPath, node] of flat) {
    if (!node.isToken) continue;
    out.set(`${host.id}/${localPath}`, { type: node.type ?? "color" });
  }
  return out;
}

function literalMatchesType(type: string | undefined, value: unknown): boolean {
  if (parseAlias(value)) return true; // alias — type checked via graph
  if (!type) return true;
  return literalShapeOk(type, value);
}

function valueInRange(type: string | undefined, value: unknown): boolean {
  if (parseAlias(value) || !type) return true;
  return literalRangeOk(type, value);
}

/**
 * Validate the tokens tree: path grammar, $value/$derive exclusivity, types,
 * unknown `$` members, and the reference graph (OT-REF-*).
 */
export function validateTokens(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
  host?: Record<string, unknown> | null,
): void {
  const tokens = doc.tokens;
  if (tokens === undefined) return;
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    collector.add({
      code: "OT-TOK-004",
      rule: "R-TOK-004",
      location: { document: "theme", pointer: "/tokens" },
      params: { detail: "tokens must be an object" },
    });
    return;
  }

  const tree = tokens as Record<string, unknown>;
  rejectUnknownDollarMembers(tree, "/tokens", collector);

  // Walk for path / exclusivity / grammar
  function walk(
    obj: Record<string, unknown>,
    pathParts: string[],
    pointer: string,
    inheritedType: string | undefined,
  ): void {
    for (const [key, raw] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;
      if (!isValidSegment(key, pathParts.length === 0)) {
        const code =
          key.length > 64 ? "OT-LIM-006" : "OT-TOK-001";
        collector.add({
          code,
          rule: code.replace(/^OT-/, "R-"),
          location: { document: "theme", pointer: `${pointer}/${key}` },
          params: { detail: key },
        });
        continue;
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const node = raw as Record<string, unknown>;
      const parts = [...pathParts, key];
      const path = parts.join(".");
      const ptr = `${pointer}/${key}`;

      rejectUnknownDollarMembers(node, ptr, collector);

      if (node.$deprecated) {
        const dep = node.$deprecated;
        const replacement =
          dep && typeof dep === "object" && !Array.isArray(dep)
            ? String((dep as { replacement?: string }).replacement ?? "")
            : "";
        collector.add({
          code: "OT-VER-005",
          rule: "R-VER-005",
          location: { document: "theme", pointer: ptr },
          params: {
            detail: path,
            ...(replacement ? { replacement } : {}),
          },
          severity: "warning",
        });
      }

      if (pathParts.length === 0 && RESERVED_HINT.has(key)) {
        collector.add({
          code: "OT-TOK-003",
          rule: "R-TOK-003",
          location: { document: "theme", pointer: ptr },
          params: { detail: key },
        });
      }

      if (!isValidPath(path)) {
        const code = path.length > 256 ? "OT-LIM-006" : "OT-TOK-001";
        collector.add({
          code,
          rule: code.replace(/^OT-/, "R-"),
          location: { document: "theme", pointer: ptr },
          params: { detail: path },
        });
      }

      const type =
        typeof node.$type === "string" ? node.$type : inheritedType;
      if (typeof node.$type === "string" && !isTokenType(node.$type)) {
        collector.add({
          code: "OT-TOK-006",
          rule: "R-TOK-006",
          location: { document: "theme", pointer: `${ptr}/$type` },
          params: { detail: node.$type },
        });
      }

      if (isTokenObject(node)) {
        const hasValue = Object.prototype.hasOwnProperty.call(node, "$value");
        const hasDerive = Object.prototype.hasOwnProperty.call(node, "$derive");
        if (hasValue === hasDerive) {
          collector.add({
            code: "OT-TOK-007",
            rule: "R-TOK-007",
            location: { document: "theme", pointer: ptr },
            params: { detail: path },
          });
        }
        if (hasValue && !literalMatchesType(type, node.$value)) {
          collector.add({
            code: "OT-TOK-004",
            rule: "R-TOK-004",
            location: { document: "theme", pointer: `${ptr}/$value` },
            params: { detail: path },
          });
        } else if (hasValue && !valueInRange(type, node.$value)) {
          collector.add({
            code: "OT-TOK-005",
            rule: "R-TOK-005",
            location: { document: "theme", pointer: `${ptr}/$value` },
            params: { detail: path },
          });
        }
      }

      walk(node, parts, ptr, type);
    }
  }

  walk(tree, [], "/tokens", undefined);

  // Reference graph — seed.* and host-qualified paths are permitted externals
  const externals = new Map<string, ExternalRef>();
  for (const [p, e] of baselineExternalRefs()) {
    if (!p.startsWith("seed.")) externals.set(p, e);
  }
  for (const [p, e] of seedExternalRefs(doc)) externals.set(p, e);
  for (const [p, e] of hostExternalRefs(host)) externals.set(p, e);
  analyzeTokenGraph(tree, collector, "theme", externals);
}
