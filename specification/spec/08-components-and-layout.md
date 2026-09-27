# 08. Components and Layout

**Status**: Normative. Foundational sections for contracts and styling. Layout member: US5.

## Component contracts (FR-029, FR-030)

A contract declares `id`, `version`, `parts`, `states` (subset of `default`, `hover`,
`focus-visible`, `pressed`, `disabled`, `selected`, `invalid`), `variants`, typed `properties`
(R4 types only), `defaults` as aliases to standard semantic tokens, contrast `pairs`, and
`interactiveParts`.

The standard catalog 1.0 lists fourteen contracts covering buttons; form controls; form
structure; cards; navigation; tables; and dialogs (research R17).

## Theme styling (FR-033, FR-034)

Themes style `components.<id>.parts.<part>.<property>` with a token value or
`{ "$states": { … } }`. Variants nest under `variants.<axis>.<value>`. Themes MUST NOT declare
new states, state conditions, or which variant applies. Styling carries no content, labels, or
bindings.

## Applicability (FR-032, FR-065)

Unknown contracts → `OT-CMP-001` (info). Incompatible versions → `OT-CMP-002` (info). Styling is
ignored; this is not partial application of an invalid theme. Unknown parts/properties of a known
contract → `OT-CMP-003` (error). Undeclared states/variants → `OT-CMP-004` (error).

## Resolved components (FR-032, FR-057; finding F23)

The resolved `components` member has an entry for every standard contract and every contract of
the supplied host declaration. Each entry has every part and every property of the contract, and
each property value is an object keyed by state:

- `default` is always present. Any other state of the contract is present when some layer
  declares a value for that property in that state.
- For each property and state, the value comes from the highest layer that declares it:
  1. the contract default (a plain default applies to `default`; `$states` gives per-state
     defaults);
  2. theme styling: the document's `components` member, then each matching context overlay in
     overlay order (chapter 06). A plain styled value applies to `default`; `$states` gives
     per-state values. Styling applies only to a contract the host knows in a compatible version;
     otherwise it is ignored (`OT-CMP-001`, `OT-CMP-002`);
  3. a policy lock on `components.<id>.parts.<part>.<property>`, which applies to every state
     present.
- Theme variant styling (`variants.<axis>.<value>.parts…`) is reported under the contract's
  `$variants` member as `$variants.<axis>.<value>.<part>.<property>.<state>`, using only the
  values the variant declares; a consumer falls back to the non-variant value for anything a
  variant does not declare.
- Every value is resolved like a token (chapter 10, Resolved values): an alias takes the
  referenced token's resolved value, a literal is encoded by the property's type, and a
  derivation is evaluated with the token graph. A property that no layer declares resolves from
  the contract default.
- Under forced colors, a color property resolves to the system role of the token that its
  contract default aliases, whatever the theme styles.

## Layout tokens

Layout tokens live under the `layout` token group.

## Layout selection (FR-035 to FR-039)

The top-level `layout` member selects host-declared variants:

```json
{ "layout": { "variants": { "navigation": { "compact": "bottom", "expanded": "side" } } } }
```

A region value is either a variant name or a map from size class (`compact` | `medium` |
`expanded`) to a variant name. A map without the active size class uses the first of `expanded`,
`medium`, `compact` that it has. When a host declaration is supplied, a region or variant it does
not declare is ignored with `OT-LAY-001`, and a declared region without a usable selection takes
the host's `default`. Undeclared regions or variants → `OT-LAY-001`. Members that change
content (`hidden`, `order`, `insert`) are forbidden → `OT-DOC-003`. At the narrowest size class,
minimum and fixed widths plus gutters MUST fit within 320 px, else `OT-LAY-002` (FR-039).
Resolved output exposes only the selected variant name per region under `layout.variants`.
