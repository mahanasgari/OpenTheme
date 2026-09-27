/** User Preferences documents (chapter 18; FR-C067 to FR-C069). */
import { describe, expect, it } from "vitest";
import { createCore } from "../../../src/index.js";

const { preferences } = createCore();

describe("preferences documents", () => {
  it("uses a document whose only findings are value-level (OT-PREF-008), keeping those entries", () => {
    const bytes = '{"openthemePreferences":"1.0","selection":null,"previous":null,"values":{"std.accent":[1,2],"std.text-size":1.5}}';
    const r = preferences.parse(bytes);
    expect(r.document).not.toBeNull();
    expect(r.diagnostics.map((d) => [d.code, d.location.pointer])).toEqual([["OT-PREF-008", "/values/std.accent"]]);
    expect(r.document!.values).toEqual({ "std.accent": [1, 2], "std.text-size": 1.5 });
  });

  it("never partially uses a document with a document-level error", () => {
    for (const bytes of [
      '{"openthemePreferences":"2.0","selection":null,"previous":null,"values":{}}',
      '{"openthemePreferences":"1.0","selection":null,"previous":null,"values":{},"theme":{}}',
      '{"openthemePreferences":"1.0","selection":null,"previous":null}',
      "[]",
      "x".repeat(70_000),
    ]) {
      expect(preferences.parse(bytes).document, bytes.slice(0, 40)).toBeNull();
    }
  });

  it("round-trips to byte-identical canonical form", () => {
    const doc = {
      openthemePreferences: "1.0",
      values: { "std.density": "compact", "std.accent": { colorSpace: "oklch", components: [0.6, 0.1, 250] } },
      previous: { version: "1.0.0", id: "org.opentheme.aurora" },
      selection: { id: "org.opentheme.graphite" },
    };
    const once = preferences.serialize(preferences.parse(JSON.stringify(doc)).document!);
    const twice = preferences.serialize(preferences.parse(once).document!);
    expect(twice).toBe(once);
    expect(once.startsWith('{"openthemePreferences":"1.0","previous":')).toBe(true);
    expect(preferences.serialize(preferences.empty())).toBe('{"openthemePreferences":"1.0","previous":null,"selection":null,"values":{}}');
  });
});
