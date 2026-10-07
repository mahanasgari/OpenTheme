/** Reading and changing the theme from components (US2; FR-R005, FR-R006, SC-R002). */
import { act, useState, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenThemeProvider, useOpenTheme, useThemeValue, type OpenThemeState } from "../src/index.js";
import { cleanup, declarationsOf, mount, observed, POLICY, referenceCore, referenceDeclarations, reset } from "./helpers.js";

const GRAPHITE = { id: "org.opentheme.graphite" };
const MESSAGE = "useOpenTheme must be used inside <OpenThemeProvider>";

beforeEach(reset);
afterEach(cleanup);

/** A consumer that counts its renders and exposes the last state it saw. */
function theme() {
  const seen = { renders: 0, state: null as OpenThemeState | null };
  const Probe = () => {
    seen.state = useOpenTheme();
    seen.renders += 1;
    return <span id="name">{String(seen.state.resolved?.displayText?.name ?? "")}</span>;
  };
  return { seen, element: <Probe /> };
}

function setup(ui: ReactNode, props: Partial<Parameters<typeof OpenThemeProvider>[0]> = {}) {
  const core = observed(referenceCore());
  const view = (extra: Partial<Parameters<typeof OpenThemeProvider>[0]> = {}) => (
    <OpenThemeProvider core={core.core} scope="app" policy={POLICY} store={false} {...props} {...extra}>
      {ui}
    </OpenThemeProvider>
  );
  const m = mount(view());
  return { ...m, core, view };
}

describe("useOpenTheme", () => {
  it("returns Core's resolved theme, outcome, errors, report, and controller after mount", () => {
    const { seen, element } = theme();
    const { core } = setup(element);
    const controller = core.controllers[0]!;
    const s = seen.state!;
    expect(s.resolved).toBe(controller.current.resolved);
    expect(s.resolved?.applied.id).toBe("org.opentheme.aurora");
    expect(s.outcome).toBe(controller.current.outcome);
    expect(s.errors).toEqual([]);
    expect(s.report?.set).toBeGreaterThan(300);
    expect(s.controller).toBe(controller);
    expect(document.querySelector("#name")!.textContent).toBe("Aurora");
  });

  it("select re-renders the consumer exactly once with the new theme applied", async () => {
    const { seen, element } = theme();
    const { core } = setup(element);
    const before = seen.renders;
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    expect(seen.renders - before).toBe(1);
    expect(seen.state!.resolved?.applied.id).toBe("org.opentheme.graphite");
    expect(document.querySelector("#name")!.textContent).toBe("Graphite");
    expect(seen.state!.resolved).toBe(core.controllers[0]!.current.resolved);
    expect(Object.keys(declarationsOf("app")).length).toBeGreaterThan(300);
  });

  it("selecting a theme applies the same properties as attaching it", async () => {
    const { seen, element } = theme();
    const { unmount } = setup(element);
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    const applied = declarationsOf("app");
    unmount();
    const expected = referenceDeclarations({
      core: referenceCore(),
      policy: { preset: "common-personalization", defaultTheme: "org.opentheme.graphite" },
    });
    expect(applied).toEqual(expected);
  });

  it("changes that leave the resolution identical cause zero re-renders", () => {
    const { seen, element } = theme();
    const { rerender, view } = setup(element);
    const before = seen.renders;
    // The same size class, the same text scale, an equal policy under a new identity, an unchanged tree.
    rerender(view({ sizeClass: "medium", textScale: 1, policy: { ...POLICY } }));
    rerender(view({ sizeClass: "medium", textScale: 1, policy: { ...POLICY } }));
    expect(seen.renders).toBe(before);
  });

  it("a real change from props re-renders exactly once", () => {
    const { seen, element } = theme();
    const { rerender, view } = setup(element);
    const before = seen.renders;
    rerender(view({ sizeClass: "compact" }));
    expect(seen.renders - before).toBe(1);
    expect(seen.state!.resolved?.context.sizeClass).toBe("compact");
  });

  it("exposes personalization actions that change the resolution", async () => {
    const { seen, element } = theme();
    setup(element);
    const density = () => seen.state!.resolved?.preferences?.["std.density"];
    await act(async () => {
      await seen.state!.setValue("std.density", "compact");
    });
    expect(density()).toMatchObject({ status: "effective", value: "compact" });
    await act(async () => {
      await seen.state!.clearValue("std.density");
    });
    expect(density()?.value ?? null).not.toBe("compact");

    act(() => seen.state!.preview({ selection: GRAPHITE }));
    expect(seen.state!.resolved?.applied.id).toBe("org.opentheme.graphite");
    act(() => seen.state!.cancelPreview());
    expect(seen.state!.resolved?.applied.id).toBe("org.opentheme.aurora");

    act(() => seen.state!.preview({ selection: GRAPHITE }));
    await act(async () => {
      await seen.state!.acceptPreview();
    });
    expect(seen.state!.resolved?.applied.id).toBe("org.opentheme.graphite");

    await act(async () => {
      await seen.state!.reset();
    });
    expect(seen.state!.resolved?.applied.id).toBe("org.opentheme.aurora");
  });

  it("is null and unattached before a provider has attached", () => {
    const { seen, element } = theme();
    renderToString(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY}>{element}</OpenThemeProvider>);
    expect(seen.state).toMatchObject({ resolved: null, outcome: null, report: null, controller: null, errors: [] });
  });

  it("actions reject (or throw, when synchronous) before attach", async () => {
    const { seen, element } = theme();
    renderToString(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY}>{element}</OpenThemeProvider>);
    const s = seen.state!;
    await expect(s.select(GRAPHITE)).rejects.toThrow(/not attached/);
    await expect(s.setValue("std.density", "compact")).rejects.toThrow(/not attached/);
    await expect(s.clearValue("std.density")).rejects.toThrow(/not attached/);
    await expect(s.reset()).rejects.toThrow(/not attached/);
    await expect(s.acceptPreview()).rejects.toThrow(/not attached/);
    expect(() => s.preview({ selection: GRAPHITE })).toThrow(/not attached/);
    expect(() => s.cancelPreview()).toThrow(/not attached/);
  });

  it("throws the contract's message outside a provider", () => {
    const Bare = () => {
      useOpenTheme();
      return null;
    };
    const err = (() => {
      try {
        renderToString(<Bare />);
      } catch (e) {
        return e as Error;
      }
      return null;
    })();
    expect(err?.message).toBe(MESSAGE);
  });
});

describe("useThemeValue", () => {
  function value(path: string) {
    const seen = { renders: 0, value: undefined as unknown, history: [] as unknown[] };
    let bump: () => void = () => undefined;
    const Probe = () => {
      const [, setN] = useState(0);
      bump = () => setN((n) => n + 1);
      seen.value = useThemeValue(path);
      seen.history.push(seen.value);
      seen.renders += 1;
      return null;
    };
    return { seen, element: <Probe />, bump: () => act(() => bump()) };
  }

  it("equals the resolved token", () => {
    const v = value("color.text.primary");
    const { core } = setup(v.element);
    expect(v.seen.value).toEqual(core.controllers[0]!.current.resolved.tokens["color.text.primary"]);
    expect(v.seen.value).toBeDefined();
  });

  it("equals the resolved component value for a component path", () => {
    const v = value("std/button.container.background.default");
    const { core } = setup(v.element);
    const resolved = core.controllers[0]!.current.resolved as unknown as { components: Record<string, any> };
    expect(v.seen.value).toEqual(resolved.components["std/button"].container.background.default);
    expect(v.seen.value).toBeDefined();
  });

  it("keeps the same reference across unrelated re-renders", () => {
    const v = value("color.text.primary");
    setup(v.element);
    const first = v.seen.value;
    v.bump();
    v.bump();
    const attached = v.seen.history.filter((h) => h !== undefined);
    expect(attached.length).toBeGreaterThanOrEqual(3);
    expect(attached.every((h) => h === first)).toBe(true);
  });

  it("does not re-render when an unrelated change leaves its value unchanged", () => {
    const v = value("color.text.primary");
    const { rerender, view } = setup(v.element);
    const first = v.seen.value;
    const before = v.seen.renders;
    // A text scale change publishes a new resolution, but this token keeps its value.
    rerender(view({ textScale: 1.5 }));
    expect(v.seen.renders).toBe(before);
    expect(v.seen.value).toBe(first);
  });

  it("re-renders once, with the new value, when the token changes", async () => {
    const v = value("color.text.primary");
    const t = theme();
    const { core } = setup(
      <>
        {v.element}
        {t.element}
      </>,
    );
    const first = v.seen.value;
    const before = v.seen.renders;
    await act(async () => {
      await t.seen.state!.select(GRAPHITE);
    });
    expect(v.seen.renders - before).toBe(1);
    expect(v.seen.value).not.toEqual(first);
    expect(v.seen.value).toEqual(core.controllers[0]!.current.resolved.tokens["color.text.primary"]);
  });

  it("returns undefined for an unknown path", () => {
    for (const path of ["no.such.token", "std/button.container.nope.default", "std/missing.a.b", ""]) {
      const v = value(path);
      setup(v.element);
      expect(v.seen.value, path).toBeUndefined();
      cleanup();
    }
  });

  it("returns undefined before attach", () => {
    const v = value("color.text.primary");
    renderToString(<OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY}>{v.element}</OpenThemeProvider>);
    expect(v.seen.value).toBeUndefined();
  });

  it("throws the contract's message with its own name outside a provider", () => {
    const Bare = () => {
      useThemeValue("color.text.primary");
      return null;
    };
    expect(() => renderToString(<Bare />)).toThrow("useThemeValue must be used inside <OpenThemeProvider>");
  });
});
