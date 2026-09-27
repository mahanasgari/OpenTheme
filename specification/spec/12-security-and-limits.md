# 12. Security and Limits

**Status**: Normative. Research R14, R15. Inheritance/trust narrative completed in US2.

## Limits

Fixed limits are those in `limits.json` (document bytes, tokens, depths, overlays, effort units,
diagnostics cap, and related structural limits). Exceeding a limit fails closed with the matching
`OT-LIM-*` code. Effort is bounded for any input (FR-063, NFR-002).

| Limit | Value | Code |
| --- | ---: | --- |
| Document bytes | 1 048 576 | `OT-LIM-001` |
| Nesting depth | 16 | `OT-LIM-002` |
| Tokens | 10 000 | `OT-LIM-003` |
| Customization points | 200 | `OT-LIM-004` |
| Overlays | 64 | `OT-LIM-005` |
| Path / segment length | 256 / 64 | `OT-LIM-006` |
| Diagnostics emitted | 200 (+ `OT-LIM-099`) | `OT-LIM-099` |

Reference chains deeper than 16 yield `OT-REF-004`. Derivation composition deeper than 8 yields
`OT-DRV-005`. Effort over 200 000 units per mode yields `OT-DRV-007`.

## Parsing

Size is checked before parsing. The tokenizer is I-JSON-strict. Invalid documents are never
partially applied (FR-065).

## Forbidden content (FR-066, FB-009)

Themes MUST be declarative data only. There is no member that accepts code, styling-language text,
selectors, element or class names, URLs or other network addresses, conditions outside the five
context dimensions, or data access. Violations surface through existing structure codes:

| Attempt | Typical code |
| --- | --- |
| Unknown members (`script`, `selector`, data-access) | `OT-DOC-003` |
| Values outside type / family-name grammar (`javascript:…`, CSS text, URL fonts) | `OT-TOK-004` |
| `when` outside the five dimensions | `OT-CTX-001` |
| Bidirectional overrides / C0 controls in display text | `OT-META-004` |
| Display text over length | `OT-META-005` |

Display text is never interpreted as markup or code (FR-011): angle brackets are carried as
literal characters.

## External resources (FR-067)

Themes MUST NOT reference external assets in 1.x. Fonts are family names only.

## Trust and identity (FR-010, FR-068, FB-010)

Theme identity is the `(id, version)` pair. Trust is assigned by the host to each document entry
of the resolution input (`themes[].trust`), never keyed by identifier and never read from the
document. An untrusted document MUST NOT replace, shadow, or deny a trusted document with the
same id, whatever the order of entries in the input. Collisions are reported as `OT-SEC-001` and
the trusted entry is kept.
When two entries share the same `(id, version)` but differ in integrity (canonical content), the
implementation MUST emit `OT-SEC-002`, keep both entries distinct, and not silently overwrite one
with the other. Inheritance trust is the minimum along the extends chain (FR-048).

## No partial application (FR-065)

If validation fails, resolution falls back as a whole. No subset of an invalid theme's tokens,
overlays, or components is applied to the active appearance.
