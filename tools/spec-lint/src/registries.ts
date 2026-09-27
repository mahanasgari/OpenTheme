import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export function checkRegistries(repoRoot: string): string[] {
  const errors: string[] = [];
  const dir = join(repoRoot, "specification/registry/1.0");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [`missing registry directory ${dir}`];
  }

  for (const name of files) {
    const full = join(dir, name);
    const rel = relative(repoRoot, full).replace(/\\/g, "/");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(readFileSync(full, "utf8")) as Record<string, unknown>;
    } catch (err) {
      errors.push(`${rel}: ${(err as Error).message}`);
      continue;
    }

    // Spot-check common entry arrays for description + example
    for (const key of [
      "codes",
      "diagnostics",
      "rules",
      "points",
      "tokens",
      "ops",
      "transforms",
    ]) {
      const arr = data[key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((entry, i) => {
        if (!entry || typeof entry !== "object") return;
        const e = entry as Record<string, unknown>;
        if (typeof e.description !== "string" || e.description.length === 0) {
          if (key !== "rules") {
            errors.push(`${rel}: ${key}[${i}] missing description`);
          }
        }
        if (!("example" in e) && !("examples" in e) && key !== "rules") {
          // rules use fixtures instead of examples
          if (key === "codes" || key === "diagnostics" || key === "points" || key === "tokens") {
            if (!("example" in e) && !("messageTemplate" in e)) {
              errors.push(`${rel}: ${key}[${i}] missing example`);
            }
          }
        }
      });
    }
  }

  return errors;
}
