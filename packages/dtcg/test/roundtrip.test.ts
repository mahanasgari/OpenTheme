/**
 * Export then import (SC-D002; T011): for each reference theme and scheme, importing the exported
 * document with every exported baseline role and the scheme's seeds mapped gives a valid theme whose
 * mapped roles resolve to the original values.
 */
import { describe, expect, it } from "vitest";
import { BASELINE_TYPES } from "../src/generated/data.js";
import { exportTheme, importTokens } from "../src/index.js";
import { admitted, AURORA, dtcgTokens, GRAPHITE, read, resolveMode } from "./helpers.js";

describe("round trip", () => {
  for (const rel of [AURORA, GRAPHITE]) {
    it.each(["light", "dark"] as const)(`${rel.split("/").pop()} %s`, (scheme) => {
      const original = admitted(read(rel));
      const exported = exportTheme(original.core, original.entry, { modes: [{ scheme, contrast: "standard" }] });
      if (!exported.ok) throw new Error(exported.error.message);
      const doc = exported.documents[0]!.document;
      const paths = [...dtcgTokens(doc).keys()];
      const mapping: Record<string, string> = {
        [`seed.${scheme}.background`]: "seed.background",
        [`seed.${scheme}.foreground`]: "seed.foreground",
        [`seed.${scheme}.accent`]: "seed.accent",
        "seed.font-family": "seed.font-family",
      };
      for (const p of paths) if (!p.startsWith("seed.") && Object.hasOwn(BASELINE_TYPES, p)) mapping[p] = p;
      const imported = importTokens(JSON.stringify(doc), { id: "uid.abcdefghijklmnopqrstuv2345", name: "Round Trip", mapping });
      expect(imported.diagnostics).toEqual([]);
      expect(imported.theme).not.toBeNull();
      expect(imported.report.filter((e) => e.action === "left-out")).toEqual([]);

      const back = admitted(imported.text!, "untrusted");
      const want = resolveMode(original.core, original.entry, scheme, "standard").tokens as Record<string, unknown>;
      const got = resolveMode(back.core, back.entry, scheme, "standard").tokens as Record<string, unknown>;
      const roles = Object.keys(mapping).filter((k) => !k.startsWith("seed."));
      expect(roles.length).toBeGreaterThan(80);
      for (const role of roles) expect(got[role], role).toEqual(want[role]);
    });
  }
});
