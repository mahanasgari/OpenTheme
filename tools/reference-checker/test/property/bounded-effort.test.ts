import { describe, expect, it } from "vitest";
import { validateTheme } from "../../src/validate/document.js";

/**
 * Bounded effort: pathological inputs must not throw and must return diagnostics
 * within a linear bound on document size (FR-063, NFR-002).
 */
describe("bounded effort", () => {
  it("rejects documents larger than 1 MiB without throwing", () => {
    const pad = "x".repeat(1_100_000);
    const doc = `{"opentheme":"1.0","pad":"${pad}"}`;
    const started = Date.now();
    const result = validateTheme(doc);
    const elapsed = Date.now() - started;
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "OT-LIM-001")).toBe(true);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("rejects nesting deeper than 16 without throwing", () => {
    let nested = "true";
    for (let i = 0; i < 100; i += 1) nested = `{"n":${nested}}`;
    const doc = `{"opentheme":"1.0","id":"uid.abcdefghijklmnopqrstuv2345","version":"1.0.0","name":"N","provenance":{"origin":"user-created"},"compatibility":{"catalog":"1.0"},"colorSchemes":{"supported":["light"],"default":"light"},"seeds":{"light":{"background":{"colorSpace":"srgb","components":[1,1,1]},"foreground":{"colorSpace":"srgb","components":[0,0,0]},"accent":{"colorSpace":"srgb","components":[0.2,0.4,0.8]}},"fontFamily":["sans-serif"]},"$extensions":{"nest":${nested}}}`;
    const result = validateTheme(doc);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "OT-LIM-002")).toBe(true);
  });

  it("rejects duplicate keys without throwing", () => {
    const doc =
      '{"opentheme":"1.0","opentheme":"1.0","id":"uid.abcdefghijklmnopqrstuv2345","version":"1.0.0","name":"X","provenance":{"origin":"user-created"},"compatibility":{"catalog":"1.0"},"colorSchemes":{"supported":["light"],"default":"light"},"seeds":{"light":{"background":{"colorSpace":"srgb","components":[1,1,1]},"foreground":{"colorSpace":"srgb","components":[0,0,0]},"accent":{"colorSpace":"srgb","components":[0.2,0.4,0.8]}},"fontFamily":["sans-serif"]}}';
    const result = validateTheme(doc);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "OT-DOC-002")).toBe(true);
  });
});
