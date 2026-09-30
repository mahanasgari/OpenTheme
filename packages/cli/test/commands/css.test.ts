/** `css` equals the Web adapter's output for the same resolution (US4, SC-T006; T022). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCore } from "@opentheme/core";
import { toStylesheet } from "@opentheme/web";
import { afterAll, describe, expect, it } from "vitest";
import { AURORA, cli, GRAPHITE, read, tempDir } from "../helpers.js";

const tmp = tempDir();
afterAll(tmp.remove);

function resolved(rel: string, scheme: "light" | "dark") {
  const core = createCore();
  const bytes = read(rel);
  const { id, version } = JSON.parse(bytes) as { id: string; version: string };
  core.registry.admit({ kind: "theme", bytes, trust: "trusted" });
  const r = core.resolve(core.registry.snapshot(), {
    selection: { id, version },
    previous: null,
    preferences: {},
    platform: { colorScheme: scheme, contrast: "standard", forcedColors: false, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    policy: { availableThemes: [id], defaultTheme: id },
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.resolved;
}

describe("css", () => {
  for (const [file, rel] of [
    [AURORA, "specification/themes/reference/org.opentheme.aurora.opentheme.json"],
    [GRAPHITE, "specification/themes/reference/org.opentheme.graphite.opentheme.json"],
  ] as const) {
    it.each(["light", "dark"] as const)(`${rel.split("/").pop()} %s equals toStylesheet`, async (scheme) => {
      const r = await cli(["css", "--trusted", file, "--scheme", scheme]);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`${toStylesheet(resolved(rel, scheme))}\n`);
      const el = await cli(["css", "--trusted", file, "--scheme", scheme, "--scope", "panel", "--element", "--nonce", "abc123"]);
      expect(el.stdout).toBe(`${toStylesheet(resolved(rel, scheme), { scope: "panel", element: true, nonce: "abc123" })}\n`);
    });
  }

  it("a document-scope element gets the default id", async () => {
    const r = await cli(["css", "--trusted", AURORA, "--element"]);
    expect(r.stdout.startsWith('<style data-opentheme-scope="opentheme">:root { ')).toBe(true);
  });

  it("--out writes the file and refuses to overwrite without --force", async () => {
    const out = join(tmp.dir, "theme.css");
    const first = await cli(["css", "--trusted", AURORA, "--out", out]);
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(`${AURORA}: wrote ${out}\n`);
    expect(readFileSync(out, "utf8")).toMatch(/^:root \{ --ot-/);
    expect((await cli(["css", "--trusted", AURORA, "--out", out])).status).toBe(3);
    expect((await cli(["css", "--trusted", AURORA, "--out", out, "--force"])).status).toBe(0);
  });

  it.each([["--scope", "Bad Scope"], ["--nonce", "a b"]])("%s %j is a usage error", async (o, v) => {
    expect((await cli(["css", "--trusted", AURORA, o, v])).status).toBe(2);
  });
});
