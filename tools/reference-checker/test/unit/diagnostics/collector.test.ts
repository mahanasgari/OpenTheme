import { describe, expect, it } from "vitest";
import {
  DiagnosticCollector,
  ParamError,
} from "../../../src/diagnostics/collector.js";

describe("DiagnosticCollector", () => {
  it("orders by document, then pointer, then code", () => {
    const collector = new DiagnosticCollector();
    collector.add({
      code: "OT-TOK-004",
      location: { document: "theme", pointer: "/tokens/b" },
      rule: "R-TOK-004",
    });
    collector.add({
      code: "OT-TOK-001",
      location: { document: "theme", pointer: "/tokens/a" },
      rule: "R-TOK-001",
    });
    collector.add({
      code: "OT-HOST-001",
      location: { document: "host", pointer: "/contracts/0" },
      rule: "R-HOST-001",
    });
    collector.add({
      code: "OT-RES-001",
      location: { document: "input", pointer: "/selection" },
      rule: "R-RES-001",
    });
    collector.add({
      code: "OT-INH-001",
      location: {
        document: "base:org.example.a@1.0.0",
        pointer: "/seeds",
      },
      rule: "R-INH-001",
    });

    const codes = collector.finish().map((d) => `${d.location.document}:${d.code}`);
    expect(codes).toEqual([
      "theme:OT-TOK-001",
      "theme:OT-TOK-004",
      "base:org.example.a@1.0.0:OT-INH-001",
      "host:OT-HOST-001",
      "input:OT-RES-001",
    ]);
  });

  it("caps at 200 and appends OT-LIM-099 with omitted count", () => {
    const collector = new DiagnosticCollector({ cap: 200 });
    for (let i = 0; i < 205; i += 1) {
      collector.add({
        code: "OT-TOK-004",
        location: { document: "theme", pointer: `/tokens/t${i}` },
        rule: "R-TOK-004",
        params: { detail: String(i) },
      });
    }
    const result = collector.finish();
    expect(result).toHaveLength(201);
    expect(result[200]?.code).toBe("OT-LIM-099");
    expect(result[200]?.params).toEqual({ omitted: 5 });
  });

  it("rejects disallowed param kinds", () => {
    const collector = new DiagnosticCollector();
    expect(() =>
      collector.add({
        code: "OT-TOK-004",
        location: { document: "theme", pointer: "/tokens/a" },
        rule: "R-TOK-004",
        params: { bad: { nested: true } },
      }),
    ).toThrow(ParamError);
  });
});
