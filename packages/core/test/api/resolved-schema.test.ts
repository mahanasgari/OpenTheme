/** Every Core resolution result conforms to resolved-theme.schema.json (contracts/public-api.md). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Ajv2020Module from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { createCore } from "../../src/index.js";
import { ROOT } from "../helpers.js";
import { bytesOf, fixtures } from "../fixtures.js";

const Ajv2020 = (Ajv2020Module as unknown as { default: typeof Ajv2020Module }).default ?? Ajv2020Module;
// biome-ignore lint/suspicious/noExplicitAny: Ajv constructor typing differs across module formats
const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : n.endsWith(".json") ? [join(dir, n)] : []));
for (const f of walk(join(ROOT, "specification/schemas"))) {
  const s = JSON.parse(readFileSync(f, "utf8")) as { $id?: string };
  if (s.$id) ajv.addSchema(s);
}
const validate = ajv.getSchema("https://opentheme.org/schemas/1.0/resolved-theme.schema.json");
const ALL = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;

describe("resolved results conform to the schema", () => {
  const cases = fixtures("resolution").filter((f) => f.kind === "resolve");
  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const core = createCore({ untrustedSources: ALL, accessibilityGate: "relaxed" });
    const input = f.input as Record<string, unknown> & { themes?: { trust?: string; document: unknown }[] };
    if (input.host) core.registry.admit({ kind: "host", bytes: bytesOf(input.host), trust: "trusted" });
    for (const t of input.themes ?? []) {
      const trusted = t.trust === "trusted";
      core.registry.admit({ kind: "theme", bytes: bytesOf(t.document), trust: trusted ? "trusted" : "untrusted", ...(trusted ? {} : { source: "shared" }) });
    }
    if (input.theme) core.registry.admit({ kind: "theme", bytes: bytesOf(input.theme), trust: "trusted" });
    const r = core.resolve(core.registry.snapshot(), {
      policy: (input.policy ?? {}) as never,
      selection: input.selection as never,
      previous: (input.previous ?? null) as never,
      preferences: (input.preferences ?? {}) as never,
      platform: input.platform as never,
      environment: input.environment as never,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ok = validate(JSON.parse(JSON.stringify(r.resolved)));
    expect(ok, JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
  });
});
