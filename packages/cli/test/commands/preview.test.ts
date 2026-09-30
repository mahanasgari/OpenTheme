/** `preview` (US5; FR-T060; T024). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCore } from "@opentheme/core";
import { toStylesheet } from "@opentheme/web";
import { afterAll, describe, expect, it } from "vitest";
import { AURORA, cli, read, ROOT, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);

function rule(scheme: "light" | "dark", contrast: "standard" | "high") {
  const core = createCore();
  core.registry.admit({ kind: "theme", bytes: read("specification/themes/reference/org.opentheme.aurora.opentheme.json"), trust: "trusted" });
  const r = core.resolve(core.registry.snapshot(), {
    selection: { id: "org.opentheme.aurora", version: "1.0.0" },
    previous: null,
    preferences: {},
    platform: { colorScheme: scheme, contrast, forcedColors: false, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    policy: { availableThemes: ["org.opentheme.aurora"], defaultTheme: "org.opentheme.aurora" },
  });
  if (!r.ok) throw new Error(r.error.message);
  return toStylesheet(r.resolved, { scope: `${scheme}-${contrast}` });
}

describe("preview", () => {
  it("writes one self-contained page with a section per mode", async () => {
    const out = join(tmp.dir, "aurora.html");
    const r = await cli(["preview", "--trusted", AURORA, "--out", out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("(4 modes)");
    const html = readFileSync(out, "utf8");
    for (const s of ["light", "dark"] as const) {
      for (const c of ["standard", "high"] as const) {
        expect(html).toContain(`data-opentheme-scope="${s}-${c}"`);
        expect(html).toContain(rule(s, c));
      }
    }
    expect(html).toContain("<title>Aurora · OpenTheme preview</title>");
    expect(html).not.toMatch(/<script|https?:|src=|url\(|@import/i);
  });

  it("is byte-identical across runs", async () => {
    const a = join(tmp.dir, "a.html");
    const b = join(tmp.dir, "b.html");
    await cli(["preview", "--trusted", AURORA, "--out", a]);
    await cli(["preview", "--trusted", AURORA, "--out", b]);
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
  });

  it("shows only the schemes a theme supports", async () => {
    const out = join(tmp.dir, "minimal.html");
    const r = await cli(["preview", "--trusted", join(ROOT, "specification/examples/01-minimal-seed-only.opentheme.json"), "--out", out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("(2 modes)");
    expect(readFileSync(out, "utf8")).not.toContain('data-opentheme-scope="dark-');
  });

  it("an invalid theme writes nothing", async () => {
    const bad = tmp.file("bad.json", { opentheme: "1.0" });
    const out = join(tmp.dir, "bad.html");
    const r = await cli(["preview", "--trusted", bad, "--out", out]);
    expect(r.status).toBe(1);
    expect(() => readFileSync(out)).toThrow();
  });

  it("escapes the theme name", async () => {
    const t = JSON.parse(read("specification/themes/reference/org.opentheme.aurora.opentheme.json")) as Record<string, unknown>;
    const file = tmp.file("named.json", { ...t, id: "org.example.named", name: "A <b>&</b> theme" });
    const out = join(tmp.dir, "named.html");
    await cli(["preview", "--trusted", file, "--out", out]);
    expect(readFileSync(out, "utf8")).toContain("<h1>A &#60;b&#62;&#38;&#60;/b&#62; theme</h1>");
  });
});
