import type { DiagnosticCollector } from "../diagnostics/collector.js";
import type { Declaration } from "./declare.js";

/**
 * Layer 4 developer policy locks (FR-051, FR-055, FR-070).
 * Locks map a semantic token path, or a contract property path
 * `components.<contract id>.parts.<part>.<property>`, to a literal.
 */
export function applyLocks(
  decls: Map<string, Declaration>,
  locks: Record<string, unknown> | undefined,
  collector: DiagnosticCollector,
): Map<string, Declaration> {
  if (!locks || typeof locks !== "object") return decls;
  const out = new Map(decls);

  for (const [path, value] of Object.entries(locks)) {
    if (path.startsWith("components.")) {
      // Contract property locks are applied later in component resolution;
      // record as a synthetic token path for dependents that read via the same map.
      const tokenPath = `lock.${path}`;
      out.set(tokenPath, {
        path: tokenPath,
        type: inferType(value),
        value,
        source: "theme",
      });
      // Also store under a normalized key used by resolveComponents
      out.set(path, {
        path,
        type: inferType(value),
        value,
        source: "theme",
      });
      continue;
    }

    const existing = out.get(path);
    if (existing) {
      const expected = existing.type;
      if (!valueMatchesType(value, expected)) {
        collector.add({
          code: "OT-TOK-004",
          rule: "R-TOK-004",
          location: {
            document: "input",
            pointer: `/policy/locks/${pointerEscape(path)}`,
          },
          params: { detail: `expected ${expected}` },
        });
        continue;
      }
    }

    out.set(path, {
      path,
      type: existing?.type ?? inferType(value),
      value,
      source: "theme",
    });
  }

  return out;
}

function pointerEscape(path: string): string {
  return path.replace(/~/g, "~0").replace(/\//g, "~1");
}

function inferType(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (v.colorSpace) return "color";
    if (v.unit === "px") return "dimension";
    if (v.unit === "ms") return "duration";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "string" && value.startsWith("{")) return "alias";
  if (Array.isArray(value)) return "fontFamily";
  return "unknown";
}

function valueMatchesType(value: unknown, type: string): boolean {
  const inferred = inferType(value);
  if (type === "color") return inferred === "color";
  if (type === "dimension") return inferred === "dimension";
  if (type === "number" || type === "opacity") return inferred === "number";
  if (type === "duration") return inferred === "duration";
  if (type === "fontFamily") return inferred === "fontFamily";
  return true;
}
