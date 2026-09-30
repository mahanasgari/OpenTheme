# Feature Specification: OpenTheme Command-Line Tool for Theme Authors

**Feature Branch**: `004-theme-author-cli`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "OpenTheme command-line tool for theme authors (package @opentheme/cli,
command `opentheme`). Built only on @opentheme/core and @opentheme/web; it re-implements no theming
behavior. Commands: `validate` (validate one or more theme or host files, human-readable
diagnostics with file, JSON pointer, code, message, and hint; exit codes; `--json` machine output),
`resolve` (resolve a theme for a given context — color scheme, contrast, size class, text scale,
forced colors, reduced motion — and print the resolved tokens and components, or a subset by
path), `report` (the accessibility conformance report for every mode), `css` (write the CSS custom
properties from the Web adapter for a theme and context, optionally as a style element with a
scope), `preview` (write a self-contained HTML preview page of a theme in every mode), and `init`
(scaffold a new theme file from the minimal seed-only example with a fresh uid identifier). Trust
comes from the command line (files are untrusted unless the author passes --trusted for their own
bundled themes), never from theme content. No network access, no code execution from themes,
deterministic output, works offline, Node 24+."

## Overview

Theme authors today can only check their work by writing code against OpenTheme Core, or by
running the private reference checker, which is not meant for them. This feature gives authors one
command they can run in a terminal or a build pipeline to create a theme, check it, see what it
resolves to in every mode, check its accessibility, and get the CSS a web page would use. Every
answer comes from OpenTheme Core and the Web adapter, so the tool can never disagree with what an
application using OpenTheme will do (constitution V). The tool adds no theming behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check a theme and see exactly what is wrong (Priority: P1)

A theme author runs one command on their theme file and learns whether it is valid. When it is
not, each problem is shown with the file, the location inside the document, the diagnostic code, a
readable message, and a hint for fixing it. In a build pipeline, the command's result tells the
pipeline whether to fail.

**Why this priority**: Validation is the first thing every author needs, and the most common
reason to use the tool. Without it nothing else is trustworthy.

**Independent Test**: Run the command on a valid reference theme and on each invalid conformance
fixture theme; the result and the reported codes and locations match the specification's expected
results.

**Acceptance Scenarios**:

1. **Given** a valid theme file, **When** the author validates it, **Then** the tool reports it as
   valid and ends with a success status.
2. **Given** a theme with several errors, **When** the author validates it, **Then** every error is
   listed once, in the specification's diagnostic order, each with file, location, code, message,
   and hint, and the tool ends with a failure status.
3. **Given** several files, some valid and some not, **When** the author validates them together,
   **Then** each file's result is shown and the tool fails if any file is invalid.
4. **Given** the machine-readable output option, **When** the author validates, **Then** the output
   is one well-formed document per run containing each file's validity and diagnostics, with no
   other text mixed in.
5. **Given** a theme that extends a base theme, **When** the author supplies the base file too,
   **Then** the theme is validated with inheritance; without it, the missing base is reported.
6. **Given** a host declaration file, **When** the author validates it, **Then** it is validated as
   a host declaration, and it can also be supplied to validate a theme against that host.

---

### User Story 2 - See what a theme resolves to (Priority: P1)

An author resolves their theme for a chosen context, such as dark scheme, high contrast, a compact
size class, a larger text scale, forced colors, or reduced motion, and sees the final values, all of
them or only the paths they ask for.

**Why this priority**: Authors must see the effect of derivations, overlays, and accessibility
floors to design a theme; guessing is the main source of authoring mistakes.

**Independent Test**: Resolve each reference theme in each mode and compare the output with Core's
resolution of the same inputs; they are identical.

**Acceptance Scenarios**:

1. **Given** a valid theme and no context options, **When** the author resolves it, **Then** the
   result for the documented default context is printed.
2. **Given** context options, **When** the author resolves, **Then** the output reflects exactly
   that context and matches Core's result for the same inputs.
3. **Given** one or more paths, **When** the author resolves, **Then** only those tokens or component
   values are printed; an unknown path is reported as an error.
4. **Given** an invalid theme, **When** the author resolves it, **Then** the tool reports that it is
   invalid, shows its diagnostics, and does not print a fallback theme as if it were the author's.
5. **Given** user preference values (for example a text size or an accent), **When** the author
   resolves with them, **Then** the result shows their effect and any clamped or rejected values.

---

### User Story 3 - Check accessibility in every mode (Priority: P2)

An author runs the accessibility report and sees, for every mode the specification defines, which
declared pairs fall short and where the shortfall comes from.

**Why this priority**: A valid theme can still be non-conformant; authors need the report before
publishing, but they need validation first.

**Independent Test**: Run the report on the accessibility conformance fixtures; the findings match
the fixtures' expected results.

**Acceptance Scenarios**:

1. **Given** a theme that meets every threshold, **When** the author runs the report, **Then** the
   tool says the theme is conformant.
2. **Given** a theme with shortfalls, **When** the author runs the report, **Then** each shortfall is
   listed with the mode, the pair, the location, and the code.
3. **Given** an invalid theme, **When** the author runs the report, **Then** the tool reports the
   validation failure instead of a report, as the specification requires.

---

### User Story 4 - Get the CSS a web page will use (Priority: P2)

An author, or a build step, generates the CSS custom properties for a theme and context, either as
a stylesheet rule or as a complete style element for server rendering, for the document or a named
scope.

**Why this priority**: It connects authoring to the web without writing code, and it lets static
sites ship a theme's first paint. It depends on resolution (US2).

**Independent Test**: Generate CSS for each reference theme and compare it with the Web adapter's
output for the same resolution; the text is identical.

**Acceptance Scenarios**:

1. **Given** a theme and context, **When** the author generates CSS, **Then** the output equals the
   Web adapter's stylesheet for that resolution.
2. **Given** a scope name and the element option, **When** the author generates CSS, **Then** the
   output is the adapter's style element for that scope, with the nonce if one was given.
3. **Given** an output file option, **When** the author generates CSS, **Then** the file is written
   and nothing else is printed except the tool's own status line.

---

### User Story 5 - Preview a theme in every mode (Priority: P3)

An author writes a single preview page and opens it in any browser to see sample interface
elements in every supported mode side by side, with no network access and no build step.

**Why this priority**: Seeing a theme is faster than reading values, but it builds on resolution
and CSS (US2, US4).

**Independent Test**: Generate a preview for a reference theme; the page is one file, makes no
network requests, contains one section per mode, and each section's styles equal the CSS generated
for that mode.

**Acceptance Scenarios**:

1. **Given** a valid theme, **When** the author generates a preview, **Then** one self-contained page
   shows sample elements for each supported color scheme at standard and high contrast.
2. **Given** an invalid theme, **When** the author generates a preview, **Then** no page is written
   and the diagnostics are shown.

---

### User Story 6 - Start a new theme (Priority: P3)

An author starts a new theme with one command and gets a valid minimal theme file with a fresh
unique identifier, ready to edit.

**Why this priority**: It removes the first barrier for new authors, but authors can also copy an
example by hand.

**Independent Test**: Create a new theme and validate it; it is valid. Create two; their
identifiers differ.

**Acceptance Scenarios**:

1. **Given** a target path that does not exist, **When** the author creates a theme there, **Then**
   a valid minimal theme is written with a new `uid.` identifier and the given name, if any.
2. **Given** a target path that already exists, **When** the author creates a theme there, **Then**
   the tool refuses and changes nothing, unless the author explicitly asks to overwrite.

---

### User Story 7 - Trust is the author's decision, never the file's (Priority: P1)

Files are treated as untrusted unless the author explicitly states on the command line that a file
is their own trusted, bundled theme. Nothing inside a file can change how it is treated.

**Why this priority**: Constitution VI and the Foundation require trust to come from the host
boundary; a tool that inferred trust from content would teach authors the wrong model and could
hide gate failures.

**Independent Test**: Run every malicious conformance fixture through every command without the
trusted option; results match Core's untrusted handling, and nothing a file claims (provenance,
identifier, author) changes the outcome.

**Acceptance Scenarios**:

1. **Given** a file without the trusted option, **When** any command admits it, **Then** it is
   treated as untrusted from the source the author names (default: user-created).
2. **Given** an untrusted theme that fails the accessibility gate, **When** the author resolves it,
   **Then** the tool reports the gate failure; with the trusted option, the theme is admitted as
   trusted.
3. **Given** a file whose content claims to be official or trusted, **When** it is admitted without
   the trusted option, **Then** it is still untrusted.

### Edge Cases

- A file that is missing, unreadable, empty, not JSON, or larger than the specification's size
  limit: reported per file with the specification's code where one applies, never a crash.
- Duplicate member names, deep nesting, or other hostile input: handled exactly as Core does.
- A path option naming a token that does not exist, or an invalid context value (for example a
  negative text scale): a usage error with a clear message; nothing is resolved.
- Output that would overwrite an existing file: refused unless the author asks to overwrite.
- More diagnostics than the specification's cap: the capped list with `OT-LIM-099`, as Core returns.
- The terminal does not support color, or output is redirected: plain text without color codes.
- Very large valid themes: the tool still completes within the time budget below.

## Requirements *(mandatory)*

### Functional Requirements

**General**

- **FR-T001**: The tool MUST obtain every validation, resolution, diagnostic, report, and CSS result
  from OpenTheme Core or the Web adapter; it MUST NOT re-implement or alter theming behavior.
- **FR-T002**: The tool MUST produce byte-identical output for identical inputs and options, except
  for the new identifier created by `init`.
- **FR-T003**: The tool MUST work offline and MUST NOT access the network.
- **FR-T004**: The tool MUST NOT execute, evaluate, or load any code from theme, host, or preference
  files.
- **FR-T005**: The tool MUST use documented exit statuses: success; one or more documents invalid or
  a check failed; usage error; and input or output failure, each with a distinct value.
- **FR-T006**: Every command MUST offer machine-readable output that contains only one well-formed
  document per run; human-readable output MUST NOT contain color codes when the output is not a
  terminal or when the author disables color.
- **FR-T007**: Every command MUST print usage help, and the tool MUST print its own version and the
  Theme Specification version it implements.

**Trust and inputs**

- **FR-T010**: Theme files MUST be admitted as untrusted unless the author passes the trusted option
  for that input; untrusted admission MUST name a source, defaulting to user-created and
  selectable from the specification's closed set of sources.
- **FR-T011**: Nothing in a document (identifier, provenance, author, AI-generated flag) MAY change
  its trust.
- **FR-T012**: Authors MUST be able to supply base themes for inheritance and a host declaration,
  and each MUST follow the same trust rules; host declarations are trusted developer input.

**Validate**

- **FR-T020**: `validate` MUST accept one or more theme or host files, detect host declarations by
  their format member, and report each file's validity and diagnostics.
- **FR-T021**: Each diagnostic MUST be shown with file, document, JSON pointer, code, severity,
  message, and hint, using the English templates Core ships, in the specification's order.

**Resolve**

- **FR-T030**: `resolve` MUST accept every context dimension Core accepts (color scheme, contrast,
  forced colors, reduced motion, text scale, size class, locale, direction), with documented
  defaults, and MUST reject values outside Core's schema as usage errors.
- **FR-T031**: `resolve` MUST accept user preference values as a preferences document file or as
  individual point values, and an optional policy preset.
- **FR-T032**: `resolve` MUST print the full resolved theme or only the requested paths, and MUST
  show resolution diagnostics (fallbacks, clamps, rejected preferences).
- **FR-T033**: When the requested theme is invalid or falls back, the tool MUST say so and MUST NOT
  present the fallback result as the author's theme without that notice.

**Report**

- **FR-T040**: `report` MUST print the accessibility conformance report of a valid theme for every
  mode the specification defines, grouped by mode, and MUST fail when there are shortfalls if the
  author asks for strict mode.

**CSS**

- **FR-T050**: `css` MUST output the Web adapter's stylesheet or style element for the resolved
  theme, for the document or a named scope, with an optional nonce, to standard output or a file.

**Preview**

- **FR-T060**: `preview` MUST write one self-contained page with no external resources, containing
  one section per supported color scheme at standard and high contrast, each styled only by that
  mode's generated CSS, with sample standard components.

**Init**

- **FR-T070**: `init` MUST write a valid minimal theme with a fresh `uid.` identifier drawn from a
  cryptographically secure random source, the given name, and the current specification version,
  and MUST refuse to overwrite an existing file unless asked.

**Quality**

- **FR-T080**: The tool's README and agent guide MUST document every command, option, default, and
  exit status, and every example in them MUST run in continuous integration.
- **FR-T081**: Output-equivalence tests MUST show that `validate`, `resolve`, `report`, and `css`
  produce the same results as calling Core and the Web adapter directly, for every relevant
  conformance fixture.

### Key Entities

- **Input document**: a theme, base theme, host declaration, or preferences document read from a
  file, with the trust and source the author assigned on the command line.
- **Context**: the platform and environment values a resolution uses, from options with defaults.
- **Command result**: per input, validity and ordered diagnostics; for `resolve`, the resolved
  theme or selected paths; for `report`, findings by mode; for `css` and `preview`, the text
  written.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-T001**: For every validation, resolution, and accessibility conformance fixture, the tool's
  result is identical to the specification's expected result (100% agreement).
- **SC-T002**: A new author can create, validate, and resolve a theme using only the README in under
  5 minutes, without writing code.
- **SC-T003**: Validating a typical theme completes, including start-up, in under 1 second on the
  reference machine; the specification's largest allowed theme completes in under 3 seconds.
- **SC-T004**: Running any command twice on the same inputs produces identical output (except
  `init` identifiers).
- **SC-T005**: Every malicious conformance fixture is handled without a crash, a hang, or any
  network or code-execution attempt, under every command.
- **SC-T006**: The CSS and preview output for each reference theme equals the Web adapter's output
  for the same resolution, byte for byte.
- **SC-T007**: Every documented example runs successfully in continuous integration.

## Assumptions

- Authors run the tool with Node.js 24 or later; no other runtime is supported in this feature.
- The default context is light scheme, standard contrast, no forced colors, standard motion, text
  scale 1, medium size class, locale `en`, and left-to-right direction.
- The default policy for `resolve`, `css`, and `preview` makes the given theme available and uses
  it as the developer default, so the author sees their own theme unless it is invalid.
- The accessibility gate for untrusted themes follows Core's default; authors can relax it
  explicitly with an option, which the output always states.
- `init` uses the seed-only minimal example from the specification as its starting point.
- The tool is a separate, independently versioned package and adds no runtime dependency besides
  OpenTheme Core and the Web adapter.
- Out of scope: a theme editor, watch mode, editor integrations, publishing themes anywhere,
  converting from or to other token formats (a separate feature), and AI-assisted authoring.
