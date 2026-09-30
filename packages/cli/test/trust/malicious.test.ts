/**
 * Trust comes from the command line only (US7; SC-T005; T014, T015): every malicious and invalid
 * theme runs through every command as an untrusted file without a crash, and the validity equals
 * Core's untrusted admission. Nothing a document claims makes it trusted.
 */
import { join } from "node:path";
import { createCore } from "@opentheme/core";
import { afterAll, describe, expect, it } from "vitest";
import { bytesOf, fixtures } from "../../../core/test/fixtures.js";
import { cli, read, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);
const cases = fixtures("malicious", "invalid").filter((f) => (f.input as { theme?: unknown }).theme !== undefined);

describe("untrusted inputs under every command", () => {
  it("covers the suites", () => expect(cases.length).toBeGreaterThan(60));

  it.each(cases.map((f, i) => [f.id, f, i] as const))("%s", async (_id, f, i) => {
    const bytes = bytesOf((f.input as { theme: unknown }).theme);
    const file = tmp.file(`${i}.json`, bytes);
    const core = createCore({ untrustedSources: { "user-created": true } });
    const direct = core.registry.admit({ kind: "theme", bytes, trust: "untrusted", source: "user-created" });
    const expected = direct.status === "registered" ? "valid" : direct.status;
    const v = await cli(["validate", "--json", file]);
    expect((v.json().results as { validity: string }[])[0]!.validity).toBe(expected);
    for (const argv of [
      ["resolve", file],
      ["report", file],
      ["css", file],
      ["preview", file, "--out", join(tmp.dir, `${i}.html`), "--force"],
    ]) {
      const r = await cli(argv);
      expect([0, 1], argv[0]).toContain(r.status);
      expect(r.status === 0, argv[0]).toBe(expected === "valid");
    }
  });
});

describe("claims inside a document", () => {
  it("an official id and provenance stay untrusted", async () => {
    const aurora = JSON.parse(read("specification/themes/reference/org.opentheme.aurora.opentheme.json")) as Record<string, unknown>;
    const file = tmp.file("claims.json", { ...aurora, provenance: { origin: "user-created" } });
    const r = await cli(["resolve", "--json", file]);
    expect((r.json().applied as { trust: string }).trust).toBe("untrusted");
    const t = await cli(["resolve", "--json", "--trusted", file]);
    expect((t.json().applied as { trust: string }).trust).toBe("trusted");
  });

  it("--relaxed-gate is stated on standard error and in JSON", async () => {
    const file = tmp.file("relaxed.json", read("specification/themes/reference/org.opentheme.aurora.opentheme.json"));
    const human = await cli(["css", "--relaxed-gate", file]);
    expect(human.stderr).toContain("accessibility gate is relaxed");
    expect(human.stdout.startsWith(":root {")).toBe(true);
    for (const c of ["validate", "resolve", "report", "css"]) {
      expect((await cli([c, "--json", "--relaxed-gate", file])).json().gate, c).toBe("relaxed");
    }
  });
});
