# 15. Extensions and Provenance

**Status**: Normative. Research R3, R19. Canonical form details also in chapter 01.

## Opaque extensions (FR-089, FR-098)

`$extensions` is a map from a reverse-domain vendor key to any JSON value. It MAY appear on the
document, groups, tokens, and contracts. Implementations MUST:

- preserve `$extensions` values through validate, flatten, canonicalize, and export;
- not interpret `$extensions` when applying standard fields;
- never allow `$extensions` to bypass validation or change the meaning of core members.

Opaque extensions keep digital signatures and tooling metadata possible without forking the
document format (FR-098).

## Provenance (FR-008, FR-010)

Every theme MUST declare `provenance.origin` from the closed vocabulary in the metadata schema
(`user-created`, `developer-authored`, `ai-generated`, `ai-assisted`, `imported`, `prebuilt`,
`specification-baseline`). Origin does not grant trust: trust is supplied by the host for each
available theme entry (FR-010).

## Flattening for interchange (FR-049)

Themes that are exported, shared, or published MUST be self-contained:

1. Resolve the `extends` chain (at most depth 4, acyclic).
2. Merge base-first into one document (child identity wins).
3. Drop `extends`.
4. Append each base `{ id, version }` to `provenance.lineage` in oldest-first order.

Flattening does not change semantic token values relative to resolving the chain in place.

## Export eligibility (FR-007, FR-095)

A theme is export-eligible only when `author`, `license`, and `integrity` are all present.
Otherwise the export check fails with `OT-META-008` naming the missing fields; the theme remains
valid for local use. Exported documents MUST NOT contain user preferences or other host runtime
state (`preferences` as a document member is `OT-DOC-003`).

## User and shared themes (FR-097)

User-created, designer-created, marketplace, shared, and AI-generated themes use the same document
schema and validation rules. Trust is never claimed inside the document: an untrusted child of an
untrusted base remains untrusted for the host's theme set.
