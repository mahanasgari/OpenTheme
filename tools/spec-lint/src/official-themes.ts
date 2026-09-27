/**
 * Official theme checks for specification/{themes/baseline,themes/reference}/ (T090).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REQUIRED_POINTS = [
  "std.accent",
  "std.color-scheme",
  "std.contrast",
  "std.text-size",
  "std.density",
  "std.corner-roundness",
  "std.motion",
];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".opentheme.json")) out.push(full);
  }
}

export function checkOfficialThemes(repoRoot: string): string[] {
  const errors: string[] = [];
  const roots = [
    join(repoRoot, "specification/themes/baseline"),
    join(repoRoot, "specification/themes/reference"),
  ];
  const files: string[] = [];
  for (const root of roots) {
    try {
      walk(root, files);
    } catch {
      errors.push(`missing theme directory ${relative(repoRoot, root)}`);
    }
  }

  for (const file of files) {
    const rel = relative(repoRoot, file).replace(/\\/g, "/");
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch (err) {
      errors.push(`${rel}: ${(err as Error).message}`);
      continue;
    }

    for (const key of [
      "id",
      "name",
      "version",
      "author",
      "license",
      "opentheme",
      "compatibility",
      "colorSchemes",
      "provenance",
    ]) {
      if (doc[key] === undefined) errors.push(`${rel}: missing ${key}`);
    }

    const origin = (doc.provenance as { origin?: string } | undefined)?.origin;
    const isBaseline = rel.includes("/baseline/");
    if (isBaseline && origin !== "specification-baseline") {
      errors.push(`${rel}: provenance.origin must be specification-baseline`);
    }
    if (!isBaseline && origin !== "prebuilt") {
      errors.push(`${rel}: provenance.origin must be prebuilt`);
    }

    const schemes = (doc.colorSchemes as { supported?: string[] } | undefined)
      ?.supported;
    if (!schemes?.includes("light") || !schemes?.includes("dark")) {
      errors.push(`${rel}: colorSchemes.supported must include light and dark`);
    }

    const points =
      (
        doc.customization as { points?: Array<{ id?: string }> } | undefined
      )?.points ?? [];
    const ids = new Set(points.map((p) => p.id).filter(Boolean));
    for (const id of REQUIRED_POINTS) {
      if (!ids.has(id)) errors.push(`${rel}: missing customization point ${id}`);
    }

    // High-contrast overlays present for each supported scheme
    const contexts = doc.contexts;
    if (Array.isArray(contexts)) {
      for (const scheme of schemes ?? []) {
        const hasHc = contexts.some((o) => {
          const when = (o as { when?: Record<string, string> })?.when;
          return when?.contrast === "high" && when?.colorScheme === scheme;
        });
        if (!hasHc && !isBaseline) {
          // Baseline relies on specification HC defaults; reference themes need overlays
          errors.push(
            `${rel}: missing high-contrast overlay for colorScheme=${scheme}`,
          );
        }
      }
    } else if (!isBaseline) {
      errors.push(`${rel}: reference theme needs high-contrast contexts`);
    }
  }

  return errors;
}
