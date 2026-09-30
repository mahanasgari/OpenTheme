/** Export equals Core's resolved values in every mode (US1; SC-D001; T006). */
import { createCore } from "@opentheme/core";
import { describe, expect, it } from "vitest";
import { exportTheme } from "../src/index.js";
import { admitted, AURORA, dtcgTokens, GRAPHITE, read, resolveMode } from "./helpers.js";

type Rec = Record<string, unknown>;
const MODES = [
  { scheme: "light", contrast: "standard" },
  { scheme: "light", contrast: "high" },
  { scheme: "dark", contrast: "standard" },
  { scheme: "dark", contrast: "high" },
] as const;

/** An independent decoding of a DTCG value back to Core's resolved encoding, for comparison. */
function back(type: string, v: unknown): unknown {
  const r = v as Rec;
  switch (type) {
    case "color": {
      const c = r.components as number[];
      return { srgb8: c.map((x) => Math.round(x * 255)), alpha: r.alpha ?? 1 };
    }
    case "number":
    case "fontWeight":
      return { number: v };
    case "fontFamily":
      return { families: v };
    case "border":
      return { color: back("color", r.color), style: r.style, width: r.width };
    case "shadow":
      return Object.fromEntries(Object.entries(r).map(([k, x]) => [k, k === "color" ? back("color", x) : x]));
    case "typography":
      return Object.fromEntries(Object.entries(r).map(([k, x]) => [k, k === "fontFamily" ? { families: x } : x]));
    default:
      return v;
  }
}
const strip = (v: unknown): unknown => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "physical").map(([k, x]) => [k, strip(x)])) : v);

describe("exportTheme", () => {
  for (const rel of [AURORA, GRAPHITE]) {
    it.each(MODES.map((m) => [`${rel.split("/").pop()} ${m.scheme}/${m.contrast}`, m] as const))("%s", (_n, m) => {
      const { core, entry } = admitted(read(rel));
      const r = exportTheme(core, entry, { modes: [m] });
      if (!r.ok) throw new Error(r.error.message);
      const [doc] = r.documents;
      expect(doc!.mode).toEqual(m);
      const resolved = resolveMode(core, entry, m.scheme, m.contrast).tokens as Rec;
      const exported = dtcgTokens(doc!.document);
      const leftOut = new Set(r.report.filter((e) => e.action === "left-out").map((e) => e.path));
      let n = 0;
      for (const [path, value] of Object.entries(resolved)) {
        if (leftOut.has(path)) {
          expect(exported.has(path)).toBe(false);
          continue;
        }
        const t = exported.get(path);
        expect(t, path).toBeDefined();
        expect(typeof t!.$type, path).toBe("string");
        const want = strip(value) as Rec;
        const got = back(t!.$type as string, t!.$value);
        if (t!.$type === "typography") {
          for (const k of Object.keys(got as Rec)) expect((got as Rec)[k], `${path}.${k}`).toEqual(k === "fontWeight" || k === "lineHeight" ? want[k] : want[k]);
        } else expect(got, path).toEqual(want);
        n += 1;
      }
      expect(n).toBeGreaterThan(80);
    });
  }

  it("keeps each declared derivation under $extensions and marks the document", () => {
    const aurora = admitted(read(AURORA));
    const ar = exportTheme(aurora.core, aurora.entry);
    if (!ar.ok) throw new Error(ar.error.message);
    expect(ar.documents.map((d) => d.mode)).toEqual([
      { scheme: "light", contrast: "standard" },
      { scheme: "dark", contrast: "standard" },
    ]);
    expect(((ar.documents[0]!.document as Rec).$extensions as Rec)["org.opentheme"]).toMatchObject({
      theme: "org.opentheme.aurora",
      version: "1.0.0",
      mode: { scheme: "light", contrast: "standard" },
    });
    const EXAMPLE = "specification/examples/04-derived-accent-family.opentheme.json";
    const { core, entry } = admitted(read(EXAMPLE));
    const r = exportTheme(core, entry);
    if (!r.ok) throw new Error(r.error.message);
    const doc = r.documents[0]!.document as Rec;
    const theme = JSON.parse(read(EXAMPLE)) as { tokens?: Record<string, Record<string, Rec>> };
    const derived = [...dtcgTokens(doc)].filter(([, t]) => (t.$extensions as Rec | undefined)?.["org.opentheme"]);
    expect(derived.length).toBeGreaterThan(0);
    for (const [path, t] of derived) {
      const declared = path.split(".").reduce<unknown>((n, s) => (n as Rec | undefined)?.[s], theme.tokens) as Rec | undefined;
      if (declared?.$derive) expect(((t.$extensions as Rec)["org.opentheme"] as Rec).derive, path).toEqual(declared.$derive);
    }
  });

  it("is deterministic", () => {
    const run = () => {
      const { core, entry } = admitted(read(GRAPHITE));
      return JSON.stringify(exportTheme(core, entry));
    };
    expect(run()).toBe(run());
  });

  it("reports what has no DTCG form", () => {
    const t = JSON.parse(read(AURORA)) as Rec;
    t.tokens = { ...(t.tokens as Rec), text: { body: { $value: { fontFamily: "{font.family.sans}", fontSize: { value: 16, unit: "px" }, lineHeight: { value: 24, unit: "px" }, fontWeight: 400 } } } };
    const { core, entry } = admitted(JSON.stringify({ ...t, id: "org.example.lh" }));
    const r = exportTheme(core, entry);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.report).toContainEqual(expect.objectContaining({ path: "text.body", action: "left-out", reason: expect.stringMatching(/line height/) }));
  });

  it("refuses a scheme the theme does not support", () => {
    const { core, entry } = admitted(read("specification/examples/01-minimal-seed-only.opentheme.json"));
    const r = exportTheme(core, entry, { modes: [{ scheme: "dark", contrast: "standard" }] });
    expect(r).toMatchObject({ ok: false, error: { kind: "invalid-argument" } });
  });

  it("refuses an entry that is not in the snapshot", () => {
    const core = createCore();
    const r = exportTheme(core, { kind: "theme", id: "org.example.none", version: "1.0.0", integrity: "x", trust: "trusted" });
    expect(r.ok).toBe(false);
  });
});
