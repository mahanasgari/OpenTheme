/** Strict mode mounts, unmounts, and mounts again; one scope must remain (US1 scenario 3; FR-R002). */
import { createRef, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenThemeProvider } from "../src/index.js";
import { cleanup, declarationsOf, mount, POLICY, referenceCore, referenceDeclarations, reset } from "./helpers.js";

const styles = () => document.querySelectorAll("style[data-opentheme-scope]");

beforeEach(reset);
afterEach(cleanup);

describe("React.StrictMode", () => {
  it("leaves exactly one style element after mounting, with the right properties", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const core = referenceCore();
    const m = mount(
      <StrictMode>
        <OpenThemeProvider core={core} scope="app" policy={POLICY} store={false}>
          <p>x</p>
        </OpenThemeProvider>
      </StrictMode>,
    );
    expect(styles()).toHaveLength(1);
    expect(declarationsOf("app")).toEqual(referenceDeclarations({ core, policy: POLICY }));
    expect(errors).not.toHaveBeenCalled();
    m.unmount();
    expect(styles()).toHaveLength(0);
    errors.mockRestore();
  });

  it("an element scope is attached once and its attribute removed on unmount", () => {
    const ref = createRef<HTMLDivElement>();
    const m = mount(
      <StrictMode>
        <OpenThemeProvider core={referenceCore()} scope="panel" policy={POLICY} target={ref} store={false}>
          <div ref={ref} id="panel" />
        </OpenThemeProvider>
      </StrictMode>,
    );
    const panel = m.host.querySelector("#panel")!;
    expect(styles()).toHaveLength(1);
    expect(panel.getAttribute("data-opentheme-scope")).toBe("panel");
    m.unmount();
    expect(styles()).toHaveLength(0);
    expect(panel.hasAttribute("data-opentheme-scope")).toBe(false);
  });

  it("updates still apply after the strict-mode remount", () => {
    const core = referenceCore();
    const m = mount(
      <StrictMode>
        <OpenThemeProvider core={core} scope="app" policy={POLICY} store={false} />
      </StrictMode>,
    );
    const before = declarationsOf("app");
    m.rerender(
      <StrictMode>
        <OpenThemeProvider core={core} scope="app" policy={POLICY} textScale={1.5} store={false} />
      </StrictMode>,
    );
    expect(styles()).toHaveLength(1);
    expect(declarationsOf("app")).not.toEqual(before);
  });
});
