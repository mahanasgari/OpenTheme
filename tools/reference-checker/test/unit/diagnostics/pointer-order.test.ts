import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../../src/diagnostics/collector.js";

describe("pointer canonical order (chapter 13, F13)", () => {
  it("orders pointers by UTF-16 code units, not locale collation", () => {
    const c = new DiagnosticCollector();
    for (const pointer of ["/a", "/_x", "/B", "/Z", "/b", "/é"]) {
      c.add({ code: "OT-DOC-003", rule: "R-DOC-003", location: { document: "theme", pointer } });
    }
    expect(c.finish().map((d) => d.location.pointer)).toEqual(["/B", "/Z", "/_x", "/a", "/b", "/é"]);
  });
});
