# 01. Document Format

**Status**: Normative. Encoding, parsing, canonical form, and integrity (see also chapter 15).

## Encoding

- Theme documents are I-JSON (RFC 7493): UTF-8 without a BOM, no lone surrogates, numbers that
  are IEEE 754 binary64-representable, and no duplicate member names.
- Documents use the suffix `.opentheme.json`. Host declarations use `.opentheme-host.json`.
- The intended media type is `application/vnd.opentheme.theme+json` (theme) and
  `application/vnd.opentheme.host+json` (host).

## Size and nesting

- Implementations MUST reject a document whose byte length exceeds 1,048,576 **before** parsing
  (`OT-LIM-001`).
- Structural nesting depth MUST NOT exceed 16 (`OT-LIM-002`).
- A theme is one self-describing document (FR-001).

## Members

- Top-level member order is irrelevant. Array order is significant for overlays, customization
  points, font fallbacks, and lineage.
- Member names have no special meaning beyond this specification and `$extensions` namespaces.
- Unknown members outside `$extensions` are errors (`OT-DOC-003`).

## Parsing failures

Malformed I-JSON, wrong JSON types for required members, and missing required members produce
`OT-DOC-001`, `OT-DOC-004`, or `OT-DOC-005` respectively. Duplicate members produce `OT-DOC-002`.

## Canonical form (FR-069)

A theme's **canonical form** is produced as follows:

1. Parse as I-JSON.
2. Apply the closed **normalization** list (research R3):
   - remove every color `alpha` member whose value is exactly `1`;
   - when a color has `hex` and no `components`, convert `hex` to sRGB `components` (and set
     `colorSpace` to `srgb` if absent), then drop `hex`;
   - when a color has both `hex` and `components`, drop `hex`;
   - remove the top-level `integrity` member (it is never hashed into itself);
   - leave `$extensions` values untouched (no semantic rewrite).
3. Serialize with the JSON Canonicalization Scheme (JCS, RFC 8785).

Member order in the source document and insignificant whitespace MUST NOT change the canonical
bytes. Array order remains significant.

## Integrity (FR-094)

The integrity value is SHA-256 over the canonical UTF-8 bytes, written in Subresource Integrity
form: `sha256-` followed by standard base64 (pattern `^sha256-[A-Za-z0-9+/]{43}=$`). Export and
re-import MUST preserve identical canonical bytes and integrity (SC-011). Digital signatures MAY
cover the canonical bytes; `$extensions` MUST remain opaque so signatures stay possible (FR-098).
