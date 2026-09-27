# Contract: Diagnostics

**Normative sources after implementation**: `specification/schemas/1.0/diagnostic.schema.json` and
`specification/registry/1.0/diagnostics.json` (the authoritative code list). Decisions:
[research.md](../research.md) R13. Fields: [data-model.md](../data-model.md) §16.

## Diagnostic object

```json
{
  "code": "OT-REF-003",
  "severity": "error",
  "location": { "document": "theme", "pointer": "/tokens/color/text/secondary/$value" },
  "rule": "R-REF-004",
  "message": "ref.cycle",
  "hint": "ref.cycle.hint",
  "params": { "cycle": ["color.text.secondary", "color.text.muted", "color.text.secondary"] },
  "related": [ { "document": "theme", "pointer": "/tokens/color/text/muted/$derive" } ]
}
```

- `message` and `hint` are template identifiers. The registry holds English templates, and tools
  may localize them. Rendered text interpolates `params` as literal text only.
- `params` values are limited to token paths, contract and point identifiers, diagnostic codes,
  numbers, type names, enumeration values, and version strings. Free text from a document is
  never included (FR-071).
- `location.pointer` is a JSON Pointer (RFC 6901) into the named document. `document` is `theme`,
  `base:<id>@<version>`, `host`, or `input`.

## Severity and validity

- Only `error` affects validity (FR-059, FR-060).
- Resolution includes the validation errors of any document it evaluated, e.g., the invalid
  selected theme that triggered a fallback. Its own findings (clamping, fallback, skipped
  preferences, raised target sizes, rejected values) are `warning` or `info`.
- Accessibility shortfalls of a valid theme are `warning` entries in the accessibility report
  (FR-064). Exceptions are the seed pair and the high-contrast mode, which are errors by
  clarification.

## Ordering, completeness, and cap

- Validation reports every detectable error in a single pass (FR-061).
- **Ordering**: document (theme, then bases from nearest to farthest, then host, then input), then
  pointer in canonical order, then code.
- **Cap**: 200 entries, followed by `OT-LIM-099` stating how many were omitted.
- Identical inputs produce identical diagnostic lists, including order (NFR-001, SC-004).

## Initial code catalog

The registry is authoritative. This catalog fixes the areas and the codes that fixtures and
examples rely on first. Codes are never reused or renumbered; retired codes stay reserved.

| Area | Codes (severity) |
|---|---|
| `DOC` document | 001 not I-JSON / malformed (E); 002 duplicate member (E); 003 unknown member outside `$extensions` (E); 004 wrong JSON type (E); 005 missing required member (E) |
| `META` metadata | 001 invalid identifier (E); 002 reserved identifier prefix (E); 003 invalid semantic version (E); 004 forbidden character in display text (E); 005 display text too long (E); 006 invalid language tag (E); 007 invalid SPDX expression (E); 008 not export-eligible: missing author, license, or integrity (E, export check only) |
| `VER` versioning | 001 unsupported major (E); 002 newer minor, required version stated (E, validity `unsupported`); 003 migrated from previous major (I); 004 lossy migration step (W); 005 deprecated element used, replacement named (W) |
| `TOK` tokens | 001 invalid path (E); 002 duplicate path (E); 003 reserved group redefined (E); 004 value outside type grammar (E); 005 value outside range (E); 006 type conflicts with base or registry (E); 007 neither or both of `$value` and `$derive` (E); 010 missing seed for a supported scheme (E); 011 translucent seed (E) |
| `REF` references | 001 missing target (E); 002 incompatible type (E); 003 cycle, with members in `related` (E); 004 reference chain too deep (E) |
| `DRV` derivations | 001 unknown transformation (E); 002 missing or unknown argument (E); 003 operand type (E); 004 operand outside domain (E); 005 composition too deep (E); 006 output type mismatch (E); 007 effort budget exceeded (E); 101 output clamped to token range (I); 102 user-dependent operand clamped into domain (I) |
| `CTX` contexts | 001 unknown dimension or value (E); 002 duplicate `when` (E); 003 scheme not supported (E); 004 overlay introduces an undeclared token (E); 101 requested color scheme unavailable, default used (I) |
| `CMP` components | 001 contract unknown to host, styling ignored (I); 002 incompatible contract version, styling ignored (I); 003 unknown part or property of a known contract (E); 004 undeclared state or variant of a known contract (E) |
| `LAY` layout | 001 unknown region or variant, ignored (I); 002 value prevents reflow at 320 px (E) |
| `CUS` customization | 001 default violates constraints (E); 002 constraint does not fit type (E); 003 target missing (E); 004 range not reachable in whole steps (E); 005 text-size range below 100% (E); 006 standard point target or type changed (E); 101 value clamped or snapped (I); 102 value fell back to default (I); 103 point not declared or not permitted, skipped (I); 104 point removed in this theme version, skipped (I) |
| `INH` inheritance | 001 base missing (E); 002 base invalid or unsupported (E); 003 base version outside range (E); 004 inheritance cycle (E); 005 chain too deep (E) |
| `LIM` limits | 001 document too large (E, before parsing); 002 nesting too deep (E); 003 too many tokens (E); 004 too many customization points (E); 005 too many overlays (E); 006 path too long (E); 099 diagnostics truncated (I) |
| `A11Y` accessibility | 001 seed pair below AA (E); 002 high-contrast mode below FR-027 (E); 003 declared pair below threshold (W); 004 distinguishable pair too similar (W); 005 focus indicator invisible (E); 006 target size raised to 24 px (W); 007 user value rejected by accessibility floor (W) |
| `SEC` security | 001 untrusted theme shares a trusted identifier, kept distinct (W); 002 same identifier and version with different integrity (W) |
| `HOST` host declarations | 001 reserved or colliding namespace (E); 002 invalid contract declaration (E); 003 default does not resolve (E); 004 duplicate contract identifier (E) |
| `RES` resolution | 001 fell back to previous theme (W); 002 fell back to developer default (W); 003 fell back to specification baseline (W); 004 selected theme not available under policy (W) |

E = error, W = warning, I = informational.

**Forbidden content** (FR-066, FB-009) has no dedicated codes. The format has no member or grammar
that can carry it, so it always surfaces as `DOC-003`, `DOC-004`, `TOK-004`, or `META-004` at its
exact location. The malicious fixture categories (code, styling text, selectors, network
addresses, conditions, data access, bidirectional controls in display text) each assert the code
and location they must produce. Markup in display text is valid by design (FR-011). Its fixture
asserts that the document is valid and that the text is carried through as literal plain text.
