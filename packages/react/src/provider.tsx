/**
 * OpenThemeProvider (T009; research RR2, RR5, RR6; FR-R002 to FR-R004).
 *
 * Attaches one Web adapter scope in a layout effect (client only, before paint) and detaches it in
 * the cleanup, so strict mode's mount, unmount, mount attaches, detaches, and attaches again.
 * `policy` goes to the controller, `sizeClass` and `textScale` to the scope. `initial`, `locale`,
 * and `nonce` are read when the scope is attached.
 */
import type { Core, PolicyInput, PreferenceStore, ResolvedTheme, UserPreferencesDocument } from "@opentheme/core";
import { attachTheme, sizeClassForWidth, type SizeClass } from "@opentheme/web";
import { createContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createThemeStore, type ThemeStore } from "./store.js";

export interface OpenThemeProviderProps {
  core: Core;
  /** `[a-z][a-z0-9-]*`. */
  scope: string;
  policy: PolicyInput;
  /** Default `"document"`. */
  target?: "document" | RefObject<HTMLElement | null>;
  /** Default `"medium"`; `"auto"` follows the window width. */
  sizeClass?: SizeClass | "auto";
  /** Default 1. */
  textScale?: number;
  /** Read at attach. */
  locale?: string;
  /** Default: the adapter's browser store. */
  store?: PreferenceStore | false;
  /** Read at attach. */
  initial?: Uint8Array | string | UserPreferencesDocument;
  /** Read at attach. */
  nonce?: string;
  /** What the hooks return during server rendering. */
  serverResolved?: ResolvedTheme;
  children?: ReactNode;
}

export interface ProviderValue {
  readonly store: ThemeStore;
  readonly serverResolved: ResolvedTheme | null;
}

export const OpenThemeContext = createContext<ProviderValue | null>(null);

/** useLayoutEffect warns on the server in React 18; effects never run there anyway. */
const useClientLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

const sizeOf = (sizeClass: SizeClass | "auto"): SizeClass => (sizeClass === "auto" ? sizeClassForWidth(window.innerWidth) : sizeClass);

export function OpenThemeProvider(props: OpenThemeProviderProps) {
  const { core, scope, policy, target = "document", sizeClass = "medium", textScale = 1, store, serverResolved, children } = props;
  const [themeStore] = useState(createThemeStore);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  if (failure) throw failure.error;

  const policyKey = JSON.stringify(policy);
  const latest = useRef(props);
  const appliedPolicy = useRef(policyKey);
  useClientLayoutEffect(() => {
    latest.current = props;
  });

  useClientLayoutEffect(() => {
    const host = target === "document" ? document : target.current;
    if (!host) return;
    const { locale, initial, nonce } = latest.current;
    let attached: ReturnType<typeof attachTheme>;
    try {
      attached = attachTheme({
        core,
        target: host,
        scope,
        policy: latest.current.policy,
        sizeClass: sizeOf(latest.current.sizeClass ?? "medium"),
        textScale: latest.current.textScale ?? 1,
        ...(locale !== undefined ? { locale } : {}),
        ...(store !== undefined ? { store } : {}),
        ...(initial !== undefined ? { initial } : {}),
        ...(nonce !== undefined ? { nonce } : {}),
      });
    } catch (error) {
      setFailure({ error });
      return;
    }
    appliedPolicy.current = JSON.stringify(latest.current.policy);
    const unbind = themeStore.bind(attached);
    return () => {
      unbind();
      attached.detach();
    };
  }, [core, target, scope, store, themeStore]);

  useClientLayoutEffect(() => {
    if (policyKey === appliedPolicy.current) return;
    appliedPolicy.current = policyKey;
    themeStore.get().scope?.controller.setPolicy(latest.current.policy);
  }, [policyKey, themeStore]);

  useClientLayoutEffect(() => {
    themeStore.get().scope?.setTextScale(textScale);
  }, [textScale, themeStore]);

  useClientLayoutEffect(() => {
    const apply = () => themeStore.get().scope?.setSizeClass(sizeOf(sizeClass));
    apply();
    if (sizeClass !== "auto") return;
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [sizeClass, themeStore]);

  const resolvedForServer = serverResolved ?? null;
  const value = useMemo<ProviderValue>(() => ({ store: themeStore, serverResolved: resolvedForServer }), [themeStore, resolvedForServer]);
  return <OpenThemeContext.Provider value={value}>{children}</OpenThemeContext.Provider>;
}
