/**
 * Documentation examples stay true (constitution XI, FR-R010, SC-R006, T014): every fenced `tsx`
 * block in README.md is type-checked against the built `@opentheme/react` and `@opentheme/core`
 * declarations and then run: a block that exports `App` is rendered with `createRoot` inside `act`.
 * `auroraBytes` and `graphiteBytes` are the documented placeholders.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentType } from "react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { cleanup, mount } from "../helpers.js";
import { PLACEHOLDERS, importBlock, pkg, resetExamples, tmp, tsxBlocks } from "./harness.js";

const blocks = tsxBlocks(readFileSync(join(pkg, "README.md"), "utf8")).map((code, i) => ({ name: `README-${i + 1}`, code }));

resetExamples();
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("documentation examples", () => {
  it("has examples", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(6);
  });

  it("type-check against the built declarations", () => {
    for (const b of blocks) writeFileSync(join(tmp, `${b.name}.tsx`), `${PLACEHOLDERS}${b.code}\nexport {};\n`);
    writeFileSync(
      join(tmp, "tsconfig.json"),
      JSON.stringify({
        extends: "../../../../../tsconfig.base.json",
        compilerOptions: { target: "ES2022", lib: ["ES2022", "DOM"], jsx: "react-jsx", types: [], noEmit: true, module: "NodeNext", moduleResolution: "NodeNext" },
        include: ["*.tsx"],
      }),
    );
    const tsc = join(pkg, "node_modules/typescript/bin/tsc");
    let output = "";
    try {
      execFileSync(process.execPath, [tsc, "-p", join(tmp, "tsconfig.json")], { stdio: "pipe" });
    } catch (e) {
      output = String((e as { stdout?: Buffer }).stdout ?? e);
    }
    expect(output).toBe("");
  });

  it.each(blocks.map((b) => [b.name, b] as const))("%s runs", async (_name, b) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const mod = await importBlock(b.name, b.code);
      if (typeof mod.App === "function") {
        const m = mount(createElement(mod.App as ComponentType));
        expect(document.querySelectorAll("style[data-opentheme-scope]").length).toBeGreaterThan(0);
        m.unmount();
        expect(document.querySelectorAll("style[data-opentheme-scope]")).toHaveLength(0);
      }
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
      cleanup();
    }
  });
});
