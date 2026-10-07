# Contract: `@opentheme/react` Public API

**Version**: 0.1.0 (pre-release) | **Spec**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md)

```tsx
import type { Core, PolicyInput, PreferenceStore, ResolvedTheme, ThemeController,
  UserPreferencesDocument, OperationalError, Outcome } from "@opentheme/core";
import type { AdapterReport } from "@opentheme/web";

export interface OpenThemeProviderProps {
  core: Core;
  scope: string;                                   // [a-z][a-z0-9-]*
  policy: PolicyInput;
  target?: "document" | React.RefObject<HTMLElement | null>;   // default "document"
  sizeClass?: "compact" | "medium" | "expanded" | "auto";      // default "medium"
  textScale?: number;                              // default 1
  locale?: string;                                 // read at attach
  store?: PreferenceStore | false;                 // default: the adapter's browser store
  initial?: Uint8Array | string | UserPreferencesDocument;     // read at attach
  nonce?: string;                                  // read at attach
  serverResolved?: ResolvedTheme;                  // what hooks return during server rendering
  children?: React.ReactNode;
}
export function OpenThemeProvider(props: OpenThemeProviderProps): React.JSX.Element;

export interface OpenThemeState {
  resolved: ResolvedTheme | null;                  // null until attached (or serverResolved)
  outcome: Outcome | null;
  errors: readonly OperationalError[];
  report: AdapterReport | null;
  controller: ThemeController | null;
  select: ThemeController["select"];               // each action rejects if not attached
  setValue: ThemeController["setValue"];
  clearValue: ThemeController["clearValue"];
  reset: ThemeController["reset"];
  preview: ThemeController["preview"];
  acceptPreview: ThemeController["acceptPreview"];
  cancelPreview: ThemeController["cancelPreview"];
}
export function useOpenTheme(): OpenThemeState;

/** A token path or `<contract>.<part>.<property>[.<state>]`; undefined when unknown. */
export function useThemeValue(path: string): unknown;

export interface OpenThemeStyleProps { resolved: ResolvedTheme; scope: string; root?: boolean; nonce?: string }
/** The Web adapter's server-rendered style element, for adoption by the provider. */
export function OpenThemeStyle(props: OpenThemeStyleProps): React.JSX.Element;
```

- Hooks outside a provider throw `Error("useOpenTheme must be used inside <OpenThemeProvider>")`
  (the hook's own name in the message).
- `root` defaults to `true` for `OpenThemeStyle` when the provider targets the document; pass
  `root={false}` for an element scope.
- Nothing else is exported.
