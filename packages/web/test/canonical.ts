/** Canonical JSON for comparisons (RFC 8785 for the finite numbers and strings used here). */
export function jcs(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jcs).join(",")}]`;
  if (v && typeof v === "object") {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** A deep copy without the JSON-pointer paths listed, and without composite `physical` flags. */
export function without(tree: unknown, pointers: readonly string[], root: string): unknown {
  const drop = new Set(pointers.filter((p) => p.startsWith(`${root}/`)).map((p) => p.slice(root.length)));
  const walk = (v: unknown, at: string): unknown => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const p = `${at}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      if (drop.has(p) || k === "physical") continue;
      const w = walk(x, p);
      if (w && typeof w === "object" && !Array.isArray(w) && Object.keys(w).length === 0) continue;
      out[k] = w;
    }
    return out;
  };
  return walk(tree, "");
}
