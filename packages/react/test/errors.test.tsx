/** Errors stay current after asynchronous actions (FR-R012). */
import { createMemoryStore, type PreferenceStore } from "@opentheme/core";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenThemeProvider, useOpenTheme, type OpenThemeState } from "../src/index.js";
import { cleanup, mount, POLICY, referenceCore, reset } from "./helpers.js";

const GRAPHITE = { id: "org.opentheme.graphite" };
const AURORA = { id: "org.opentheme.aurora" };

beforeEach(reset);
afterEach(cleanup);

function setup(store: PreferenceStore) {
  const seen = { renders: 0, state: null as OpenThemeState | null };
  const Probe = () => {
    seen.state = useOpenTheme();
    seen.renders += 1;
    return null;
  };
  mount(
    <OpenThemeProvider core={referenceCore()} scope="app" policy={POLICY} store={store}>
      <Probe />
    </OpenThemeProvider>,
  );
  return seen;
}

const failing = (): PreferenceStore => ({
  ...createMemoryStore(),
  write: () => Promise.reject(new Error("disk full")),
});

const count = (s: OpenThemeState | null) => s!.errors.filter((e) => e.code === "store-write-failed").length;

describe("errors after asynchronous actions", () => {
  it("exposes store-write-failed after select, and again after a repeated action, one render each", async () => {
    const seen = setup(failing());
    const start = count(seen.state);
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    expect(count(seen.state)).toBe(start + 1);

    // Same theme again: the resolution is identical, only the error list grows.
    const before = seen.renders;
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    expect(count(seen.state)).toBe(start + 2);
    expect(seen.renders - before).toBe(1);
  });

  it("does not re-render for an action whose write succeeds and changes nothing", async () => {
    const seen = setup(createMemoryStore());
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    const before = seen.renders;
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    expect(seen.renders - before).toBe(0);
    expect(count(seen.state)).toBe(0);
  });

  it("still re-renders once for a successful select that changes the theme", async () => {
    const seen = setup(createMemoryStore());
    await act(async () => {
      await seen.state!.select(GRAPHITE);
    });
    const before = seen.renders;
    await act(async () => {
      await seen.state!.select(AURORA);
    });
    expect(seen.renders - before).toBe(1);
  });
});
