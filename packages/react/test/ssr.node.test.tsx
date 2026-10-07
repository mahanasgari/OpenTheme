// @vitest-environment node
/** Server rendering touches no browser API (FR-R008). */
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OpenThemeProvider, OpenThemeStyle, useOpenTheme, useThemeValue } from "../src/index.js";
import { LIGHT_CONTEXT, POLICY, referenceCore } from "./helpers.js";

const serverResolved = referenceCore().createController({ policy: POLICY, context: LIGHT_CONTEXT }).current.resolved;

describe("rendering in plain Node", () => {
  it("has no browser globals", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  it("the provider renders its children and hooks return serverResolved", () => {
    const seen: { resolved?: unknown; token?: unknown; controller?: unknown } = {};
    const Child = () => {
      const state = useOpenTheme();
      seen.resolved = state.resolved;
      seen.controller = state.controller;
      seen.token = useThemeValue("color.text.primary");
      return <p>{String(state.resolved?.displayText?.name)}</p>;
    };
    const html = renderToString(
      <OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} serverResolved={serverResolved}>
        <Child />
      </OpenThemeProvider>,
    );
    expect(html).toBe("<p>Aurora</p>");
    expect(seen.resolved).toBe(serverResolved);
    expect(seen.controller).toBeNull();
    expect(seen.token).toEqual(serverResolved.tokens["color.text.primary"]);
    expect(seen.token).toBeDefined();
  });

  it("without serverResolved hooks report that nothing is available", () => {
    const seen: { resolved?: unknown } = { resolved: "unset" };
    const Child = () => {
      seen.resolved = useOpenTheme().resolved;
      return null;
    };
    renderToString(
      <OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY}>
        <Child />
      </OpenThemeProvider>,
    );
    expect(seen.resolved).toBeNull();
  });

  it("the style component renders", () => {
    const html = renderToString(<OpenThemeStyle resolved={serverResolved} scope="app" nonce="abc" />);
    expect(html).toContain('data-opentheme-scope="app"');
    expect(html).toContain('nonce="abc"');
    expect(html).toContain(":root {");
  });
});
