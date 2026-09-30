/** `resolve` behavior (US2; T017). */
import { afterAll, describe, expect, it } from "vitest";
import { AURORA, cli, read, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);
const tokens = async (extra: string[]) =>
  ((await cli(["resolve", "--json", "--trusted", AURORA, ...extra])).json().resolved as { tokens: Record<string, unknown>; context: Record<string, unknown> });

describe("resolve", () => {
  it("uses the documented default context", async () => {
    const r = await tokens([]);
    expect(r.context).toMatchObject({ colorScheme: "light", contrast: "standard", sizeClass: "medium", textScale: 1, direction: "ltr", locale: "en" });
  });

  it("applies every context option", async () => {
    const r = await tokens(["--scheme", "dark", "--contrast", "high", "--reduced-motion", "--text-scale", "1.5", "--size", "compact", "--locale", "fa", "--dir", "rtl"]);
    expect(r.context).toMatchObject({ colorScheme: "dark", contrast: "high", sizeClass: "compact", textScale: 1.5, direction: "rtl", locale: "fa" });
    expect((await tokens(["--forced-colors"])).tokens["color.text.primary"]).toEqual({ system: "canvas-text" });
  });

  it.each([["--scheme", "sepia"], ["--text-scale", "-1"], ["--path", "no.such.token"], ["--path", "std/button.nope"]])(
    "%s %s is a usage error",
    async (opt, val) => expect((await cli(["resolve", "--trusted", AURORA, opt, val])).status).toBe(2),
  );

  it("applies preferences from --set and a preferences file with a preset", async () => {
    const set = await cli(["resolve", "--json", "--trusted", AURORA, "--preset", "common-personalization", "--set", 'std.color-scheme="dark"', "--set", "std.text-size=1.5"]);
    expect(set.status).toBe(0);
    expect((set.json().resolved as { context: Record<string, unknown> }).context).toMatchObject({ colorScheme: "dark" });
    const doc = tmp.file("prefs.json", { openthemePreferences: "1.0", selection: null, previous: null, values: { "std.color-scheme": "dark" } });
    const file = await cli(["resolve", "--json", "--trusted", AURORA, "--preset", "common-personalization", "--preferences", doc]);
    expect((file.json().resolved as { context: Record<string, unknown> }).context).toMatchObject({ colorScheme: "dark" });
    expect((await cli(["resolve", "--trusted", AURORA, "--set", "std.text-size=1.5"])).status).toBe(2);
    expect((await cli(["resolve", "--trusted", AURORA, "--preset", "closed", "--set", "std.text-size=oops"])).status).toBe(2);
  });

  it("an invalid theme is reported, not resolved", async () => {
    const bad = tmp.file("bad.json", { ...JSON.parse(read("specification/themes/reference/org.opentheme.aurora.opentheme.json")), version: "x" });
    const r = await cli(["resolve", "--trusted", bad]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("invalid");
    expect(r.stdout).toContain("OT-META-003");
    expect(r.stdout).not.toContain("tokens\n");
  });

  it("prints tokens, components, and a context line", async () => {
    const r = await cli(["resolve", "--trusted", AURORA]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/org\.opentheme\.aurora@1\.0\.0 · light · standard contrast · medium · text ×1/);
    expect(r.stdout).toMatch(/\n {2}color\.text\.primary = \{"srgb8"/);
    expect(r.stdout).toMatch(/\n {2}std\/button\.container\.background\.default = /);
  });
});
