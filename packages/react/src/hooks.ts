/**
 * useOpenTheme and useThemeValue (T011; research RR3; FR-R005, FR-R006).
 *
 * Both read the provider's store with `useSyncExternalStore`; the store changes only when the
 * controller publishes, so components re-render only on a real change of the resolution.
 */
import type { OperationalError, Outcome, ResolvedTheme, ThemeController } from "@opentheme/core";
import type { AdapterReport } from "@opentheme/web";
import { useContext, useMemo, useRef, useSyncExternalStore } from "react";
import { pickValue } from "./path.js";
import { OpenThemeContext, type ProviderValue } from "./provider.js";
import { serverSnapshot, type Snapshot } from "./store.js";

export interface OpenThemeState {
  /** Null until attached (or `serverResolved` during server rendering). */
  resolved: ResolvedTheme | null;
  outcome: Outcome | null;
  errors: readonly OperationalError[];
  report: AdapterReport | null;
  controller: ThemeController | null;
  /** Each action rejects (or throws, when synchronous) if the provider is not attached. */
  select: ThemeController["select"];
  setValue: ThemeController["setValue"];
  clearValue: ThemeController["clearValue"];
  reset: ThemeController["reset"];
  preview: ThemeController["preview"];
  acceptPreview: ThemeController["acceptPreview"];
  cancelPreview: ThemeController["cancelPreview"];
}

function useProvider(hook: string): ProviderValue {
  const value = useContext(OpenThemeContext);
  if (!value) throw new Error(`${hook} must be used inside <OpenThemeProvider>`);
  return value;
}

function useSnapshot(hook: string): Snapshot {
  const { store, serverResolved } = useProvider(hook);
  const server = useMemo(() => serverSnapshot(serverResolved), [serverResolved]);
  return useSyncExternalStore(store.subscribe, store.get, () => server);
}

type Method = "select" | "setValue" | "clearValue" | "reset" | "preview" | "acceptPreview" | "cancelPreview";

function bound<K extends Method>(controller: ThemeController | null, key: K, asynchronous: boolean): ThemeController[K] {
  return ((...args: unknown[]) => {
    if (controller) return (controller[key] as (...a: unknown[]) => unknown)(...args);
    const error = new Error("OpenTheme is not attached yet; actions work once <OpenThemeProvider> has mounted in the browser");
    if (asynchronous) return Promise.reject(error);
    throw error;
  }) as ThemeController[K];
}

export function useOpenTheme(): OpenThemeState {
  const snapshot = useSnapshot("useOpenTheme");
  const controller = snapshot.scope?.controller ?? null;
  const actions = useMemo(
    () => ({
      select: bound(controller, "select", true),
      setValue: bound(controller, "setValue", true),
      clearValue: bound(controller, "clearValue", true),
      reset: bound(controller, "reset", true),
      preview: bound(controller, "preview", false),
      acceptPreview: bound(controller, "acceptPreview", true),
      cancelPreview: bound(controller, "cancelPreview", false),
    }),
    [controller],
  );
  return useMemo(
    () => ({
      resolved: snapshot.resolved,
      outcome: snapshot.outcome,
      errors: snapshot.errors,
      report: snapshot.report,
      controller,
      ...actions,
    }),
    [snapshot, controller, actions],
  );
}

/** A token path or `<contract>.<part>.<property>[.<state>]`; undefined when unknown. */
export function useThemeValue(path: string): unknown {
  const { store, serverResolved } = useProvider("useThemeValue");
  // Keep the previous value while a new resolution leaves this value's content unchanged.
  const last = useRef<{ json: string; value: unknown } | null>(null);
  const select = (resolved: ResolvedTheme | null): unknown => {
    const value = pickValue(resolved, path);
    if (value === undefined) return (last.current = null), undefined;
    const json = JSON.stringify(value);
    if (last.current?.json === json) return last.current.value;
    last.current = { json, value };
    return value;
  };
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get().resolved),
    () => select(serverResolved),
  );
}
