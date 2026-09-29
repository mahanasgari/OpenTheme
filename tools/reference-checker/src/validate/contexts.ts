import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticCollector } from "../diagnostics/collector.js";
import { canonicalize, type Json } from "../canonical/jcs.js";
import { flattenTokens } from "../tokens/graph.js";
import { isValidSegment } from "../tokens/paths.js";

interface DimRegistry {
  dimensions: Record<string, { values: string[]; variantsAllowed?: boolean }>;
}

interface BaselineFile {
  tokens: { path: string }[];
}

let dims: DimRegistry | undefined;
let baselinePaths: Set<string> | undefined;

function loadDims(): DimRegistry {
  if (dims) return dims;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/context-dimensions.json",
  );
  dims = JSON.parse(readFileSync(path, "utf8")) as DimRegistry;
  return dims;
}

function loadBaselinePaths(): Set<string> {
  if (baselinePaths) return baselinePaths;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/semantic-baseline.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as BaselineFile;
  baselinePaths = new Set(data.tokens.map((t) => t.path));
  return baselinePaths;
}

function isTokenObject(node: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(node, "$value") ||
    Object.prototype.hasOwnProperty.call(node, "$derive")
  );
}

function overlayTokenPaths(
  tree: Record<string, unknown>,
  prefix: string[] = [],
): string[] {
  const out: string[] = [];
  for (const [key, raw] of Object.entries(tree)) {
    if (key.startsWith("$")) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const node = raw as Record<string, unknown>;
    const parts = [...prefix, key];
    if (isTokenObject(node)) {
      out.push(parts.join("."));
    }
    out.push(...overlayTokenPaths(node, parts));
  }
  return out;
}

/**
 * Validate context overlays: dimensions, duplicate when, scheme support,
 * undeclared tokens (not in theme tokens and not in the semantic baseline).
 */
export function validateContexts(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): void {
  const contexts = doc.contexts;
  if (contexts === undefined) return;
  if (!Array.isArray(contexts)) return;

  const registry = loadDims();
  const baseline = loadBaselinePaths();
  const supported = new Set(
    (doc.colorSchemes as { supported?: string[] } | undefined)?.supported ?? [],
  );
  const declared = new Set<string>(baseline);
  const tokens = doc.tokens;
  if (tokens && typeof tokens === "object" && !Array.isArray(tokens)) {
    for (const [path, n] of flattenTokens(tokens as Record<string, unknown>)) {
      if (n.isToken) declared.add(path);
    }
  }

  const seenWhen = new Map<string, number>();

  contexts.forEach((overlay, index) => {
    if (!overlay || typeof overlay !== "object" || Array.isArray(overlay)) {
      return;
    }
    const o = overlay as { when?: Record<string, unknown>; tokens?: unknown };
    const pointer = `/contexts/${index}`;

    if (!o.when || typeof o.when !== "object" || Array.isArray(o.when)) {
      collector.add({
        code: "OT-CTX-001",
        rule: "R-CTX-001",
        location: { document: "theme", pointer: `${pointer}/when` },
        params: { detail: "missing when" },
      });
      return;
    }

    const when = o.when;
    for (const [dim, val] of Object.entries(when)) {
      const def = registry.dimensions[dim];
      if (!def) {
        collector.add({
          code: "OT-CTX-001",
          rule: "R-CTX-001",
          location: {
            document: "theme",
            pointer: `${pointer}/when/${dim}`,
          },
          params: { detail: dim },
        });
        continue;
      }
      if (typeof val !== "string" || !def.values.includes(val)) {
        collector.add({
          code: "OT-CTX-001",
          rule: "R-CTX-001",
          location: {
            document: "theme",
            pointer: `${pointer}/when/${dim}`,
          },
          params: { detail: String(val) },
        });
      }
      if (
        dim === "colorScheme" &&
        typeof val === "string" &&
        def.values.includes(val) &&
        !supported.has(val)
      ) {
        collector.add({
          code: "OT-CTX-003",
          rule: "R-CTX-003",
          location: {
            document: "theme",
            pointer: `${pointer}/when/colorScheme`,
          },
          params: { detail: val },
        });
      }
    }

    const whenKey = canonicalize(when as Json);
    if (seenWhen.has(whenKey)) {
      collector.add({
        code: "OT-CTX-002",
        rule: "R-CTX-002",
        location: { document: "theme", pointer: `${pointer}/when` },
        related: [
          {
            document: "theme",
            pointer: `/contexts/${seenWhen.get(whenKey)}/when`,
          },
        ],
        params: { detail: whenKey },
      });
    } else {
      seenWhen.set(whenKey, index);
    }

    if (o.tokens && typeof o.tokens === "object" && !Array.isArray(o.tokens)) {
      const paths = overlayTokenPaths(o.tokens as Record<string, unknown>);
      for (const path of paths) {
        const segs = path.split(".");
        if (!segs.every((s, i) => isValidSegment(s, i === 0))) continue;
        if (!declared.has(path)) {
          collector.add({
            code: "OT-CTX-004",
            rule: "R-CTX-004",
            location: {
              document: "theme",
              pointer: `${pointer}/tokens/${segs.join("/")}`,
            },
            params: { detail: path },
          });
        }
      }
    }
  });
}
