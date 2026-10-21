/** `init` (US6; FR-T070, FR-T071; T026). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { newUid } from "../../src/commands/init.js";
import { STANDARD_POINTS } from "../../src/generated/minimal-theme.js";
import { cli, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);

describe("init", () => {
  it("creates a valid theme with a fresh uid and the given name", async () => {
    const path = join(tmp.dir, "new.opentheme.json");
    const r = await cli(["init", path, "--name", "Quiet Paper", "--json"]);
    expect(r.status).toBe(0);
    const theme = JSON.parse(readFileSync(path, "utf8")) as { id: string; name: string; version: string };
    expect(theme.id).toMatch(/^uid\.[a-z2-7]{26}$/);
    expect(r.json()).toMatchObject({ command: "init", id: theme.id, status: 0 });
    expect(theme).toMatchObject({ name: "Quiet Paper", version: "1.0.0" });
    expect((await cli(["validate", path])).status).toBe(0);
  });

  it("two runs give different identifiers", async () => {
    const a = join(tmp.dir, "a.json");
    const b = join(tmp.dir, "b.json");
    await cli(["init", a]);
    await cli(["init", b]);
    const id = (p: string) => (JSON.parse(readFileSync(p, "utf8")) as { id: string }).id;
    expect(id(a)).not.toBe(id(b));
  });

  it("refuses to overwrite unless --force", async () => {
    const path = tmp.file("exists.json", "{}");
    expect((await cli(["init", path])).status).toBe(3);
    expect(readFileSync(path, "utf8")).toBe("{}");
    expect((await cli(["init", path, "--force"])).status).toBe(0);
  });

  it("encodes 128 bits as 26 base32 characters", () => {
    expect(newUid(new Uint8Array(16))).toBe(`uid.${"a".repeat(26)}`);
    expect(newUid(new Uint8Array(16).fill(255))).toBe(`uid.${"7".repeat(25)}4`); // 3 leftover bits 111, padded to 11100
  });

  it("declares every standard customization point, so a color-scheme preference applies", async () => {
    const path = join(tmp.dir, "points.json");
    await cli(["init", path, "--dark"]);
    const theme = JSON.parse(readFileSync(path, "utf8")) as { customization: { points: { id: string }[] } };
    expect(theme.customization.points.map((p) => p.id)).toEqual(STANDARD_POINTS);
    const r = await cli(["resolve", path, "--trusted", "--preset", "common-personalization", "--set", 'std.color-scheme="dark"', "--json"]);
    expect(r.status).toBe(0);
    expect((r.json() as { resolved: { context: { colorScheme: string } } }).resolved.context.colorScheme).toBe("dark");
  });

  it("without --dark supports light only; with --dark both schemes conform", async () => {
    const light = join(tmp.dir, "light.json");
    const both = join(tmp.dir, "both.json");
    await cli(["init", light]);
    await cli(["init", both, "--dark"]);
    const schemes = (p: string) => (JSON.parse(readFileSync(p, "utf8")) as { colorSchemes: { supported: string[] } }).colorSchemes.supported;
    expect(schemes(light)).toEqual(["light"]);
    expect(schemes(both)).toEqual(["light", "dark"]);
    expect((await cli(["report", both, "--strict"])).status).toBe(0);
  });

  it("a name that would make the theme invalid is refused", async () => {
    const path = join(tmp.dir, "control.json");
    expect((await cli(["init", path, "--name", "bad\u0007name"])).status).toBe(2);
  });
});
