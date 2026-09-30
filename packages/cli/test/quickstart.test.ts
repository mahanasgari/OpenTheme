/** quickstart.md scenario 1, verbatim (SC-T002; T028). */
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cli, tempDir } from "./helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);

describe("quickstart scenario 1", () => {
  it("creates, validates, and resolves a theme", async () => {
    const file = join(tmp.dir, "my-theme.opentheme.json");
    expect((await cli(["init", file, "--name", "Quiet Paper"])).status).toBe(0);
    const v = await cli(["validate", file]);
    expect(v.status).toBe(0);
    expect(v.stdout).toContain(": valid");
    const r = await cli(["resolve", file, "--scheme", "light", "--path", "color.text.primary"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^color\.text\.primary = \{"srgb8":\[\d+,\d+,\d+\],"alpha":1\}$/m);
  });
});
