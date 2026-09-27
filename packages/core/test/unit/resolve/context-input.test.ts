/** Context input validation (FR-C050 to FR-C053). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";
import { LIGHT_CONTEXT } from "../../helpers.js";

const core = createCore();
const snapshot = core.registry.snapshot();
const run = (platform: Record<string, unknown>, environment: Record<string, unknown>) =>
  core.resolve(snapshot, {
    policy: { preset: "closed", defaultTheme: "org.opentheme.baseline" },
    selection: { id: "org.opentheme.baseline" },
    previous: null,
    preferences: {},
    platform: platform as never,
    environment: environment as never,
  });
const P = LIGHT_CONTEXT.platform;
const E = LIGHT_CONTEXT.environment;

describe("context input", () => {
  it.each([
    ["colorScheme", ["light", "dark", "no-preference"]],
    ["contrast", ["standard", "high"]],
    ["textScale", [0.5, 1, 3.25]],
    ["forcedColors", [true, false]],
  ])("accepts every platform %s value", (k, values) => {
    for (const v of values) expect(run({ ...P, [k]: v }, E).ok).toBe(true);
  });

  it.each([
    ["sizeClass", ["compact", "medium", "expanded"]],
    ["direction", ["ltr", "rtl"]],
    ["locale", ["en", "fa-IR", "zh-Hant-TW"]],
  ])("accepts every environment %s value", (k, values) => {
    for (const v of values) expect(run(P, { ...E, [k]: v }).ok).toBe(true);
  });

  it.each([
    [{ ...P, colorScheme: "sepia" }, E, "/platform/colorScheme"],
    [{ ...P, contrast: "more" }, E, "/platform/contrast"],
    [{ ...P, textScale: 0 }, E, "/platform/textScale"],
    [{ ...P, textScale: Number.NaN }, E, "/platform/textScale"],
    [{ ...P, density: "compact" }, E, "/platform/density"],
    [P, { ...E, sizeClass: "large" }, "/environment/sizeClass"],
    [P, { ...E, width: 1024 }, "/environment/width"],
    [P, { ...E, density: "compact" }, "/environment/density"],
    [P, { ...E, direction: "ttb" }, "/environment/direction"],
    [P, { ...E, locale: "" }, "/environment/locale"],
    [{ colorScheme: "light" }, E, "/platform/contrast"],
  ])("rejects %j %j at %s", (platform, environment, pointer) => {
    const r = run(platform, environment);
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.error.kind, r.error.pointer]).toEqual(["invalid-context", pointer]);
  });
});
