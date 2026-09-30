/** `validate` behavior (US1; T012). */
import { afterAll, describe, expect, it } from "vitest";
import { AURORA, cli, GRAPHITE, NOTES_HOST, read, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);
const aurora = JSON.parse(read("specification/themes/reference/org.opentheme.aurora.opentheme.json")) as Record<string, unknown>;

describe("validate", () => {
  it("valid files exit 0", async () => {
    const r = await cli(["validate", "--trusted", AURORA, GRAPHITE, "--host", NOTES_HOST]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("3 files: 3 valid, 0 not valid");
    expect(r.stdout).toMatch(/com\.example\.notes\.opentheme-host\.json \(host\): valid/);
  });

  it("any invalid file exits 1, with every diagnostic once", async () => {
    const bad = tmp.file("bad.json", { ...aurora, id: "Not Valid", version: "1.0" });
    const r = await cli(["validate", "--trusted", AURORA, bad]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("bad.json: invalid (2 errors)");
    expect(r.stdout).toMatch(/error OT-META-001 \/id\n/);
    expect(r.stdout).toMatch(/error OT-META-003 \/version\n/);
    expect(r.stdout).toContain("hint: ");
  });

  it("--json prints exactly one JSON document", async () => {
    const r = await cli(["validate", "--json", "--trusted", AURORA]);
    expect(r.stdout.endsWith("}\n")).toBe(true);
    expect(r.json()).toMatchObject({ command: "validate", status: 0, results: [{ kind: "theme", validity: "valid", diagnostics: [] }] });
  });

  it("missing and unreadable files exit 3 without a crash", async () => {
    const r = await cli(["validate", "--trusted", AURORA, "/no/such/file.json", tmp.dir]);
    expect(r.status).toBe(3);
    expect(r.stdout).toContain("/no/such/file.json: unreadable: no such file");
    expect(r.stdout).toContain("unreadable: is a directory");
  });

  it("not JSON and oversized files get Core's codes", async () => {
    const notJson = tmp.file("not.json", "{ nope");
    const huge = tmp.file("huge.json", `{"pad":"${"x".repeat(1_100_000)}"}`);
    const r = await cli(["validate", "--json", "--trusted", notJson, huge]);
    const codes = (r.json().results as { diagnostics: { code: string }[] }[]).map((x) => x.diagnostics.map((d) => d.code));
    expect(codes).toEqual([["OT-DOC-001"], ["OT-LIM-001"]]);
    expect(r.status).toBe(1);
  });

  it("usage errors exit 2", async () => {
    expect((await cli(["validate"])).status).toBe(2);
    expect((await cli(["validate", "--wat", AURORA])).status).toBe(2);
    expect((await cli(["frobnicate"])).status).toBe(2);
  });

  it("colors only on a terminal", async () => {
    const bad = tmp.file("bad2.json", { ...aurora, version: "1.0" });
    expect((await cli(["validate", "--trusted", bad], { terminal: true })).stdout).toContain("\u001b[");
    expect((await cli(["validate", "--trusted", bad])).stdout).not.toContain("\u001b[");
    expect((await cli(["validate", "--trusted", "--no-color", bad], { terminal: true })).stdout).not.toContain("\u001b[");
  });
});
