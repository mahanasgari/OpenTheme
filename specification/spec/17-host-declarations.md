# 17. Host Declarations

**Status**: Normative (US5).

## Purpose (FR-031, FR-089)

A host declaration (`.opentheme-host.json`) states what an application consumes and what it
adds: extension contracts, extension tokens, and layout variants. It is trusted developer input
and carries no presentation values beyond defaults that alias or derive from standard tokens.

## Namespace (FR-031)

`id` is a reverse-domain host namespace. It MUST NOT be, or start with, a reserved namespace
(`std`, `org.opentheme`, `uid`). Violations → `OT-HOST-001`.

## Contracts and tokens (FR-032, FR-086)

Contract ids are `<host-id>/<name>`, where `<host-id>` is the declaration's `id`. The contract
name, every part, every property name, and every variant axis and value match `[a-z][a-z0-9-]*`,
the standard catalog's grammar. Theme styling applies only when the pin is compatible
(same major; theme minor ≤ declared). Unknown contracts → `OT-CMP-001` (info). Incompatible
versions → `OT-CMP-002` (info). Every property MUST have a default (`OT-HOST-003`). Duplicate
contract ids → `OT-HOST-004`. Invalid states, property types other than the chapter 03 types, a
contract id outside the host namespace, or a name outside the grammar above → `OT-HOST-002`.

Host tokens are resolved at qualified paths `<host-id>/<local-path>` (for example
`com.example.notes/color.rail`).

## Consumes (FR-087, SC-002)

`consumes` is informational for coverage reports. A host MAY use tokens it does not list. Cross-
application portability requires every reference theme × reference host pair to cover the host's
`consumes` list without theme edits.

## Layout variants (FR-037)

`layoutVariants` maps a region to `{ variants, default }`. Themes may only select among declared
variants; the host owns order and accessibility of each variant.

## Validation order

A host declaration is checked against `host-declaration.schema.json` (failures mapped as in
chapter 13) and against the rules above. A finding from a rule above supersedes any schema
failure at or below its location, so each problem is reported once, with the specific code.
