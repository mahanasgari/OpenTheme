# Research: OpenTheme Web Adapter

**Feature**: `003-web-adapter` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Each decision records what was chosen, why, and what else was considered. There were no open
clarifications in the spec; these decisions settle the technical questions it left to the plan.

## WR1. Package and dependencies

- **Decision**: A new workspace package `packages/web` (`@opentheme/web`, TypeScript, ES2022, ESM
  only). Runtime dependency: `@opentheme/core` only, declared as a peer dependency. Build with
  `tsc`, like Core. The DOM types come from the TypeScript `DOM` lib in this package only.
- **Rationale**: Constitution V requires independently versioned output targets; FR-W042 forbids
  other runtime dependencies. A peer dependency keeps one Core instance per page.
- **Alternatives considered**: Adding the adapter to Core (rejected: Core must stay free of DOM
  APIs, FR-C005 and its boundary lint); a regular dependency (rejected: could load two Cores).

## WR2. Custom property naming scheme (FR-W002)

- **Decision**: Every name is `--ot-` followed by an encoding of a canonical path, where token path
  segments and contract parts never contain `_`:
  - token `a.b.c` becomes `--ot-a_b_c` (each `.` becomes `_`);
  - a host-qualified token `com.example.notes/brand.ink` becomes `--ot-com_example_notes__brand_ink`
    (`/` becomes `__`);
  - a composite member becomes `___` plus the member name in kebab case, for example
    `--ot-text_body___font-size`;
  - component values use the prefix `--otc-`: `--otc-<contract>_<part>_<property>_<state>`, and
    variants insert `_v_<axis>_<value>` after the contract, for example
    `--otc-std__button_v_emphasis_primary_container_background_hover`.
  Runs of `_` of length 1, 2, and 3 are unambiguous because the grammar never allows `_` inside a
  segment (tokens: `[a-z][a-z0-9-]*`; identifiers: `[a-z0-9-.]`), so the mapping is injective and
  decodable. `--ot-` and `--otc-` differ at the fifth character, so tokens and components never
  collide.
- **Rationale**: Injectivity is required (FR-W002) and must hold for every valid path. Hyphens are
  legal inside segments (`focus-visible`, `font--size`), so no separator made of hyphens can be
  injective; `_` is the only character the grammar excludes.
- **Alternatives considered**: `--color-text-primary` (the common convention; rejected: `a.b-c`
  and `a-b.c` collide); CSS escapes of `.` (`--ot-color\.text`; rejected: unreadable and error
  prone in hand-written CSS); hashing (rejected: not readable, not decodable).

## WR3. Value serialization (FR-W003, FR-W004)

- **Decision**: One serializer per resolved type, from Core's typed output only:

  | Resolved value | CSS text |
  |---|---|
  | `{ srgb8: [r, g, b], alpha }` | `rgb(r g b)` when `alpha` is 1, otherwise `rgb(r g b / a)` with `a` in shortest round-trip decimal |
  | `{ system: role }` | the role's `cssSystemColorHint` from `forced-colors.json` (for example `CanvasText`) |
  | `{ value, unit: "px" }` / `{ value, unit: "ms" }` | `<n>px` / `<n>ms` |
  | `{ number }` or a number | `<n>` |
  | `{ families: [...] }` | comma-separated list; generic families (the registry's closed list) unquoted, every other name double-quoted with `\` and `"` escaped |
  | cubic Bézier `[x1, y1, x2, y2]` | `cubic-bezier(x1, y1, x2, y2)` |
  | stroke style | the keyword |
  | border | `<width> <style> <color>`, plus each member as its own property |
  | shadow | `[inset] <x> <y> <blur> <spread> <color>`, plus each member |
  | typography | each member as its own property (no `font` shorthand: it resets unrelated properties) |

  Numbers use ECMAScript's shortest round-trip form, which CSS accepts (including exponents), so
  decoding recovers the exact binary64 value. Declarations are ordered by name in UTF-16
  code-unit order.
- **Rationale**: Exact round trip makes the conformance check (FR-W050) byte-precise; writing only
  typed values closes every injection path (FR-W040, constitution VI).
- **Alternatives considered**: Hex colors (rejected: alpha is quantized to 0.001, which two hex
  digits cannot represent exactly); `oklch()` output (rejected: Core's contract is quantized sRGB,
  and gamut mapping already happened).

## WR4. Applying declarations (FR-W005, FR-W007, FR-W030)

- **Decision**: Each scope owns one `<style data-opentheme-scope="<id>">` element containing one
  rule whose selector is `:root` for the document scope or `[data-opentheme-scope="<id>"]` for an
  element scope (the adapter sets that attribute). The element is created empty, the rule is added
  through the CSS object model, and updates call `setProperty` and `removeProperty` only for
  changed names. Server rendering emits the same element with the same rule; the client adopts it
  by attribute and diffs against its current declarations, writing nothing when they match.
- **Rationale**: One rule per scope keeps scopes independent and teardown trivial. Changes made
  through the CSS object model are not subject to a Content Security Policy's inline-style checks,
  so hosts with a strict policy work without `unsafe-inline`; hosts that need a nonce for the
  server-rendered element pass it through.
- **Alternatives considered**: Inline `style` attributes on the scope element (rejected: cannot be
  server-rendered without touching the host's markup, and they mix with host styles); constructed
  stylesheets only (rejected: no server-rendering equivalent).

## WR5. Browser context (FR-W010 to FR-W014)

- **Decision**:

  | Core context | Browser source | Missing or unknown |
  |---|---|---|
  | `colorScheme` | `prefers-color-scheme: dark` / `light` | `no-preference` |
  | `contrast` | `prefers-contrast: more` means `high` | `standard` |
  | `forcedColors` | `forced-colors: active` | `false` |
  | `reducedMotion` | `prefers-reduced-motion: reduce` | `false` |
  | `textScale` | host input (optional helper: root font size / 16) | `1` |
  | `sizeClass` | host input (optional helper: width against 600 px and 1024 px) | host default, required |
  | `direction` | the scope element's computed direction | `ltr` |
  | `locale` | the nearest `lang` attribute | host default |

  Listeners: `MediaQueryList` change events for the four media features, and one
  `MutationObserver` for `lang` and `dir` attributes on the document element and the scope element.
  The adapter compares the new context with the last one sent and calls `setContext` only on a
  real change.
- **Rationale**: Mirrors Core's context model exactly (FR-C050); nothing is guessed (FR-W014).
- **Alternatives considered**: Inferring the size class from `window.innerWidth` automatically
  (rejected: Core leaves size classes to the host, and element scopes need their own width);
  `prefers-contrast: less` as a Core value (rejected: Core has no such mode).

## WR6. Browser preference store (FR-W020 to FR-W023)

- **Decision**: `createBrowserStore({ storage?, prefix? })` implements Core's `PreferenceStore` over
  `localStorage` (or a host-supplied storage with the same interface), with keys
  `opentheme:<scope>`. `read` is synchronous; every access is wrapped so exceptions (disabled
  storage, quota exceeded, sandboxed frames) reject the promise, which Core reports as
  `store-read-failed` / `store-write-failed`. `readInitial(scope)` returns the stored bytes or
  `null` synchronously, and the scope passes them to Core's controller as `initial`, so the first
  resolution uses them without waiting.
- **Rationale**: Satisfies the constitution's local-store requirement and Core FR-C092; Core
  already validates and never overwrites stored documents it cannot use.
- **Alternatives considered**: IndexedDB (rejected: asynchronous, cannot serve the first paint);
  cookies (rejected: sent to servers, contrary to FR-W023).

## WR7. Output-target conformance (FR-W050)

- **Decision**: A decoder in the test suite parses the declarations back into typed values (the
  inverse of WR2 and WR3). For every resolution fixture, resolving through Core, serializing, and
  decoding must give values that are byte-identical in JCS to Core's resolved tokens and
  components. Runs in `pnpm verify` as `conformance:web`.
- **Rationale**: Constitution V requires every output target to pass a shared conformance suite
  with Core as the oracle.

## WR8. Testing and benchmarks

- **Decision**: Vitest with `happy-dom` (dev dependency only) for DOM behavior: apply, diff, scopes,
  teardown, media-query events, and store failures. The existing browser page approach
  (`bench:core:browser`) is extended to run the web adapter's apply and update in a real browser.
  `bench:web` in Node measures declaration generation and diffing on the typical theme.
- **Rationale**: happy-dom is fast and sufficient for the DOM APIs used; real browser timing comes
  from the page.
- **Alternatives considered**: jsdom (rejected: slower, weaker CSS object model support); a
  headless browser in CI (deferred: adds a heavy dependency; the page covers manual runs).

## WR9. Budgets (constitution VIII)

- **Decision**: Apply the typical theme's full declaration set to a scope in at most 4 ms median;
  a context-change update including Core's re-resolution in at most 4 ms median; the adapter adds
  at most 10 KB gzip on top of Core (`size:web`, Core external).
- **Rationale**: Matches Core's re-resolution budget, so a context change stays within one frame.

## WR10. Names and value shapes outside the grammar (findings W1, W2)

- **Decision**: A name segment is written only if it matches `[a-z][a-z0-9-]*` (host identifiers:
  dot-separated segments of that form). Any other segment, which is possible because host
  declarations do not constrain contract, part, property, or variant names (finding W1), is not
  written; the property is omitted and listed in the adapter's report. A resolved value of a shape
  with no serializer, such as the host schema's `gradient` property type that no chapter defines
  (finding W2), is likewise omitted and reported.
- **Rationale**: Writing arbitrary host strings as CSS names would break injectivity (FR-W002) and
  open an injection path (FR-W040). Omitting and reporting is safe and visible; fixing the grammar
  belongs to the Foundation (FR-W043).
- **Alternatives considered**: Escaping arbitrary names (rejected: an escape scheme compatible with
  the `_` separators is either ambiguous or unreadable, and it would hide the Foundation gap).
