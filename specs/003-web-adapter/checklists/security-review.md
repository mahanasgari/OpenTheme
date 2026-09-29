# Security Review: OpenTheme Web Adapter

**Feature**: `003-web-adapter` | **Scope**: `packages/web/src/**` | **Date**: 2026-09-29 |
**Principles**: constitution VI and XII; FR-W023, FR-W040 to FR-W042

Each item records what was checked and the evidence. Every item passes.

## Names

- [x] Custom property names are built only from grammar-checked segments (`[a-z0-9][a-z0-9-]*`,
  host and contract namespaces as dot-separated segments, members as camelCase). Anything else is
  omitted and reported, never escaped or passed through (`src/naming.ts`; `test/unit/naming.test.ts`,
  `test/unit/omissions.test.ts`).
- [x] A final guard in `src/declarations.ts` drops any declaration whose name is not
  `--ot(c)-[a-z0-9_-]+`.

## Values

- [x] Values come only from typed serializers: integers 0–255, finite numbers in ECMAScript's
  shortest form, `px`/`ms` units, nine fixed system color keywords, three stroke keywords, generic
  families, and family names matching the Foundation's family-name grammar inside double quotes
  (`src/serialize.ts`; `test/unit/serialize.test.ts`).
- [x] Only border, shadow, and typography composites are split into members; any other object,
  string, or array shape (such as a host `gradient`, finding W2) is omitted whole.
- [x] A final guard drops any value outside `[A-Za-z0-9 ._,()/"\\+-]`, so `;`, `{`, `}`, `<`, and `>`
  can never be written.
- [x] Every malicious and invalid fixture, admitted as untrusted with every source enabled and
  applied with and without forced colors, writes only values that match the contract's value
  grammar (`test/malicious/output.test.ts`).

## CSS object model writes

- [x] Each scope owns one `<style>` element with exactly one rule; updates use only `setProperty`
  and `removeProperty` on that rule. No `innerHTML`, `insertAdjacentHTML`, `document.write`, or
  inline `style` attribute is used (enforced by `tools/spec-lint/src/web-boundaries.ts`).
- [x] Scope ids are validated (`[a-z][a-z0-9-]*`) before they are used in a selector or attribute;
  nonces are validated as base64 or base64url before they are written.

## Server-rendered element

- [x] `toStylesheet` emits the same validated names and values; the element text can never close
  the `<style>` element because values and names never contain `<` or `>`.
- [x] Adoption reads the existing rule only as the diff baseline; it never evaluates it, and a
  mismatched element is emptied and rebuilt.

## Storage and transmission

- [x] The browser store reads and writes only `<prefix><scope>` in the given storage and never
  interprets the bytes; Core parses and validates them.
- [x] No network API, cookie, or dynamic code in `packages/web/src/**` (boundary lint).
- [x] No theme-provided code is executed; theme content reaches the adapter only as Core's typed
  resolved values.
