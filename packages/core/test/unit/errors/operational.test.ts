/** Operational errors (FR-C083; contracts/operational-errors.md). */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCore, OPERATIONAL_ERROR_KINDS, OpenThemeCoreError } from "../../../src/index.js";
import { operationalError } from "../../../src/errors/operational.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/errors");

describe("operational errors", () => {
  it.each(OPERATIONAL_ERROR_KINDS.map((k) => [k]))("%s has a page, a hint, and a docs URL", (kind) => {
    expect(kind.startsWith("OT-")).toBe(false);
    expect(kind).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    const e = operationalError(kind, "test.op", "message");
    expect(e.hint.length).toBeGreaterThan(10);
    expect(e.docs).toBe(`https://opentheme.org/core/errors/${kind}`);
    const page = join(docs, `${kind}.md`);
    expect(existsSync(page)).toBe(true);
    const text = readFileSync(page, "utf8");
    for (const h of ["## What failed", "## Why", "## How to fix it"]) expect(text).toContain(h);
  });

  it("returns data-dependent refusals and throws programming errors", () => {
    const core = createCore();
    const refused = core.registry.admit({ kind: "theme", bytes: "{}", trust: "untrusted", source: "imported" });
    expect(refused.error?.kind).toBe("source-not-allowed");
    const thrown = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e instanceof OpenThemeCoreError ? e.error.kind : "other";
      }
      return null;
    };
    expect(thrown(() => core.registry.admit({ kind: "font" as never, bytes: "{}", trust: "trusted" }))).toBe("invalid-argument");
    expect(thrown(() => core.listSelectable({} as never, { availableThemes: [] }, "en"))).toBe("invalid-argument");
    expect(thrown(() => core.listSelectable(core.registry.snapshot(), { preset: "x" as never, defaultTheme: "a" }, "en"))).toBe(
      "unknown-preset",
    );
  });
});
