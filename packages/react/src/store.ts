/**
 * The provider-owned external store behind the hooks (T006; research RR3).
 *
 * The snapshot is replaced only inside the controller's subscribe callback (and once right after
 * attaching). It never reads `controller.current` from a getter: after a refresh that publishes
 * nothing, Core may return a new object with identical content, which would break
 * `useSyncExternalStore`'s cached-snapshot rule.
 */
import type { OperationalError, Outcome, ResolvedTheme, ThemeController } from "@opentheme/core";
import type { AdapterReport, WebScope } from "@opentheme/web";

export interface Snapshot {
  readonly resolved: ResolvedTheme | null;
  readonly outcome: Outcome | null;
  readonly errors: readonly OperationalError[];
  readonly report: AdapterReport | null;
  readonly scope: WebScope | null;
}

export interface ThemeStore {
  subscribe(listener: () => void): () => void;
  get(): Snapshot;
  /** Publish the scope's current result, then every later one; the returned function stops it. */
  bind(scope: WebScope): () => void;
}

const EMPTY: Snapshot = Object.freeze({ resolved: null, outcome: null, errors: [], report: null, scope: null });

/** What hooks see during server rendering: nothing attached, and the resolution the server supplied. */
export const serverSnapshot = (resolved: ResolvedTheme | null): Snapshot => (resolved ? { ...EMPTY, resolved } : EMPTY);

type Published = ThemeController["current"];

export function createThemeStore(): ThemeStore {
  let snapshot = EMPTY;
  const listeners = new Set<() => void>();

  const set = (next: Snapshot) => {
    snapshot = next;
    for (const l of [...listeners]) l();
  };
  const of = (scope: WebScope, result: Published): Snapshot => ({
    resolved: result.resolved,
    outcome: result.outcome,
    errors: scope.errors,
    report: scope.report,
    scope,
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    get: () => snapshot,
    bind(scope) {
      set(of(scope, scope.controller.current));
      const stop = scope.controller.subscribe((result) => set(of(scope, result)));
      return () => {
        stop();
        if (snapshot.scope === scope) set(EMPTY);
      };
    },
  };
}
