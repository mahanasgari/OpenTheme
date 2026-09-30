/** `resolve` equals Core's resolution of the same inputs (FR-T081; T016). */
import { createCore } from "@opentheme/core";
import { describe, expect, it } from "vitest";
import { AURORA, cli, GRAPHITE, read } from "../helpers.js";

const THEMES = [
  [AURORA, "specification/themes/reference/org.opentheme.aurora.opentheme.json"],
  [GRAPHITE, "specification/themes/reference/org.opentheme.graphite.opentheme.json"],
] as const;
const modes = ["light", "dark"].flatMap((scheme) =>
  ["standard", "high"].flatMap((contrast) => [false, true].map((forced) => ({ scheme, contrast, forced }))),
);

function direct(rel: string, m: (typeof modes)[number]) {
  const core = createCore();
  const bytes = read(rel);
  const id = (JSON.parse(bytes) as { id: string; version: string });
  core.registry.admit({ kind: "theme", bytes, trust: "trusted" });
  const r = core.resolve(core.registry.snapshot(), {
    selection: { id: id.id, version: id.version },
    previous: null,
    preferences: {},
    platform: { colorScheme: m.scheme as "light", contrast: m.contrast as "standard", forcedColors: m.forced, reducedMotion: false, textScale: 1 },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    policy: { availableThemes: [id.id], defaultTheme: id.id },
  });
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe("resolve equivalence", () => {
  for (const [file, rel] of THEMES) {
    it.each(modes.map((m) => [`${rel.split("/").pop()} ${m.scheme} ${m.contrast}${m.forced ? " forced" : ""}`, m] as const))(
      "%s",
      async (_n, m) => {
        const args = ["resolve", "--json", "--trusted", file, "--scheme", m.scheme, "--contrast", m.contrast];
        if (m.forced) args.push("--forced-colors");
        const got = (await cli(args)).json();
        const want = direct(rel, m);
        expect(got.resolved).toEqual(JSON.parse(JSON.stringify(want.resolved)));
        expect(got.outcome).toBe(want.outcome);
        const paths = (await cli([...args, "--path", "color.text.primary", "--path", "std/card.container.padding.default"])).json();
        expect(paths.values).toEqual({
          "color.text.primary": (want.resolved.tokens as Record<string, unknown>)["color.text.primary"],
          "std/card.container.padding.default": JSON.parse(
            JSON.stringify((want.resolved.components as Record<string, Record<string, Record<string, Record<string, unknown>>>>)["std/card"]!.container!.padding!.default),
          ),
        });
      },
    );
  }
});
