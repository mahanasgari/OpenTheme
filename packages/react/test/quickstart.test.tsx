/** Runs specs/006-react-bindings/quickstart.md (T014; FR-R010). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ROOT, cleanup, declarationsOf } from "./helpers.js";
import { importBlock, tsxBlocks } from "./docs/harness.js";

afterEach(cleanup);

describe("quickstart", () => {
  it("themes the document, shows the theme name, and unmounts cleanly", async () => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const [block] = tsxBlocks(readFileSync(join(ROOT, "specs/006-react-bindings/quickstart.md"), "utf8"));
    expect(block).toBeDefined();
    const mod = await importBlock("quickstart", block!);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(mod.App as ComponentType)));

    const names = Object.keys(declarationsOf("app"));
    expect(names.some((n) => n.startsWith("--ot-"))).toBe(true);
    expect(names.some((n) => n.startsWith("--otc-"))).toBe(true);
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Aurora");

    await act(async () => {
      button.click();
    });
    expect(host.querySelector("button")!.textContent).toBe("Aurora");

    act(() => root.unmount());
    expect(document.querySelectorAll("style[data-opentheme-scope]")).toHaveLength(0);
  });
});
