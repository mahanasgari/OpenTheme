/** Server rendering and adoption (US3; FR-R007, FR-R008, SC-R003). */
import type { PolicyInput, ResolvedTheme } from "@opentheme/core";
import { attachTheme, toStylesheet } from "@opentheme/web";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenThemeProvider, OpenThemeStyle, useOpenTheme } from "../src/index.js";
import { cleanup, declarationsOf, mount, POLICY, referenceCore, referenceDeclarations, reset, ruleOf } from "./helpers.js";

const GRAPHITE_POLICY: PolicyInput = { preset: "common-personalization", defaultTheme: "org.opentheme.graphite" };
const styles = () => document.querySelectorAll<HTMLStyleElement>("style[data-opentheme-scope]");

/** What the client's first resolution is for these inputs (a server would compute the same). */
function firstResolution(policy: PolicyInput = POLICY): ResolvedTheme {
  const s = attachTheme({ core: referenceCore(), target: document, scope: "probe", policy, sizeClass: "medium", store: false });
  const resolved = s.controller.current.resolved;
  s.detach();
  return resolved;
}

/** Parses markup the way a browser does, so attribute order does not matter. */
function parse(html: string): { attrs: Record<string, string>; text: string } {
  const template = document.createElement("template");
  template.innerHTML = html;
  const el = template.content.firstElementChild!;
  return { attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), text: el.textContent ?? "" };
}

function insertServerHtml(html: string): HTMLStyleElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  document.head.append(template.content);
  return document.querySelector<HTMLStyleElement>("style[data-opentheme-scope]")!;
}

function spyWrites(scope: string) {
  const style = ruleOf(scope)!.style;
  const set = vi.spyOn(style, "setProperty");
  const remove = vi.spyOn(style, "removeProperty");
  return {
    get total() {
      return set.mock.calls.length + remove.mock.calls.length;
    },
    get set() {
      return set.mock.calls.length;
    },
    restore() {
      set.mockRestore();
      remove.mockRestore();
    },
  };
}

beforeEach(reset);
afterEach(cleanup);

describe("OpenThemeStyle", () => {
  it.each([
    ["document scope with a nonce", { scope: "app", root: true, nonce: "abc" }],
    ["document scope without a nonce", { scope: "app", root: true }],
    ["element scope", { scope: "panel", root: false }],
    ["element scope with a nonce", { scope: "panel", root: false, nonce: "r4nd0m+/=" }],
  ])("renders the Web adapter's style element (%s)", (_name, options) => {
    const resolved = firstResolution();
    const html = renderToString(<OpenThemeStyle resolved={resolved} {...options} />);
    const expected = toStylesheet(resolved, { ...options, element: true });
    const got = parse(html);
    const want = parse(expected);
    expect(got.attrs).toEqual(want.attrs);
    expect(got.text).toBe(want.text);
    expect(got.text.length).toBeGreaterThan(3000);
    expect(html.startsWith("<style")).toBe(true);
    expect(html.endsWith("</style>")).toBe(true);
  });

  it("defaults root to true", () => {
    const resolved = firstResolution();
    const html = renderToString(<OpenThemeStyle resolved={resolved} scope="app" />);
    expect(parse(html).text).toBe(toStylesheet(resolved, { scope: "app", root: true }));
    expect(parse(html).text.startsWith(":root {")).toBe(true);
  });

  it("rejects what the adapter rejects (a bad scope or nonce)", () => {
    const resolved = firstResolution();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderToString(<OpenThemeStyle resolved={resolved} scope="Bad Scope" />)).toThrow(/scope/);
    expect(() => renderToString(<OpenThemeStyle resolved={resolved} scope="app" nonce={'x" onload="1'} />)).toThrow(/nonce/);
    errors.mockRestore();
  });
});

describe("adoption by the provider", () => {
  it("writes nothing when the inputs match the server-rendered element", () => {
    const html = renderToString(<OpenThemeStyle resolved={firstResolution()} scope="app" nonce="abc" />);
    const element = insertServerHtml(html);
    const writes = spyWrites("app");
    mount(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} store={false} nonce="abc" />);
    expect(writes.total).toBe(0);
    expect(styles()).toHaveLength(1);
    expect(styles()[0]).toBe(element);
    expect(element.getAttribute("nonce")).toBe("abc");
    writes.restore();
  });

  it("an element scope adopts its server-rendered element", () => {
    const panel = document.createElement("div");
    panel.setAttribute("data-opentheme-scope", "panel");
    document.body.append(panel);
    const probe = attachTheme({ core: referenceCore(), target: panel, scope: "panel", policy: POLICY, sizeClass: "medium", store: false });
    const resolved = probe.controller.current.resolved;
    probe.detach();
    panel.setAttribute("data-opentheme-scope", "panel");
    const element = insertServerHtml(renderToString(<OpenThemeStyle resolved={resolved} scope="panel" root={false} />));
    const writes = spyWrites("panel");
    const ref = { current: panel };
    mount(<OpenThemeProvider core={referenceCore()} scope="panel" policy={POLICY} target={ref} store={false} />);
    expect(writes.total).toBe(0);
    expect(styles()[0]).toBe(element);
    writes.restore();
  });

  it("writes only what differs when the client resolves another theme", () => {
    const expected = referenceDeclarations({ core: referenceCore(), policy: GRAPHITE_POLICY });
    insertServerHtml(renderToString(<OpenThemeStyle resolved={firstResolution()} scope="app" />));
    const writes = spyWrites("app");
    mount(<OpenThemeProvider core={referenceCore()} scope="app" policy={GRAPHITE_POLICY} store={false} />);
    expect(writes.set).toBeGreaterThan(0);
    expect(declarationsOf("app")).toEqual(expected);
    writes.restore();
  });

  it("removes the adopted element on unmount", () => {
    insertServerHtml(renderToString(<OpenThemeStyle resolved={firstResolution()} scope="app" />));
    const m = mount(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} store={false} />);
    m.unmount();
    expect(styles()).toHaveLength(0);
  });
});

describe("hydration", () => {
  it("hydrates a provider with serverResolved without mismatches and then attaches", async () => {
    const resolved = firstResolution();
    const Name = () => <b>{String(useOpenTheme().resolved?.displayText?.name ?? "none")}</b>;
    const app = (
      <OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} store={false} serverResolved={resolved}>
        <Name />
      </OpenThemeProvider>
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(app);
    document.body.append(host);
    expect(host.textContent).toBe("Aurora");
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      hydrateRoot(host, app);
    });
    expect(errors).not.toHaveBeenCalled();
    expect(host.textContent).toBe("Aurora");
    expect(styles()).toHaveLength(1);
    errors.mockRestore();
  });
});
