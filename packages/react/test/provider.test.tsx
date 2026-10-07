/** The provider attaches, updates, and detaches one Web adapter scope (US1; FR-R002 to FR-R004, SC-R001). */
import type { PolicyInput, PreferenceStore } from "@opentheme/core";
import { act, Component, createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenThemeProvider } from "../src/index.js";
import { cleanup, LIGHT_CONTEXT, declarationsOf, mount, observed, POLICY, referenceCore, referenceDeclarations, reset, ruleOf } from "./helpers.js";

const GRAPHITE_POLICY: PolicyInput = { preset: "common-personalization", defaultTheme: "org.opentheme.graphite" };
const styles = () => document.querySelectorAll<HTMLStyleElement>("style[data-opentheme-scope]");

beforeEach(reset);
afterEach(cleanup);

describe("document provider", () => {
  it.each([
    ["aurora", POLICY],
    ["graphite", GRAPHITE_POLICY],
  ])("applies exactly the properties attachTheme applies (%s)", (_name, policy) => {
    const core = referenceCore();
    const expected = referenceDeclarations({ core, policy, textScale: 1.25 });
    expect(Object.keys(expected).length).toBeGreaterThan(300);
    expect(Object.keys(expected).some((n) => n.startsWith("--ot-"))).toBe(true);
    expect(Object.keys(expected).some((n) => n.startsWith("--otc-"))).toBe(true);
    expect(styles()).toHaveLength(0);

    mount(
      <OpenThemeProvider core={core} scope="app" policy={policy} textScale={1.25} store={false}>
        <p>hello</p>
      </OpenThemeProvider>,
    );
    expect(declarationsOf("app")).toEqual(expected);
    expect(ruleOf("app")!.selectorText).toBe(":root");
  });

  it("the two reference themes differ, so equivalence is not vacuous", () => {
    const core = referenceCore();
    expect(referenceDeclarations({ core, policy: POLICY })).not.toEqual(referenceDeclarations({ core, policy: GRAPHITE_POLICY }));
  });

  it("renders its children", () => {
    const m = mount(
      <OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} store={false}>
        <p>hello</p>
      </OpenThemeProvider>,
    );
    expect(m.host.textContent).toBe("hello");
  });

  it("unmounting removes the style element", () => {
    const m = mount(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} store={false} />);
    expect(styles()).toHaveLength(1);
    m.unmount();
    expect(styles()).toHaveLength(0);
    expect(document.documentElement.hasAttribute("data-opentheme-scope")).toBe(false);
  });
});

describe("element target", () => {
  it("themes only that element's scope and removes the attribute on unmount", () => {
    const core = referenceCore();
    const ref = createRef<HTMLDivElement>();
    const m = mount(
      <div>
        <OpenThemeProvider core={core} scope="panel" policy={POLICY} target={ref} store={false}>
          <div ref={ref} id="panel" />
        </OpenThemeProvider>
        <div id="other" />
      </div>,
    );
    const panel = m.host.querySelector("#panel")!;
    expect(panel.getAttribute("data-opentheme-scope")).toBe("panel");
    expect(m.host.querySelector("#other")!.hasAttribute("data-opentheme-scope")).toBe(false);
    expect(document.documentElement.hasAttribute("data-opentheme-scope")).toBe(false);
    expect(styles()).toHaveLength(1);
    expect(ruleOf("panel")!.selectorText).toBe('[data-opentheme-scope="panel"]');
    expect(Object.keys(declarationsOf("panel")).length).toBeGreaterThan(300);

    m.unmount();
    expect(styles()).toHaveLength(0);
    expect(panel.hasAttribute("data-opentheme-scope")).toBe(false);
  });

  it("attaches nothing while the ref is empty", () => {
    const ref = createRef<HTMLDivElement>();
    mount(<OpenThemeProvider core={referenceCore()} scope="panel" policy={POLICY} target={ref} store={false} />);
    expect(styles()).toHaveLength(0);
  });
});

describe("prop updates", () => {
  const ui = (props: Partial<Parameters<typeof OpenThemeProvider>[0]> = {}) => (
    <OpenThemeProvider core={core} scope="app" policy={POLICY} store={false} {...props} />
  );
  let core = referenceCore();
  beforeEach(() => {
    core = referenceCore();
  });

  it("a textScale change updates the same scope without detaching", () => {
    const seen = observed(core);
    core = seen.core;
    const m = mount(ui());
    const element = styles()[0]!;
    const before = declarationsOf("app");
    m.rerender(ui({ textScale: 1.5 }));
    expect(styles()).toHaveLength(1);
    expect(styles()[0]).toBe(element);
    expect(seen.controllers).toHaveLength(1);
    const after = declarationsOf("app");
    expect(after).not.toEqual(before);
    m.unmount();
    expect(after).toEqual(referenceDeclarations({ core: referenceCore(), policy: POLICY, textScale: 1.5 }));
  });

  it("a sizeClass change reaches the controller without detaching", () => {
    const seen = observed(core);
    core = seen.core;
    const m = mount(ui());
    const element = styles()[0]!;
    expect(seen.controllers[0]!.current.resolved.context.sizeClass).toBe("medium");
    m.rerender(ui({ sizeClass: "compact" }));
    expect(styles()[0]).toBe(element);
    expect(seen.controllers).toHaveLength(1);
    expect(seen.controllers[0]!.current.resolved.context.sizeClass).toBe("compact");
    m.rerender(ui({ sizeClass: "expanded" }));
    expect(seen.controllers[0]!.current.resolved.context.sizeClass).toBe("expanded");
  });

  it("a policy change goes to the existing controller", () => {
    const seen = observed(core);
    core = seen.core;
    const m = mount(ui());
    const element = styles()[0]!;
    const aurora = declarationsOf("app");
    m.rerender(ui({ policy: GRAPHITE_POLICY }));
    expect(styles()[0]).toBe(element);
    expect(seen.controllers).toHaveLength(1);
    expect(seen.policyCalls).toEqual([GRAPHITE_POLICY]);
    const graphite = declarationsOf("app");
    expect(graphite).not.toEqual(aurora);
    m.unmount();
    expect(graphite).toEqual(referenceDeclarations({ core: referenceCore(), policy: GRAPHITE_POLICY }));
  });

  it("an equal policy under a new object identity is not passed on", () => {
    const seen = observed(core);
    core = seen.core;
    const m = mount(ui({ policy: { ...POLICY } }));
    m.rerender(ui({ policy: { ...POLICY } }));
    m.rerender(ui({ policy: { ...POLICY } }));
    expect(seen.policyCalls).toHaveLength(0);
  });

  it("a scope change replaces the scope", () => {
    const seen = observed(core);
    core = seen.core;
    const m = mount(ui());
    const first = styles()[0]!;
    m.rerender(ui({ scope: "other" }));
    expect(styles()).toHaveLength(1);
    expect(styles()[0]!.getAttribute("data-opentheme-scope")).toBe("other");
    expect(styles()[0]).not.toBe(first);
    expect(first.isConnected).toBe(false);
    expect(seen.controllers).toHaveLength(2);
  });

  it("a core change replaces the scope", () => {
    const first = observed(core);
    const m = mount(ui({ core: first.core }));
    const element = styles()[0]!;
    const second = observed(referenceCore());
    m.rerender(ui({ core: second.core }));
    expect(styles()).toHaveLength(1);
    expect(styles()[0]).not.toBe(element);
    expect(element.isConnected).toBe(false);
    expect(first.controllers).toHaveLength(1);
    expect(second.controllers).toHaveLength(1);
    const applied = declarationsOf("app");
    m.unmount();
    expect(applied).toEqual(referenceDeclarations({ core: referenceCore(), policy: POLICY }));
  });

  it("sizeClass auto follows the window width", () => {
    const original = window.innerWidth;
    const seen = observed(core);
    core = seen.core;
    try {
      window.innerWidth = 1200;
      mount(ui({ sizeClass: "auto" }));
      const size = () => seen.controllers[0]!.current.resolved.context.sizeClass;
      expect(size()).toBe("expanded");
      window.innerWidth = 500;
      act(() => void window.dispatchEvent(new Event("resize")));
      expect(size()).toBe("compact");
      window.innerWidth = 800;
      act(() => void window.dispatchEvent(new Event("resize")));
      expect(size()).toBe("medium");
    } finally {
      window.innerWidth = original;
    }
  });

  it("the resize listener is removed on unmount and when auto is turned off", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const m = mount(ui({ sizeClass: "auto" }));
    const added = add.mock.calls.filter((c) => c[0] === "resize");
    expect(added.length).toBeGreaterThan(0);
    m.rerender(ui({ sizeClass: "compact" }));
    expect(remove.mock.calls.filter((c) => c[0] === "resize")).toHaveLength(added.length);
    add.mockRestore();
    remove.mockRestore();
  });
});

describe("preference store", () => {
  it("writes opentheme:<scope> with the default browser store", async () => {
    const seen = observed(referenceCore());
    mount(<OpenThemeProvider core={seen.core} scope="app" policy={POLICY} />);
    expect(localStorage.getItem("opentheme:app")).toBeNull();
    await act(async () => {
      await seen.controllers[0]!.select({ id: "org.opentheme.graphite" });
    });
    expect(localStorage.getItem("opentheme:app")).toContain("org.opentheme.graphite");
  });

  it("store={false} writes nothing", async () => {
    const seen = observed(referenceCore());
    mount(<OpenThemeProvider core={seen.core} scope="app" policy={POLICY} store={false} />);
    await act(async () => {
      await seen.controllers[0]!.select({ id: "org.opentheme.graphite" });
    });
    expect(localStorage.length).toBe(0);
  });

  it("reads stored preferences before the first resolution", async () => {
    const ctl = referenceCore().createController({ policy: POLICY, context: LIGHT_CONTEXT });
    await ctl.select({ id: "org.opentheme.graphite" });
    localStorage.setItem("opentheme:app", ctl.exportDocument());
    const expected = referenceDeclarations({ core: referenceCore(), policy: GRAPHITE_POLICY });
    mount(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} />);
    expect(declarationsOf("app")).toEqual(expected);
  });

  it("unmounting while a write is pending raises nothing", async () => {
    let finish: () => void = () => undefined;
    const store: PreferenceStore = {
      read: async () => null,
      write: () => new Promise<void>((resolve) => (finish = resolve)),
      clear: async () => undefined,
    };
    const seen = observed(referenceCore());
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const m = mount(<OpenThemeProvider core={seen.core} scope="app" policy={POLICY} store={store} />);
    const pending = seen.controllers[0]!.select({ id: "org.opentheme.graphite" }).catch(() => undefined);
    m.unmount();
    finish();
    await pending;
    expect(styles()).toHaveLength(0);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("errors", () => {
  class Boundary extends Component<{ children: ReactNode; onError: (e: unknown) => void }, { failed: boolean }> {
    override state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    override componentDidCatch(e: unknown) {
      this.props.onError(e);
    }
    override render() {
      return this.state.failed ? <p>failed</p> : this.props.children;
    }
  }

  it("a scope conflict is thrown to the nearest error boundary", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caught: unknown[] = [];
    const core = referenceCore();
    const m = mount(
      <>
        <OpenThemeProvider core={core} scope="app" policy={POLICY} store={false} />
        <Boundary onError={(e) => caught.push(e)}>
          <OpenThemeProvider core={core} scope="app" policy={POLICY} store={false} />
        </Boundary>
      </>,
    );
    expect(caught).toHaveLength(1);
    expect(caught[0]).toMatchObject({ kind: "scope-conflict" });
    expect(m.host.textContent).toBe("failed");
    expect(styles()).toHaveLength(1);
    errors.mockRestore();
  });

  it("an invalid scope id is thrown to the boundary", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caught: unknown[] = [];
    mount(
      <Boundary onError={(e) => caught.push(e)}>
        <OpenThemeProvider core={referenceCore()} scope="Not Valid" policy={POLICY} store={false} />
      </Boundary>,
    );
    expect(caught[0]).toMatchObject({ kind: "invalid-argument" });
    errors.mockRestore();
  });
});
