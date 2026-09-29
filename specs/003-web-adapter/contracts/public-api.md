# Contract: `@opentheme/web` Public API

**Version**: 0.1.0 (pre-release) | **Spec**: [../spec.md](../spec.md) | **Data model**:
[../data-model.md](../data-model.md)

Peer dependency: `@opentheme/core` 0.1.x. No other runtime dependency.

## Pure output (no DOM)

```ts
export function toDeclarations(resolved: ResolvedTheme): {
  declarations: readonly { name: string; value: string }[];   // name order
  omissions: readonly { path: string; reason: "name-grammar" | "value-shape" }[];
};
export function toStylesheet(resolved: ResolvedTheme, options?: {
  scope?: string;            // omitted: the document scope (:root)
  nonce?: string;
  element?: boolean;         // true: the full <style data-opentheme-scope> element text
}): string;
```

Both are deterministic and safe to call on a server.

## Scopes (DOM)

```ts
export function attachTheme(options: {
  core: Core;
  target: Document | Element;           // Document: :root scope
  scope: string;                        // [a-z][a-z0-9-]*
  policy: PolicyInput;
  sizeClass: "compact" | "medium" | "expanded";
  textScale?: number;                   // default 1
  locale?: string;                      // default: nearest lang, else "en"
  store?: PreferenceStore | false;      // default: createBrowserStore(); false: none
  initial?: Uint8Array | string | UserPreferencesDocument;  // default: store.readInitial(scope)
  nonce?: string;
}): WebScope;

export interface WebScope {
  readonly controller: ThemeController;   // Core's controller: select, setValue, preview, …
  readonly report: AdapterReport;         // last update's omissions and write counts
  setSizeClass(sizeClass: "compact" | "medium" | "expanded"): void;
  setTextScale(textScale: number): void;
  detach(): void;                          // idempotent
}
```

| Aspect | Contract |
|---|---|
| First application | Synchronous: the stored or `initial` preferences are used by the first resolution; an adopted server-rendered element is not rewritten when unchanged |
| Updates | Every controller publication is applied by diff: only changed properties are set or removed |
| Context | Media features and `lang`/`dir` are observed; Core's `setContext` is called only on a real change |
| Errors | Attaching to a managed target throws `scope-conflict`; an invalid `scope` id throws `invalid-argument`; context errors are Core's `invalid-context` |
| Teardown | `detach` removes the rule, the style element it created or adopted, the scope attribute, and every listener |

## Preferences

```ts
export function createBrowserStore(options?: { storage?: Storage; prefix?: string }):
  PreferenceStore & { readInitial(scope: string): string | null };
```

Exceptions from storage become rejected promises, which Core reports as `store-read-failed` /
`store-write-failed`. `readInitial` returns `null` on any failure.

## Helpers

```ts
export function sizeClassForWidth(widthPx: number): "compact" | "medium" | "expanded";  // 600 / 1024
export function textScaleFromRoot(document: Document): number;  // root font size / 16, else 1
```

## Not exported

Decoders (test-only), internal diffing, and anything that re-implements Core behavior.
