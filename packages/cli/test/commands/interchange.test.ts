/** `export` and `import` equal the library (specs/005-design-tokens-interchange T013). */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCore } from "@opentheme/core";
import { exportTheme, importTokens } from "@opentheme/dtcg";
import { afterAll, describe, expect, it } from "vitest";
import { AURORA, cli, read, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);

describe("export", () => {
  it("writes one file per mode, equal to the library", async () => {
    const r = await cli(["export", "--trusted", AURORA, "--out-dir", tmp.dir, "--mode", "light", "--mode", "dark:high"]);
    expect(r.status).toBe(0);
    const core = createCore();
    const entry = core.registry.admit({ kind: "theme", bytes: read("specification/themes/reference/org.opentheme.aurora.opentheme.json"), trust: "trusted" }).entry!;
    const lib = exportTheme(core, entry, { modes: [{ scheme: "light", contrast: "standard" }, { scheme: "dark", contrast: "high" }] });
    if (!lib.ok) throw new Error(lib.error.message);
    const names = ["org.opentheme.aurora.light.tokens.json", "org.opentheme.aurora.dark-high.tokens.json"];
    names.forEach((n, i) => expect(readFileSync(join(tmp.dir, n), "utf8")).toBe(`${JSON.stringify(lib.documents[i]!.document, null, 2)}\n`));
    expect(r.stdout).toContain(`wrote ${join(tmp.dir, names[0]!)}`);
    expect((await cli(["export", "--trusted", AURORA, "--out-dir", tmp.dir, "--mode", "light"])).status).toBe(3);
    expect((await cli(["export", "--trusted", AURORA, "--out-dir", tmp.dir, "--mode", "light", "--force"])).status).toBe(0);
  });

  it("rejects a bad --mode", async () => expect((await cli(["export", "--trusted", AURORA, "--mode", "sepia"])).status).toBe(2));
});

describe("import", () => {
  const tokens = () =>
    tmp.file("brand.tokens.json", {
      brand: { $type: "color", ink: { $value: { colorSpace: "srgb", components: [0.1, 0.1, 0.12] } }, fancy: { $value: { colorSpace: "display-p3", components: [1, 0, 0] } } },
    });

  it("writes the library's theme and reports losses", async () => {
    const src = tokens();
    const out = join(tmp.dir, "imported.opentheme.json");
    const mapping = tmp.file("map.json", { "color.text.primary": "brand.ink" });
    const r = await cli(["import", src, "--out", out, "--mapping", mapping, "--id", "uid.abcdefghijklmnopqrstuv2345", "--name", "Brand"]);
    expect(r.status).toBe(0);
    const lib = importTokens(readFileSync(src), { mapping: { "color.text.primary": "brand.ink" }, id: "uid.abcdefghijklmnopqrstuv2345", name: "Brand" });
    expect(readFileSync(out, "utf8")).toBe(lib.text);
    expect(r.stdout).toContain("left-out brand.fancy: color space display-p3");
    expect((await cli(["validate", out])).status).toBe(0);
  });

  it("--json, a rejected theme, and usage errors", async () => {
    const src = tokens();
    const json = await cli(["import", src, "--out", join(tmp.dir, "j.json"), "--json", "--id", "uid.abcdefghijklmnopqrstuv2345"]);
    expect(json.json()).toMatchObject({ command: "import", id: "uid.abcdefghijklmnopqrstuv2345", status: 0 });
    const bad = await cli(["import", src, "--out", join(tmp.dir, "bad.json"), "--id", "Not An Id"]);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("OT-META-001");
    expect((await cli(["import", src])).status).toBe(2);
    const notJson = join(tmp.dir, "m.txt");
    writeFileSync(notJson, "nope");
    expect((await cli(["import", src, "--out", join(tmp.dir, "x.json"), "--mapping", notJson])).status).toBe(2);
  });
});
