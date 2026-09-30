# Contract: `opentheme` Command Line

**Version**: `@opentheme/cli` 0.1.0 (pre-release) | **Spec**: [../spec.md](../spec.md) |
**Research**: [../research.md](../research.md)

```text
opentheme <command> [options] [files]

Commands:
  validate <file...>     Validate themes and host declarations
  resolve <theme>        Resolve a theme for a context
  report <theme>         Accessibility conformance report (chapter 11)
  css <theme>            CSS custom properties from the Web adapter
  preview <theme>        A self-contained HTML preview of every mode
  init <file>            Create a new minimal theme

Global options:
  --json                 One JSON document on standard output
  --no-color             No color, even on a terminal (NO_COLOR also disables it)
  -h, --help             Help for the command
  -v, --version          Tool version and Theme Specification version

Input options (validate, resolve, report, css, preview):
  --trusted              Admit the theme files as trusted (only for your own bundled themes)
  --source <source>      Source of untrusted files: user-created (default), imported, shared,
                         ai-generated
  --base <file>          A base theme for inheritance (repeatable; same trust options)
  --host <file>          A host declaration (trusted developer input)
  --relaxed-gate         Admit untrusted themes that miss the accessibility gate (stated in output)

Context options (resolve, css; preview varies scheme and contrast itself):
  --scheme light|dark|no-preference   --contrast standard|high
  --forced-colors  --reduced-motion   --text-scale <n>   --size compact|medium|expanded
  --locale <tag>   --dir ltr|rtl

Resolve options:
  --path <path>          Print only this token path or component path (repeatable)
  --preset closed|common-personalization
  --preferences <file>   A User Preferences document
  --set <point>=<json>   A preference value (repeatable; requires a preset that permits it)

Report options:  --strict            Exit 1 when the report has findings
CSS options:     --scope <id>  --element  --nonce <nonce>  --out <file>
Preview options: --out <file> (default: <theme>.preview.html)
Init options:    --name <name>  --force
```

## Exit statuses

| Status | Meaning |
|---|---|
| 0 | Success |
| 1 | An input is invalid or refused, a resolution fell back, or `report --strict` found shortfalls |
| 2 | Usage error: unknown command or option, invalid value, unknown `--path` |
| 3 | Input or output failure: missing or unreadable file, write failure, existing `init` target |

## Human output

`validate` prints one block per file:

```text
themes/quiet.opentheme.json: invalid (2 errors)
  error OT-TOK-004 /tokens/color/x/$value
        The value does not match the token type: …
        hint: …
```

and a final summary line. Colors are used only on a terminal. Paths are shown as given.

## JSON output

One document per run, keys sorted, trailing newline:

```json
{ "command": "validate", "results": [ { "path": "…", "kind": "theme", "validity": "invalid",
  "diagnostics": [ { "code": "…", "severity": "error", "location": { "document": "theme",
  "pointer": "…" }, "message": "…", "hint": "…", "params": {} } ] } ], "status": 1 }
```

`resolve --json` returns `{ command, path, outcome, applied, resolved | values, diagnostics,
status }`; `report --json` returns `{ command, path, validity, diagnostics, status }`; `css` and
`preview` return `{ command, path, output | text, status }`; `init` returns `{ command, path, id,
status }`.

## Guarantees

- Results come only from `@opentheme/core` and `@opentheme/web` (FR-T001).
- Identical inputs and options give identical bytes, except the `init` identifier (FR-T002).
- No network access, no child processes, no evaluation of file content (FR-T003, FR-T004).
- Trust comes only from `--trusted` (FR-T010, FR-T011).
