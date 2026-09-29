/**
 * Output-target conformance (FR-W050, research WR7, T011): for every resolution fixture, Core's
 * resolved tokens and components survive serialization and decoding unchanged.
 */
import { createCore, type ResolvedTheme } from "@opentheme/core";
import { describe, expect, it } from "vitest";
import { bytesOf, fixtures } from "../../../core/test/fixtures.js";
import { toDeclarations } from "../../src/index.js";
import { jcs, without } from "../canonical.js";
import { AURORA, LIGHT_CONTEXT, read } from "../helpers.js";
import { decodeDeclarations } from "../decode.js";
import { matchesGrammar } from "../grammar.js";

const ALL = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;

function resolveFixture(input: Record<string, unknown>): ResolvedTheme {
  const core = createCore({ untrustedSources: ALL, accessibilityGate: "relaxed" });
  const i = input as Record<string, unknown> & { themes?: { trust?: string; document: unknown }[] };
  if (i.host) core.registry.admit({ kind: "host", bytes: bytesOf(i.host), trust: "trusted" });
  for (const t of i.themes ?? []) {
    const trusted = t.trust === "trusted";
    core.registry.admit({ kind: "theme", bytes: bytesOf(t.document), trust: trusted ? "trusted" : "untrusted", ...(trusted ? {} : { source: "shared" }) });
  }
  if (i.theme) core.registry.admit({ kind: "theme", bytes: bytesOf(i.theme), trust: "trusted" });
  const r = core.resolve(core.registry.snapshot(), {
    policy: (i.policy ?? {}) as never,
    selection: i.selection as never,
    previous: (i.previous ?? null) as never,
    preferences: (i.preferences ?? {}) as never,
    platform: i.platform as never,
    environment: i.environment as never,
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.resolved;
}

const cases = fixtures("resolution").filter((f) => f.kind === "resolve");

const seen = { host: false, variant: false, member: false, system: false };

describe("output-target conformance", () => {
  it("covers every resolution fixture", () => expect(cases.length).toBeGreaterThanOrEqual(100));

  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const resolved = resolveFixture(f.input);
    const { declarations, omissions } = toDeclarations(resolved);
    expect(omissions, JSON.stringify(omissions.slice(0, 5))).toEqual([]);
    expect(declarations.length).toBeGreaterThan(Object.keys(resolved.tokens as object).length);
    for (const d of declarations) {
      if (/^--ot-[a-z0-9_-]*[a-z0-9]__/.test(d.name)) seen.host = true;
      if (d.name.includes("_v_")) seen.variant = true;
      if (d.name.includes("___")) seen.member = true;
      if (/^[A-Z]/.test(d.value)) seen.system = true;
      expect(matchesGrammar(d.value), `${d.name}: ${d.value}`).toBe(true);
    }
    const decoded = decodeDeclarations(declarations);
    const paths = omissions.map((o) => o.path);
    expect(jcs(decoded.tokens)).toBe(jcs(without(resolved.tokens, paths, "/tokens")));
    expect(jcs(decoded.components)).toBe(jcs(without(resolved.components, paths, "/components")));
  });
});

it("round-trips component variants and their composite members", () => {
  const doc = JSON.parse(read(AURORA)) as Record<string, unknown> & { components?: Record<string, Record<string, unknown>> };
  doc.components = { ...(doc.components ?? {}) };
  doc.components["std/button"] = {
    ...(doc.components["std/button"] ?? {}),
    variants: {
      emphasis: {
        danger: {
          parts: {
            container: { background: { $states: { default: "{color.status.danger.background}", hover: "{color.action.primary.background}" } } },
            label: { typography: "{text.body}" },
          },
        },
      },
    },
  };
  const resolved = resolveFixture({
    themes: [{ trust: "trusted", document: doc }],
    policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
    selection: { id: "org.opentheme.aurora" },
    ...LIGHT_CONTEXT,
  });
  const { declarations, omissions } = toDeclarations(resolved);
  expect(omissions).toEqual([]);
  expect(declarations.some((d) => d.name === "--otc-std__button_v_emphasis_danger_label_typography_default___font-size")).toBe(true);
  expect(declarations.some((d) => d.name === "--otc-std__button_v_emphasis_danger_container_background_hover")).toBe(true);
  seen.variant = true;
  const decoded = decodeDeclarations(declarations);
  expect(jcs(decoded.components)).toBe(jcs(without(resolved.components, [], "/components")));
});

it("exercises host tokens, variants, composite members, and system colors", () => {
  expect(seen).toEqual({ host: true, variant: true, member: true, system: true });
});
