/** quickstart.md scenario 1, verbatim (SC-W008, T012). */
import { createCore } from "@opentheme/core";
import { describe, expect, it } from "vitest";
import { attachTheme, toDeclarations } from "../src/index.js";
import { AURORA, GRAPHITE, NOTES_HOST, read } from "./helpers.js";

describe("quickstart scenario 1", () => {
  it("themes a page and detaches cleanly", () => {
    const core = createCore();
    for (const path of [AURORA, GRAPHITE]) core.registry.admit({ kind: "theme", bytes: read(path), trust: "trusted" });
    core.registry.admit({ kind: "host", bytes: read(NOTES_HOST), trust: "trusted" });

    const scope = attachTheme({
      core,
      target: document,
      scope: "app",
      policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
      sizeClass: "medium",
      store: false,
    });

    // happy-dom's computed style ignores CSS object model writes, so read the scope's rule; the
    // browser page (bench/browser) checks computed style in a real browser.
    const rule = document.querySelector<HTMLStyleElement>('style[data-opentheme-scope="app"]')!.sheet!.cssRules[0] as CSSStyleRule;
    expect(rule.selectorText).toBe(":root");
    const expected = new Map(toDeclarations(scope.controller.current.resolved).declarations.map((d) => [d.name, d.value]));
    for (const name of ["--ot-color_text_primary", "--otc-std__button_container_background_default"]) {
      expect(expected.get(name), name).toBeTruthy();
      expect(rule.style.getPropertyValue(name), name).toBe(expected.get(name));
    }

    scope.detach();
    expect(document.querySelector("[data-opentheme-scope]")).toBeNull();
    expect(document.documentElement.hasAttribute("data-opentheme-scope")).toBe(false);
  });
});
