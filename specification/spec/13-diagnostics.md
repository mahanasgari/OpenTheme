# 13. Diagnostics

**Status**: Normative. Research R13. Registry: `diagnostics.json`. Schema: `diagnostic.schema.json`.

## Object shape

Each diagnostic has `code`, `severity`, `location` (`document` + JSON Pointer), `rule`,
`message` and `hint` template ids, `params`, and optional `related` locations.

## Severity

Only `error` affects validity. Resolution findings (clamp, fallback, skip) are `warning` or
`info`.

## Ordering and cap

Order: document (theme, bases nearest→farthest, host, input, preferences), then pointer canonical
order, then code. At most 200 entries, then `OT-LIM-099` with the omitted count.

**Pointer canonical order** compares two JSON Pointer strings, and then two codes, as sequences of
UTF-16 code units, the order JCS uses for member names (RFC 8785, section 3.2.3). It never depends
on a locale or collation.

Identical inputs produce identical diagnostic lists (NFR-001).

## Retired codes

A registry entry with `retired` is never reported. `OT-TOK-002` (duplicate path) is retired: a
duplicate member fails parsing as `OT-DOC-002`, and a nested token tree cannot express one path
twice.

## Whole-document locations

A diagnostic about a document as a whole (for example a size limit, nesting limit, malformed
input, or export eligibility) uses the pointer `/`. `OT-LIM-099` uses the pointer `""`. These
conventions are fixed by the published fixtures.

## Validation procedure (FR-059, FR-061)

Theme validation runs these steps in order and reports every finding it reaches in one pass:

1. Size: more than 1,048,576 bytes is `OT-LIM-001` at `/`; validation stops.
2. Parse (I-JSON, chapter 01): the parse failure's code at the offending member, or `/`;
   validation stops. A top-level value that is not an object is `OT-DOC-001` at `/`.
3. Schema (`theme.schema.json`), with failures mapped as below. Failures located under `/tokens`
   are not reported here (token grammar is reported by step 7), nor is a `maxItems` failure on
   `/contexts` (reported as `OT-LIM-005` by step 13).
4. Version and metadata (chapter 02). If the targeted version is unsupported, validation stops
   after this step.
5. Inheritance (chapter 10); on failure, validation stops. Later steps see the merged document.
6. Seeds (chapter 07); 7. tokens and references (chapter 03); 8. derivations (chapter 04);
   9. contexts (chapter 06); 10. components (chapter 08); 11. customization (chapter 09);
   12. accessibility (chapter 11); 13. limits (chapter 12); 14. layout (chapter 08).
   Step 12 evaluates the theme in the high-contrast mode of each supported color scheme, so it
   runs only when no earlier step reported an error.

**Schema failure mapping.** A JSON Schema failure is located at its instance pointer (or `/` for
the document), except that `additionalProperties` and `required` failures are located at the
offending or missing member. Failures inside a `oneOf` or `anyOf` branch are not reported; the
combinator failure itself is. The code is the `x-opentheme-code` annotation of the failing
schema node when present; otherwise:

| Keyword | Code |
|---|---|
| `additionalProperties` | `OT-DOC-003` |
| `required` | `OT-DOC-005` (always, whatever the annotation) |
| `oneOf`, `anyOf` | `OT-TOK-004` when the pointer contains `/$value`, else `OT-DOC-004` |
| any other keyword | `OT-DOC-004` |

Two failures with the same code and location are reported once.
