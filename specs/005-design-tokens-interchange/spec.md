# Feature Specification: Design Tokens Interchange

**Feature Branch**: `005-design-tokens-interchange`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Implement chapter 16 (FR-096): export an OpenTheme theme to W3C Design
Tokens Format Module 2025.10 documents, one per mode with computed values and the derivation
source kept under `$extensions["org.opentheme"]`, and import DTCG documents into a valid OpenTheme
theme, rejecting or setting aside what OpenTheme cannot represent. Available as a library and as
`opentheme export` and `opentheme import` commands, with every result checked by OpenTheme Core."

## Overview

Designers keep tokens in design tools that read and write the W3C Design Tokens format (DTCG).
Chapter 16 of the Theme Specification defines how OpenTheme maps to that format, but nothing
implements it. This feature lets a designer take an OpenTheme theme into their design tool, and
bring a design tool's tokens into OpenTheme as a valid theme, with every loss reported. Values
always come from OpenTheme Core, and every imported theme is validated by Core before it is
written.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export a theme for a design tool (Priority: P1)

A designer exports an OpenTheme theme and gets one DTCG document per mode (for example light and
dark) that their design tool can read, with the final value of every token in that mode.

**Why this priority**: Export is fully defined by chapter 16 and is the most common need: design
tools consume tokens produced by a system.

**Independent Test**: Export each reference theme; every document is valid DTCG 2025.10, and every
token's value equals Core's resolved value for that mode.

**Acceptance Scenarios**:

1. **Given** a valid theme that supports light and dark, **When** the designer exports it, **Then**
   one document per supported scheme is produced (and per contrast when asked), each with the
   computed values of that mode.
2. **Given** a token defined by a derivation, **When** it is exported, **Then** its value is the
   computed one and the theme's derivation is kept under `$extensions["org.opentheme"].derive`.
3. **Given** a value OpenTheme can express but DTCG cannot (for example a density), **When** it is
   exported, **Then** it is left out and listed in the export report.
4. **Given** an invalid theme, **When** the designer exports it, **Then** nothing is written and the
   theme's diagnostics are shown.

---

### User Story 2 - Import tokens from a design tool (Priority: P1)

A designer imports a DTCG document and gets a valid OpenTheme theme. Tokens become theme primitives;
an optional mapping names which imported tokens play which semantic roles and seeds. Anything
OpenTheme cannot represent is reported, never silently changed.

**Why this priority**: Without import, OpenTheme cannot take in existing design systems, which is
the main adoption barrier.

**Independent Test**: Import the documents produced by US1 for each reference theme with a mapping;
the resulting theme is valid, and resolving it gives the same values as the original for every
mapped role.

**Acceptance Scenarios**:

1. **Given** a DTCG document with supported types, **When** the designer imports it, **Then** a valid
   theme is written with the tokens under the primitive group, aliases preserved.
2. **Given** a mapping of semantic roles and seeds to imported tokens, **When** the designer
   imports, **Then** the theme's seeds and semantic tokens refer to those tokens.
3. **Given** unsupported types, units, or color spaces (for example `rem`, `display-p3`, gradients),
   **When** the designer imports, **Then** each is listed with the reason and left out; nothing is
   approximated.
4. **Given** token names outside OpenTheme's path grammar, **When** the designer imports, **Then**
   they are converted by a documented rule, and names that would collide are reported and left
   out.
5. **Given** a DTCG document produced by US1, **When** it is imported with derivation restoring
   turned on, **Then** kept derivations are restored as derivations where every token they refer to
   was imported; by default the computed values are kept, so the round trip is exact.

---

### User Story 3 - Use it from the command line and from code (Priority: P2)

A developer calls export and import from code, or runs `opentheme export` and `opentheme import`, with
the same trust, context, JSON output, and exit status conventions as the other commands.

**Why this priority**: The commands are how designers and build pipelines will use the feature; the
library is how other tools will.

**Independent Test**: The commands produce the same documents as the library, and the documented
examples run in continuous integration.

**Acceptance Scenarios**:

1. **Given** a theme, **When** the author runs the export command, **Then** one file per mode is
   written, named by mode, and a report lists anything left out.
2. **Given** a DTCG file and an optional mapping, **When** the author runs the import command,
   **Then** a theme file is written only if Core validates it, and the report lists every loss.

### Edge Cases

- A DTCG document that is not JSON, not an object, or larger than the Theme Specification's size
  limit: reported, nothing written.
- Circular or dangling DTCG aliases: the affected tokens are reported and left out.
- An alias to a token that was left out: the aliasing token is left out too, and reported.
- A mapping that names a token that does not exist, or has the wrong type for its role: reported;
  the theme is not written.
- Import with no mapping: the theme uses the specification's default seeds, and the report says so.
- Group `$type` inheritance and `$description` in DTCG: honored; `$deprecated` is kept.
- Forced colors: not exported, because system colors have no DTCG form.

## Requirements *(mandatory)*

### Functional Requirements

**Export**

- **FR-D001**: Export MUST produce one DTCG 2025.10 document per requested mode (supported color
  scheme × contrast; default: each supported scheme at standard contrast), with every token of the
  theme's resolved output for that mode, nested by path segments.
- **FR-D002**: Every exported value MUST equal Core's resolved value for that mode, encoded in the
  DTCG form of its type.
- **FR-D003**: For a token whose theme declaration is a derivation, export MUST keep that
  derivation, as written in the theme, under `$extensions["org.opentheme"].derive` (finding D1).
- **FR-D004**: Every exported token MUST carry `$type`, taken from the theme's declaration or the
  semantic baseline registry.
- **FR-D005**: A value with no DTCG form (density, system colors) MUST be left out and listed in
  the export report.

**Import**

- **FR-D010**: Import MUST accept DTCG 2025.10 documents with group `$type` inheritance and curly
  brace aliases, and MUST produce an OpenTheme theme that Core validates; it MUST NOT write a theme
  Core rejects.
- **FR-D011**: Imported tokens MUST be placed under the reserved `primitive` group, keeping their
  group structure; aliases MUST be rewritten to the new paths.
- **FR-D012**: DTCG types, units, and color spaces with no exact OpenTheme equivalent (for example
  `rem`, colors outside `srgb` and `oklch`, `gradient`, `transition`, shadow lists, object stroke
  styles) MUST be left out and reported, never approximated. Exact conversions (seconds to
  milliseconds, font weight keywords to their numeric values) MAY be applied and MUST be reported.
- **FR-D013**: Token names outside the path grammar MUST be converted by the documented rule
  (lowercase; characters outside `[a-z0-9-]` become `-`; repeated and edge `-` removed); names that
  would collide or become empty MUST be reported and left out (finding D3).
- **FR-D014**: An optional mapping MUST let the user assign imported tokens to seeds and to
  semantic baseline roles; without one, the specification's default seeds are used and the report
  says so (finding D2).
- **FR-D015**: When the user asks for it, a kept `$extensions["org.opentheme"].derive` MUST be
  restored as a derivation if every token it refers to exists in the imported theme; otherwise, and
  by default, the computed value is kept, and the report lists each restored or kept derivation.
  (Restoring recomputes from quantized inputs, so values may differ by one quantization step.)
- **FR-D016**: Import MUST treat the document as untrusted content: no code execution, no network,
  bounded size, and it never assigns trust (the resulting theme's trust is decided when it is
  admitted).

**Common**

- **FR-D020**: Export and import MUST be available as a library with no dependency besides OpenTheme
  Core, and as `opentheme export` and `opentheme import` commands following the command-line tool's
  conventions (trust options, `--json`, exit statuses, refusing to overwrite).
- **FR-D021**: Every report entry MUST name the token path, what happened (left out, converted,
  restored, renamed), and why.
- **FR-D022**: Output MUST be deterministic: identical inputs give identical bytes.
- **FR-D023**: Findings D1 to D3 MUST be recorded against chapter 16 without changing Foundation
  behavior.

### Key Entities

- **DTCG document**: a tree of groups and tokens with `$type`, `$value`, `$description`,
  `$deprecated`, and `$extensions`.
- **Mapping**: user-provided assignments of seeds (`seed.<scheme>.<role>`, `seed.font-family`) and
  semantic roles (baseline paths) to imported token paths.
- **Interchange report**: the list of tokens left out, converted, renamed, or restored, each with a
  reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-D001**: For both reference themes in every exported mode, 100% of exported values equal
  Core's resolved values.
- **SC-D002**: Exporting then importing each reference theme with a role mapping gives a valid theme
  whose resolved values equal the original's for every mapped role in every exported mode.
- **SC-D003**: Every unsupported construct in a test corpus covering every DTCG 2025.10 type is
  reported; none is written in an approximated form.
- **SC-D004**: Every hostile input (malformed JSON, oversized documents, alias cycles, deep
  nesting) is handled without a crash or a hang.
- **SC-D005**: Export and import of a typical theme each complete in under 1 second.
- **SC-D006**: Every documented example runs successfully in continuous integration.

## Assumptions

- The DTCG version is the Format Module 2025.10; the Resolver Module (for modes) is out of scope, as
  chapter 16 marks it non-normative.
- Exported colors are Core's quantized sRGB values written as DTCG `srgb` colors with components
  in `[0, 1]`; the exact 8-bit values survive a round trip.
- Host tokens, component styling, customization points, context overlays, layout, and inheritance
  are not exported, as chapter 16 lists them as not mapping.
- An imported theme is a new theme: it gets a fresh `uid.` identifier and `provenance.origin`
  `imported` unless the user supplies an id and name.
- The feature lives in a new library package and two new commands in the existing command-line
  tool.
