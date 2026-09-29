/** No flash of the wrong theme (US4; FR-W030; T029). */
import type { ResolvedTheme } from "@opentheme/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachTheme, toDeclarations, toStylesheet, type WebScope } from "../../src/index.js";
import { LIGHT_CONTEXT } from "../helpers.js";
import { AURORA_POLICY, referenceCore, reset, ruleOf, spyWrites } from "./setup.js";

const live: WebScope[] = [];
const base = { policy: AURORA_POLICY, sizeClass: "medium", store: false } as const;

/** What the client's first resolution is for these inputs (a server would compute the same). */
function firstResolution(initial?: string): ResolvedTheme {
  const s = attachTheme({ ...base, core: referenceCore(), target: document, scope: "app", ...(initial ? { initial } : {}) });
  const resolved = s.controller.current.resolved;
  s.detach();
  return resolved;
}

function serverRender(html: string): HTMLStyleElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  document.head.append(template.content);
  return document.querySelector<HTMLStyleElement>('style[data-opentheme-scope="app"]')!;
}

beforeEach(reset);
afterEach(() => {
  for (const s of live.splice(0)) s.detach();
  reset();
});

describe("first paint", () => {
  it("adopting a matching server-rendered element writes nothing", () => {
    const resolved = firstResolution();
    const element = serverRender(toStylesheet(resolved, { scope: "app", root: true, element: true, nonce: "r4nd0m+/=" }));
    expect(element.getAttribute("nonce")).toBe("r4nd0m+/=");
    expect(ruleOf("app")!.selectorText).toBe(":root");
    const writes = spyWrites("app");
    const s = attachTheme({ ...base, core: referenceCore(), target: document, scope: "app" });
    live.push(s);
    expect(writes.set + writes.removed).toBe(0);
    expect(s.report).toMatchObject({ set: 0, removed: 0 });
    expect(document.querySelectorAll("style[data-opentheme-scope]")).toHaveLength(1);
    expect(document.querySelector("style[data-opentheme-scope]")).toBe(element);
    expect(element.getAttribute("nonce")).toBe("r4nd0m+/=");
    writes.restore();
  });

  it("with different inputs only the differing properties are written", () => {
    const aurora = firstResolution();
    const ctl = referenceCore().createController({ policy: AURORA_POLICY, context: LIGHT_CONTEXT });
    void ctl.select({ id: "org.opentheme.graphite" });
    const graphiteDoc = ctl.exportDocument();
    const graphite = firstResolution(graphiteDoc);
    const before = new Map(toDeclarations(aurora).declarations.map((d) => [d.name, d.value]));
    const after = new Map(toDeclarations(graphite).declarations.map((d) => [d.name, d.value]));
    const changed = [...after].filter(([n, v]) => before.get(n) !== v).length;
    const gone = [...before.keys()].filter((n) => !after.has(n)).length;
    expect(changed).toBeGreaterThan(0);

    serverRender(toStylesheet(aurora, { scope: "app", root: true, element: true }));
    const writes = spyWrites("app");
    const s = attachTheme({ ...base, core: referenceCore(), target: document, scope: "app", initial: graphiteDoc });
    live.push(s);
    expect(writes.set).toBe(changed);
    expect(writes.removed).toBe(gone);
    for (const [n, v] of after) expect(ruleOf("app")!.style.getPropertyValue(n), n).toBe(v);
    writes.restore();
  });

  it("an element scope adopts its server-rendered element and attribute", () => {
    const panel = document.createElement("div");
    panel.setAttribute("data-opentheme-scope", "app");
    document.body.append(panel);
    const probe = attachTheme({ ...base, core: referenceCore(), target: panel, scope: "app" });
    const resolved = probe.controller.current.resolved;
    probe.detach();
    panel.setAttribute("data-opentheme-scope", "app");
    serverRender(toStylesheet(resolved, { scope: "app", element: true }));
    const writes = spyWrites("app");
    const s = attachTheme({ ...base, core: referenceCore(), target: panel, scope: "app" });
    live.push(s);
    expect(writes.set + writes.removed).toBe(0);
    s.detach();
    expect(document.querySelector("style[data-opentheme-scope]")).toBeNull();
    expect(panel.hasAttribute("data-opentheme-scope")).toBe(false);
    writes.restore();
  });

  it("a server element with a different selector is rebuilt, not trusted", () => {
    serverRender('<style data-opentheme-scope="app">body { color: red; }</style>');
    const s = attachTheme({ ...base, core: referenceCore(), target: document, scope: "app" });
    live.push(s);
    const sheet = document.querySelector<HTMLStyleElement>("style[data-opentheme-scope]")!.sheet!;
    expect(sheet.cssRules).toHaveLength(1);
    expect((sheet.cssRules[0] as CSSStyleRule).selectorText).toBe(":root");
    expect(s.report.set).toBeGreaterThan(300);
  });
});
