/**
 * Untrusted text cannot drive the terminal: control characters and bidirectional overrides from
 * files are shown escaped in human output (security review, specs/004-theme-author-cli).
 */
import { afterAll, describe, expect, it } from "vitest";
import { clean } from "../../src/format.js";
import { AURORA, cli, read, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);
const HOSTILE = "x\u001b[2J\u001b]0;pwned\u0007‮\u0085\nerror FAKE";
const RAW = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

describe("terminal safety", () => {
  it("clean escapes controls, newlines, and bidi overrides", () => {
    expect(clean(HOSTILE)).toBe("x\\u{1b}[2J\\u{1b}]0;pwned\\u{7}\\u{202e}\\u{85}\\u{a}error FAKE");
    expect(clean("plain.text/ok")).toBe("plain.text/ok");
  });

  it("validate shows hostile member names escaped", async () => {
    const theme = JSON.parse(read("specification/themes/reference/org.opentheme.aurora.opentheme.json")) as Record<string, unknown>;
    const file = tmp.file("hostile.json", { ...theme, [HOSTILE]: 1, tokens: { [HOSTILE]: { $type: "number", $value: 1 } } });
    const r = await cli(["validate", "--trusted", file]);
    expect(r.status).toBe(1);
    const lines = r.stdout.split("\n");
    expect(lines.some((l) => l.includes("\\u{1b}[2J"))).toBe(true);
    for (const l of lines) expect(RAW.test(l), JSON.stringify(l)).toBe(false);
    expect(lines.filter((l) => l.startsWith("error FAKE"))).toEqual([]);
  });

  it("import reports hostile token names escaped", async () => {
    const file = tmp.file("hostile.tokens.json", { [HOSTILE]: { $type: "gradient", $value: [] } });
    const r = await cli(["import", file, "--out", `${tmp.dir}/out.json`, "--id", "uid.abcdefghijklmnopqrstuv2345"]);
    for (const l of r.stdout.split("\n")) expect(RAW.test(l), JSON.stringify(l)).toBe(false);
    expect(r.stdout).toContain("\\u{202e}");
  });

  it("colors still work on a terminal", async () => {
    const r = await cli(["validate", "--trusted", AURORA, "/no/such.json"], { terminal: true });
    expect(r.stdout).toContain("\u001b[1m");
  });
});
