import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { canonicalize, type Json } from "../../../src/canonical/jcs.js";
import { type ResolveInput, resolveTheme } from "../../../src/resolve/index.js";
import type { ThemeEntry } from "../../../src/resolve/select.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown };
const Ajv2020 = ((AjvModule as unknown as { default?: unknown }).default ?? AjvModule) as new (
  options?: object,
) => { compile: (schema: unknown) => ValidateFn };
const validateInput = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(
    readFileSync(
      join(repoRoot, "specification/schemas/1.0/resolution-input.schema.json"),
      "utf8",
    ),
  ),
);

const seeds = {
  light: {
    background: { colorSpace: "srgb", components: [0.98, 0.97, 0.95] },
    foreground: { colorSpace: "srgb", components: [0.12, 0.12, 0.14] },
    accent: { colorSpace: "oklch", components: [0.55, 0.15, 250] },
  },
  fontFamily: ["Inter", "system-ui", "sans-serif"],
};

function theme(name: string, accent?: number[]): Record<string, unknown> {
  return {
    opentheme: "1.0",
    id: "org.example.brand",
    version: "1.0.0",
    name,
    provenance: { origin: "prebuilt" },
    compatibility: { catalog: "1.0" },
    colorSchemes: { supported: ["light"], default: "light" },
    seeds: accent
      ? { ...seeds, light: { ...seeds.light, accent: { colorSpace: "srgb", components: accent } } }
      : seeds,
  };
}

const trusted = theme("Trusted Brand");
const impostor = theme("Impostor Brand", [1, 0, 0]);

function input(themes: unknown[]): ResolveInput {
  return {
    themes: themes as ThemeEntry[],
    selection: { id: "org.example.brand" },
    previous: null,
    platform: {
      colorScheme: "light",
      contrast: "standard",
      forcedColors: false,
      reducedMotion: false,
      textScale: 1,
    },
    environment: { sizeClass: "medium", locale: "en", direction: "ltr" },
    preferences: {},
    policy: { availableThemes: ["org.example.brand", "org.opentheme.baseline"] },
  } as ResolveInput;
}

describe("per-document trust (FR-010, FR-068)", () => {
  it("an entry without an explicit trust level is untrusted, even if it claims a trusted id", () => {
    const r = resolveTheme(input([{ document: impostor }]));
    expect(r.resolved.applied.trust).toBe("untrusted");
  });

  it("only the exact value `trusted` grants trust", () => {
    for (const trust of ["TRUSTED", "yes", true, 1, null]) {
      const r = resolveTheme(input([{ trust, document: impostor }]));
      expect(r.resolved.applied.trust).toBe("untrusted");
    }
  });

  it("an untrusted document never takes over a trusted id, whatever the entry order", () => {
    const trustedFirst = resolveTheme(
      input([
        { trust: "trusted", document: trusted },
        { trust: "untrusted", document: impostor },
      ]),
    );
    const untrustedFirst = resolveTheme(
      input([
        { trust: "untrusted", document: impostor },
        { trust: "trusted", document: trusted },
      ]),
    );
    for (const r of [trustedFirst, untrustedFirst]) {
      expect(r.resolved.applied).toMatchObject({ fallback: "none", trust: "trusted" });
      expect(r.resolved.displayText.name).toBe("Trusted Brand");
      expect(r.diagnostics.map((d) => d.code)).toEqual(["OT-SEC-001"]);
    }
    expect(canonicalize(untrustedFirst as unknown as Json)).toBe(
      canonicalize(trustedFirst as unknown as Json),
    );
  });
});

describe("resolution-input.schema.json trust shape", () => {
  const base = input([{ trust: "trusted", document: trusted }]);

  it("accepts per-document trust entries", () => {
    expect(validateInput(base)).toBe(true);
  });

  it("rejects identifier-keyed trust (`trustedIds`)", () => {
    expect(validateInput({ ...base, trustedIds: ["org.example.brand"] })).toBe(false);
  });

  it("rejects a theme entry without trust or with an unknown trust value", () => {
    expect(validateInput({ ...base, themes: [{ document: trusted }] })).toBe(false);
    expect(validateInput({ ...base, themes: [{ trust: "admin", document: trusted }] })).toBe(false);
  });

  it("rejects trust-less `bases`: bases come from `themes`", () => {
    expect(validateInput({ ...base, bases: [trusted] })).toBe(false);
  });
});
