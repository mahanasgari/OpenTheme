import { describe, expect, it } from "vitest";
import { englishTemplates, formatDiagnostic } from "../../../src/diagnostics/templates.js";
import { diagnosticCodes } from "../../../src/generated/registries.js";

describe("English templates", () => {
  it("cover every registry code", () => {
    expect(Object.keys(englishTemplates).sort()).toEqual(Object.keys(diagnosticCodes).sort());
  });
  it("fill present parameters and drop absent ones", () => {
    expect(formatDiagnostic({ code: "OT-DOC-002", params: { detail: "/a/b" } })?.message).toBe("duplicate member: /a/b");
    expect(formatDiagnostic({ code: "OT-DOC-002", params: {} })?.message).toBe("duplicate member");
    expect(formatDiagnostic({ code: "OT-NOPE-001", params: {} })).toBeUndefined();
  });
});
