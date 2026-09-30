/** `report` agrees with every accessibility-report fixture (SC-T001; T020). */
import { afterAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../core/test/fixtures.js";
import { AURORA, cli, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);
const doc = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

describe("report", () => {
  const cases = fixtures("accessibility");
  it.each(cases.map((f, i) => [f.id, f, i] as const))("%s", async (_id, f, i) => {
    const input = f.input as { theme: unknown; bases?: { document: unknown }[]; host?: unknown };
    const args = ["report", "--json", "--trusted"];
    if (input.host) args.push("--host", tmp.file(`${i}-host.json`, doc(input.host)));
    for (const [j, b] of (input.bases ?? []).entries()) args.push("--base", tmp.file(`${i}-b${j}.json`, doc(b.document)));
    args.push(tmp.file(`${i}.json`, doc(input.theme)));
    const r = await cli(args);
    if (f.expect.validity === "invalid") {
      expect(r.status).toBe(1);
      return;
    }
    const got = (r.json().diagnostics as { code: string; location: { document: string; pointer: string } }[]).map(
      (d) => `${d.code}|${d.location.document}|${d.location.pointer}`,
    );
    expect(got).toEqual((f.expect.diagnostics ?? []).map((d) => `${d.code}|${d.location?.document}|${d.location?.pointer}`));
    expect(r.status).toBe(0);
    expect((await cli([...args.filter((a) => a !== "--json"), "--strict"])).status).toBe(got.length > 0 ? 1 : 0);
  });

  it("a conformant theme says so", async () => {
    const r = await cli(["report", "--trusted", AURORA]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("conformant");
  });
});
