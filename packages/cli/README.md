# @opentheme/cli

The `opentheme` command for theme authors: create a theme, check it, see what it resolves to in
every mode, check its accessibility, and get the CSS a web page will use, without writing code.

Every answer comes from [`@opentheme/core`](../core/README.md) and
[`@opentheme/web`](../web/README.md), so the tool always agrees with applications that use
OpenTheme. It works offline, never runs anything from a theme file, and prints the same bytes for
the same inputs.

Status: `0.1.0-draft.0`, pre-release, tracking Theme Specification `1.0.0-draft.5`. Requires
Node.js 24 or later.

## Quickstart

```bash
opentheme init my-theme.opentheme.json --name "Quiet Paper"
opentheme validate my-theme.opentheme.json
opentheme resolve my-theme.opentheme.json --scheme light --path color.text.primary
opentheme report my-theme.opentheme.json
opentheme css my-theme.opentheme.json --out my-theme.css
opentheme preview my-theme.opentheme.json --out my-theme.html
```

Open `my-theme.html` in any browser to see your theme in every supported mode.

## Commands

| Command | What it does |
|---|---|
| `validate <file...>` | Validates themes and host declarations; each problem with file, JSON pointer, code, message, and hint |
| `resolve <theme>` | Resolves a theme for a context and prints its tokens and components, or only the `--path`s you ask for |
| `report <theme>` | The accessibility conformance report: every declared pair below its threshold in any mode |
| `css <theme>` | The Web adapter's CSS custom properties, as a rule or a complete `<style>` element |
| `preview <theme>` | One self-contained HTML page with sample components in every supported mode |
| `init <file>` | A new valid minimal theme with a fresh `uid.` identifier |
| `export <theme>` | W3C Design Tokens (2025.10) files, one per mode, with computed values |
| `import <tokens.json>` | A valid theme from a W3C Design Tokens file; losses are reported |

Run `opentheme <command> --help` for every option.

## Trust

Files are **untrusted** unless you pass `--trusted`, and nothing inside a file can change that. Use
`--trusted` only for themes you ship yourself. Untrusted themes come from a source,
`--source user-created` (the default), `imported`, `shared`, or `ai-generated`, and must pass the
accessibility gate to be used; `--relaxed-gate` admits them anyway and says so on every run.

```bash
opentheme validate my-theme.opentheme.json --source imported
opentheme resolve my-theme.opentheme.json --trusted --scheme dark --contrast high --path color.text.primary
```

## Context

`resolve` and `css` take the context an application would pass. The defaults are shown:

| Option | Default |
|---|---|
| `--scheme light\|dark\|no-preference` | `light` |
| `--contrast standard\|high` | `standard` |
| `--forced-colors`, `--reduced-motion` | off |
| `--text-scale <n>` | `1` |
| `--size compact\|medium\|expanded` | `medium` |
| `--locale <tag>` | `en` |
| `--dir ltr\|rtl` | `ltr` |

User preferences need a policy that permits them:

```bash
opentheme resolve my-theme.opentheme.json --preset common-personalization --set 'std.color-scheme="dark"' --set std.text-size=1.25 --path text.body
```

Paths are token paths (`color.text.primary`) or component paths
(`std/button.container.background.default`).

## Inheritance and hosts

Pass base themes with `--base` (in any order) and a host declaration with `--host`:

```bash
opentheme init base.opentheme.json --name "Base"
opentheme validate base.opentheme.json my-theme.opentheme.json
```

## CSS for the web

```bash
opentheme css my-theme.opentheme.json --scheme dark --element --scope app --nonce r4nd0m --out dark.html
```

`--element` writes the `<style data-opentheme-scope>` element for server rendering; the Web adapter
adopts it on the client without rewriting anything.

## Design tools

Export a theme as W3C Design Tokens files, one per mode, and bring tokens back as a theme:

```bash
opentheme export my-theme.opentheme.json --mode light --out-dir .
opentheme import my-theme.light.tokens.json --out from-tokens.opentheme.json --name "From Tokens"
opentheme validate from-tokens.opentheme.json
```

Anything one format cannot represent is left out and listed in the report. A mapping file
(`--mapping`) assigns seeds and semantic roles to imported tokens; see
[`@opentheme/dtcg`](../dtcg/README.md).

## Machine-readable output and exit statuses

Every command takes `--json` and then prints exactly one JSON document with sorted keys.

```bash
opentheme validate my-theme.opentheme.json --json
```

| Status | Meaning |
|---|---|
| `0` | Success |
| `1` | A file is invalid or refused, a resolution fell back, or `report --strict` found shortfalls |
| `2` | Usage error: unknown command or option, invalid value, unknown `--path` |
| `3` | A file is missing or unreadable, cannot be written, or already exists |

Colors are used only on a terminal; `--no-color` or `NO_COLOR` turns them off.
