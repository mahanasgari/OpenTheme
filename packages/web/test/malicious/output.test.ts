/**
 * Unsafe values never reach the page (US5, SC-W002, T018): every malicious and invalid theme and
 * host is admitted as untrusted with every source enabled; whatever Core accepts is applied.
 */
import { createCore } from "@opentheme/core";
import { afterEach, describe, expect, it } from "vitest";
import { bytesOf, fixtures } from "../../../core/test/fixtures.js";
import { attachTheme, toDeclarations } from "../../src/index.js";
import { matchesGrammar } from "../grammar.js";
import { AURORA, LIGHT_CONTEXT, read } from "../helpers.js";

const ALL = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;
const cases = fixtures("malicious", "invalid");
let applied = 0;

afterEach(() => {
  document.head.innerHTML = "";
});

describe("malicious and invalid inputs", () => {
  it("covers the suites", () => expect(cases.length).toBeGreaterThanOrEqual(70));

  it.each(cases.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const core = createCore({ untrustedSources: ALL, accessibilityGate: "relaxed" });
    const input = f.input as { theme?: unknown; host?: unknown };
    if (input.host !== undefined) core.registry.admit({ kind: "host", bytes: bytesOf(input.host), trust: "trusted" });
    let id = "org.opentheme.aurora";
    core.registry.admit({ kind: "theme", bytes: read(AURORA), trust: "trusted" });
    if (input.theme !== undefined) {
      const r = core.registry.admit({ kind: "theme", bytes: bytesOf(input.theme), trust: "untrusted", source: "shared" });
      if (r.status === "registered") id = (input.theme as { id: string }).id;
    }
    for (const forcedColors of [false, true]) {
      const scope = attachTheme({
        core,
        target: document,
        scope: "app",
        policy: { availableThemes: [id], defaultTheme: id },
        sizeClass: "medium",
        store: false,
        initial: JSON.stringify({ openthemePreferences: "1.0", selection: { id } }),
      });
      try {
        if (forcedColors) scope.controller.setContext({ platform: { ...LIGHT_CONTEXT.platform, forcedColors: true } });
        const sheet = document.querySelector<HTMLStyleElement>("style[data-opentheme-scope]")!.sheet!;
        expect(sheet.cssRules).toHaveLength(1);
        const style = (sheet.cssRules[0] as CSSStyleRule).style;
        const { declarations } = toDeclarations(scope.controller.current.resolved);
        expect(style.length).toBe(declarations.length);
        for (let i = 0; i < style.length; i += 1) {
          const name = style.item(i);
          const value = style.getPropertyValue(name);
          expect(name).toMatch(/^--otc?-[a-z0-9_-]+$/);
          expect(matchesGrammar(value), `${name}: ${value}`).toBe(true);
          expect(value).not.toMatch(/[;{}<>\\]/);
        }
        applied += 1;
      } finally {
        scope.detach();
      }
    }
  });

  it("applied every case", () => expect(applied).toBe(cases.length * 2));
});
