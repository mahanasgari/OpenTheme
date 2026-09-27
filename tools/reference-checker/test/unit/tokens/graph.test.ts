import { describe, expect, it } from "vitest";
import { DiagnosticCollector } from "../../../src/diagnostics/collector.js";
import { analyzeTokenGraph } from "../../../src/tokens/graph.js";

function run(tokens: Record<string, unknown>) {
  const collector = new DiagnosticCollector();
  const result = analyzeTokenGraph(tokens, collector);
  return { result, diagnostics: collector.finish() };
}

describe("token graph", () => {
  it("resolves aliases in topological order", () => {
    const { result, diagnostics } = run({
      color: {
        $type: "color",
        base: {
          $value: {
            colorSpace: "srgb",
            components: [1, 1, 1],
          },
        },
        text: { $value: "{color.base}" },
      },
    });
    expect(diagnostics.filter((d) => d.code.startsWith("OT-REF"))).toEqual([]);
    expect(result.order.indexOf("color.base")).toBeLessThan(
      result.order.indexOf("color.text"),
    );
  });

  it("missing target → OT-REF-001", () => {
    const { diagnostics } = run({
      color: {
        $type: "color",
        text: { $value: "{color.missing}" },
      },
    });
    expect(diagnostics.some((d) => d.code === "OT-REF-001")).toBe(true);
  });

  it("incompatible type → OT-REF-002", () => {
    const { diagnostics } = run({
      color: {
        accent: {
          $type: "color",
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
      },
      space: {
        sm: { $type: "dimension", $value: "{color.accent}" },
      },
    });
    expect(diagnostics.some((d) => d.code === "OT-REF-002")).toBe(true);
  });

  it("direct cycle → OT-REF-003 with related members", () => {
    const { diagnostics } = run({
      color: {
        $type: "color",
        a: { $value: "{color.b}" },
        b: { $value: "{color.a}" },
      },
    });
    const cycles = diagnostics.filter((d) => d.code === "OT-REF-003");
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(cycles[0]?.related?.length).toBeGreaterThanOrEqual(2);
  });

  it("cycle through derivation → OT-REF-003", () => {
    const { diagnostics } = run({
      color: {
        $type: "color",
        a: {
          $derive: {
            op: "color.alpha",
            args: { color: "{color.b}", alpha: 1 },
          },
        },
        b: { $value: "{color.a}" },
      },
    });
    expect(diagnostics.some((d) => d.code === "OT-REF-003")).toBe(true);
  });

  it("reference depth 17 → OT-REF-004", () => {
    const tokens: Record<string, unknown> = { color: { $type: "color" } };
    const color = tokens.color as Record<string, unknown>;
    color.t0 = {
      $value: { colorSpace: "srgb", components: [0, 0, 0] },
    };
    for (let i = 1; i <= 17; i += 1) {
      color[`t${i}`] = { $value: `{color.t${i - 1}}` };
    }
    const { diagnostics } = run(tokens);
    expect(diagnostics.some((d) => d.code === "OT-REF-004")).toBe(true);
  });

  it("topological ties break by canonical path order", () => {
    const { result } = run({
      color: {
        $type: "color",
        b: {
          $value: { colorSpace: "srgb", components: [0, 0, 1] },
        },
        a: {
          $value: { colorSpace: "srgb", components: [1, 0, 0] },
        },
      },
    });
    expect(result.order.indexOf("color.a")).toBeLessThan(
      result.order.indexOf("color.b"),
    );
  });
});
