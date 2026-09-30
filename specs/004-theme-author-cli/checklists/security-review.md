# Security Review: OpenTheme Command-Line Tool

**Feature**: `004-theme-author-cli` | **Scope**: `packages/cli/src/**` | **Date**: 2026-09-30 |
**Principles**: constitution VI and XII; FR-T003, FR-T004, FR-T010, FR-T011

- [x] **Trust** comes only from `--trusted`; untrusted admission always names a source, and nothing
  in a document changes trust (`test/trust/malicious.test.ts`, "claims inside a document").
- [x] **No code execution or network**: the boundary lint allows only Core, the Web adapter, the
  interchange library, and a fixed set of Node built-ins; the binary test records every import at
  run time and finds no network, process, `vm`, or worker module (`test/binary.test.ts`).
- [x] **Hostile documents**: every malicious and invalid fixture runs through every command without
  a crash; oversized, non-JSON, and unreadable files are reported (`validate.test.ts`).
- [x] **Terminal injection** (found in this review): member names, pointers, token names, file names,
  and report reasons from files could carry escape sequences, newlines, or bidirectional overrides
  into human output. All such text now passes through `clean()`, which shows C0 and C1 controls,
  DEL, and bidi overrides escaped (`test/commands/terminal.test.ts`). JSON output escapes them
  through `JSON.stringify`, and C1 and bidi characters stay inside JSON strings.
- [x] **Files**: outputs go only to paths the user gives; existing files are never overwritten
  without `--force`; `init` validates the new theme before writing it.
- [x] **Preview page**: CSS comes from the Web adapter's validated serializers; the theme name and
  identity are HTML-escaped; the page has no script and loads nothing.
- [x] **Randomness**: `init` identifiers use `crypto.randomBytes` (128 bits).
