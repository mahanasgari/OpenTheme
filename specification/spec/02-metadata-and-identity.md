# 02. Metadata and Identity

**Status**: Normative.

## Identifiers (research R5)

Theme and host identifiers use lowercase reverse-domain notation:

`^[a-z][a-z0-9-]{0,62}(\.[a-z0-9][a-z0-9-]{0,62}){1,7}$`, at most 128 characters.

Authors without a domain use `uid.` followed by 26 lowercase base32 characters from a random
128-bit value. Prefixes `org.opentheme.` and `uid.` are reserved, as is the namespace `std` for
contracts and customization points. Invalid identifiers produce `OT-META-001` or `OT-META-002`.

## Versions

- Theme `version` is a Semantic Version 2.0.0 string (FR-004, FR-005).
- `opentheme` is MAJOR.MINOR of the Theme Specification targeted. Unsupported major →
  `OT-VER-001`. Newer minor than the implementation → `OT-VER-002` with validity `unsupported`.

## Display text

`name` and `description` are plain text (FR-011). They MUST NOT contain C0 or C1 control
characters, bidirectional embedding/override/isolate controls (U+202A–U+202E, U+2066–U+2069), or
noncharacters. U+200E, U+200F, and U+061C are allowed. Markup is carried as literal text.

## Localization

`localized` maps BCP 47 tags to `{ name?, description? }` (at most 64 entries). Lookup uses
RFC 4647 "lookup": exact tag, then successively shorter tags, then the default `name` /
`description`.

## Attribution and provenance

- `author` is `{ name }` plain text with no URLs or email addresses.
- `license` is an SPDX license expression.
- `provenance.origin` is one of the closed origin values. Provenance is informational for
  trust decisions except where FR-010 requires untrusted treatment (FR-008, FR-010).
- `compatibility.catalog` is MAJOR.MINOR. `compatibility.extensions` maps namespaces to versions
  (FR-009).
