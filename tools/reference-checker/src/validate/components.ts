import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticCollector } from "../diagnostics/collector.js";

interface Contract {
  id: string;
  version: string;
  parts: string[];
  states: string[];
  variants: Record<string, string[]>;
  properties: Record<string, Record<string, string>>;
}

interface CatalogFile {
  contracts: Contract[];
}

let catalog: Map<string, Contract> | undefined;

function loadCatalog(): Map<string, Contract> {
  if (catalog) return catalog;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specification/registry/1.0/component-catalog.json",
  );
  const data = JSON.parse(readFileSync(path, "utf8")) as CatalogFile;
  catalog = new Map(data.contracts.map((c) => [c.id, c]));
  return catalog;
}

/**
 * Validate theme component styling against the catalog (and optional host contracts).
 * Without a host, unknown contracts are OT-CMP-001 (info).
 */
export function validateComponents(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
  host?: Record<string, unknown> | null,
): void {
  const components = doc.components;
  if (!components || typeof components !== "object" || Array.isArray(components)) {
    return;
  }

  const cat = loadCatalog();
  if (host && Array.isArray(host.contracts)) {
    for (const c of host.contracts as Contract[]) {
      if (c?.id) cat.set(c.id, c);
    }
  }

  for (const [contractId, styling] of Object.entries(
    components as Record<string, unknown>,
  )) {
    const pointer = `/components/${contractId.replace(/~/g, "~0").replace(/\//g, "~1")}`; // RFC 6901 (F28)
    const contract = cat.get(contractId);
    if (!contract) {
      // Host-extension contracts (ns/name) are checked at resolve when a host is supplied.
      if (contractId.includes("/") && !contractId.startsWith("std/")) {
        continue;
      }
      collector.add({
        code: "OT-CMP-001",
        rule: "R-CMP-001",
        location: { document: "theme", pointer },
        params: { detail: contractId },
        severity: "info",
      });
      continue;
    }

    if (!styling || typeof styling !== "object" || Array.isArray(styling)) {
      continue;
    }
    const style = styling as Record<string, unknown>;

    // Version pin: `contract` (schema) or `$version` (legacy)
    const versionPin =
      typeof style.contract === "string"
        ? style.contract
        : typeof style.$version === "string"
          ? style.$version
          : undefined;
    if (versionPin !== undefined) {
      const majorMinor = contract.version.replace(/\.\d+$/, "") || contract.version;
      // Accept MAJOR.MINOR pin against MAJOR.MINOR.PATCH catalog version
      const pinOk =
        versionPin === contract.version ||
        contract.version.startsWith(`${versionPin}.`) ||
        versionPin === majorMinor;
      if (!pinOk) {
        collector.add({
          code: "OT-CMP-002",
          rule: "R-CMP-002",
          location: {
            document: "theme",
            pointer: `${pointer}/${style.contract !== undefined ? "contract" : "$version"}`,
          },
          params: { detail: versionPin },
          severity: "info",
        });
      }
    }

    const partsRoot =
      style.parts && typeof style.parts === "object" && !Array.isArray(style.parts)
        ? (style.parts as Record<string, unknown>)
        : style;

    for (const [part, partStyle] of Object.entries(partsRoot)) {
      if (part.startsWith("$") || part === "contract" || part === "parts" || part === "variants") {
        continue;
      }
      if (!contract.parts.includes(part)) {
        collector.add({
          code: "OT-CMP-003",
          rule: "R-CMP-003",
          location: {
            document: "theme",
            pointer:
              style.parts !== undefined
                ? `${pointer}/parts/${part}`
                : `${pointer}/${part}`,
          },
          params: { detail: part },
        });
        continue;
      }
      if (!partStyle || typeof partStyle !== "object" || Array.isArray(partStyle)) {
        continue;
      }
      const props = partStyle as Record<string, unknown>;
      const allowedProps = contract.properties[part] ?? {};
      const partPointer =
        style.parts !== undefined
          ? `${pointer}/parts/${part}`
          : `${pointer}/${part}`;

      for (const [prop, value] of Object.entries(props)) {
        if (prop.startsWith("$") && prop !== "$states" && prop !== "$variants") {
          continue;
        }
        if (prop === "$states" || prop === "$variants") {
          checkStatesOrVariants(
            prop,
            value,
            contract,
            collector,
            partPointer,
          );
          continue;
        }
        if (!(prop in allowedProps)) {
          collector.add({
            code: "OT-CMP-003",
            rule: "R-CMP-003",
            location: {
              document: "theme",
              pointer: `${partPointer}/${prop}`,
            },
            params: { detail: prop },
          });
          continue;
        }
        // Property value may nest $states / $variants
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const nested = value as Record<string, unknown>;
          if (nested.$states !== undefined) {
            checkStatesOrVariants(
              "$states",
              nested.$states,
              contract,
              collector,
              `${partPointer}/${prop}`,
            );
          }
          if (nested.$variants !== undefined) {
            checkStatesOrVariants(
              "$variants",
              nested.$variants,
              contract,
              collector,
              `${partPointer}/${prop}/$variants`,
            );
          }
        }
      }
    }

    // Variant styling under components.<id>.variants
    if (style.variants && typeof style.variants === "object" && !Array.isArray(style.variants)) {
      checkStatesOrVariants(
        "$variants",
        style.variants,
        contract,
        collector,
        `${pointer}/variants`,
      );
    }
  }
}

function checkStatesOrVariants(
  kind: "$states" | "$variants",
  value: unknown,
  contract: Contract,
  collector: DiagnosticCollector,
  /** For `$states`, the property; for `$variants`, the variants object itself. */
  pointerBase: string,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  if (kind === "$states") {
    for (const state of Object.keys(value as object)) {
      if (!contract.states.includes(state)) {
        collector.add({
          code: "OT-CMP-004",
          rule: "R-CMP-004",
          location: {
            document: "theme",
            pointer: `${pointerBase}/$states/${state}`,
          },
          params: { detail: state },
        });
      }
    }
    return;
  }
  for (const [axis, vals] of Object.entries(value as Record<string, unknown>)) {
    const allowed = contract.variants[axis];
    if (!allowed) {
      collector.add({
        code: "OT-CMP-004",
        rule: "R-CMP-004",
        location: {
          document: "theme",
          pointer: `${pointerBase}/${axis}`,
        },
        params: { detail: axis },
      });
      continue;
    }
    if (vals && typeof vals === "object" && !Array.isArray(vals)) {
      for (const v of Object.keys(vals as object)) {
        if (!allowed.includes(v)) {
          collector.add({
            code: "OT-CMP-004",
            rule: "R-CMP-004",
            location: {
              document: "theme",
              pointer: `${pointerBase}/${axis}/${v}`,
            },
            params: { detail: v },
          });
        }
      }
    }
  }
}
