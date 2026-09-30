# Data Model: OpenTheme Command-Line Tool for Theme Authors

**Feature**: `004-theme-author-cli` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

The tool adds no theme data. Its inputs are files and options; its outputs are Core's and the Web
adapter's results, formatted.

## 1. Input Document

| Field | Type | Rule |
|---|---|---|
| `path` | string | As given on the command line; shown in every result |
| `kind` | `theme` \| `host` \| `base` \| `preferences` | `host` when the JSON has `openthemeHost`; `base` for `--base`; `preferences` for `--preferences` |
| `trust` | `trusted` \| `untrusted` | `trusted` only with `--trusted`; hosts are always trusted developer input |
| `source` | `user-created` \| `imported` \| `shared` \| `ai-generated` | `--source`, default `user-created`; used only when untrusted |
| `bytes` | bytes | Read as is; never interpreted by the tool before Core parses it |

## 2. Context

| Option | Core field | Default |
|---|---|---|
| `--scheme` | `platform.colorScheme` | `light` |
| `--contrast` | `platform.contrast` | `standard` |
| `--forced-colors` | `platform.forcedColors` | `false` |
| `--reduced-motion` | `platform.reducedMotion` | `false` |
| `--text-scale` | `platform.textScale` | `1` |
| `--size` | `environment.sizeClass` | `medium` |
| `--locale` | `environment.locale` | `en` |
| `--dir` | `environment.direction` | `ltr` |

Values outside Core's schema are usage errors (exit status 2).

## 3. Result

| Command | Per input | Aggregate |
|---|---|---|
| `validate` | `{ path, kind, validity: "valid" \| "invalid" \| "refused", diagnostics, error? }` | exit 1 if any input is not valid |
| `resolve` | `{ path, applied, outcome, resolved \| selected paths, diagnostics }` | exit 1 on fallback |
| `report` | `{ path, validity, diagnostics }` (the chapter 11 report) | exit 1 with `--strict` and any finding |
| `css` | stylesheet text | exit 1 on fallback |
| `preview` | page text | exit 1 if the theme is invalid |
| `init` | `{ path, id }` | exit 3 if the target exists without `--force` |

## 4. Diagnostic (display)

Core's diagnostic plus `file` and the English `message` and `hint` from Core's templates. Order is
Core's order; the tool never sorts or filters diagnostics.
