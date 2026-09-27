/** Resolution is synchronous and schedules nothing (FR-C070, FR-C092; US1 scenario 5). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCore } from "../../../src/index.js";
import { AURORA, LIGHT_CONTEXT, read } from "../../helpers.js";

afterEach(() => vi.restoreAllMocks());

describe("synchronous first paint", () => {
  it("resolves and builds a controller from initial state without timers or microtasks", () => {
    const core = createCore();
    core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
    const spies = [
      vi.spyOn(globalThis, "setTimeout"),
      vi.spyOn(globalThis, "setInterval"),
      vi.spyOn(globalThis, "queueMicrotask"),
    ];
    const result = core.resolve(core.registry.snapshot(), {
      policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
      selection: { id: "org.opentheme.aurora" },
      previous: null,
      preferences: {},
      ...LIGHT_CONTEXT,
    });
    const controller = core.createController({
      policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
      context: LIGHT_CONTEXT,
      initial: '{"openthemePreferences":"1.0","selection":{"id":"org.opentheme.aurora"},"previous":null,"values":{}}',
    });
    expect(typeof (result as { then?: unknown }).then).toBe("undefined");
    expect(result.ok).toBe(true);
    expect((controller.current.resolved.applied as { id: string }).id).toBe("org.opentheme.aurora");
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
