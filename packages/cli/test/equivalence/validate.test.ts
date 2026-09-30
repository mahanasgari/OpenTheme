/**
 * `validate` agrees with the specification's expected results (SC-T001, FR-T081; T011): every
 * `validate` and `validate-host` conformance fixture, written to files and run through the CLI.
 */
import { afterAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../core/test/fixtures.js";
import { cli, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);

const doc = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const cases = fixtures("").filter((f) => f.kind === "validate" || f.kind === "validate-host");
let n = 0;

describe("validate equivalence", () => {
  it("covers the validation fixtures", () => expect(cases.length).toBeGreaterThan(140));

  it.each(cases.map((f) => [f.id, f] as const))("%s", async (_id, f) => {
    const i = f.input as { theme?: unknown; host?: unknown; bases?: { trust?: string; document: unknown }[] };
    const k = (n += 1);
    const args = ["validate", "--json", "--trusted"];
    if (f.kind === "validate" && i.host !== undefined && i.host !== null) args.push("--host", tmp.file(`${k}-host.json`, doc(i.host)));
    for (const [j, b] of (i.bases ?? []).entries()) args.push("--base", tmp.file(`${k}-base-${j}.json`, doc(b.document)));
    args.push(tmp.file(`${k}.json`, doc(f.kind === "validate-host" ? i.host : i.theme)));
    const r = await cli(args);
    const results = r.json().results as { validity: string; diagnostics: { code: string; location: { document: string; pointer: string } }[] }[];
    const target = results.at(-1)!;
    const expected = f.expect as { validity?: string; diagnostics?: { code: string; location?: { document: string; pointer: string } }[] };
    if (expected.validity) expect(target.validity).toBe(expected.validity === "unsupported" ? "invalid" : expected.validity);
    const got = target.diagnostics.map((d) => `${d.code}|${d.location.document}|${d.location.pointer}`);
    const want = (expected.diagnostics ?? []).map((d) => `${d.code}|${d.location?.document ?? "theme"}|${d.location?.pointer ?? ""}`);
    expect(got).toEqual(want);
    expect(r.status).toBe(target.validity === "valid" ? 0 : 1);
  });
});
