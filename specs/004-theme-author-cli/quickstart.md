# Quickstart and Validation Guide: OpenTheme Command-Line Tool

**Feature**: `004-theme-author-cli` | **Contract**: [contracts/cli.md](./contracts/cli.md)

## Prerequisites

Node.js 24 or later and pnpm 10, from the repository root: `pnpm install && pnpm build`. The tool
runs as `node packages/cli/dist/main.js` (or `opentheme` once installed).

## Scenario 1: create, check, and resolve a theme (US1, US2, US6)

```bash
opentheme init my-theme.opentheme.json --name "Quiet Paper"
opentheme validate my-theme.opentheme.json
opentheme resolve my-theme.opentheme.json --scheme light --path color.text.primary
```

**Expected**: the file is created with a `uid.` id; validation reports it valid (exit 0); resolve
prints one resolved color (exit 0). `packages/cli/test/quickstart.test.ts` runs this.

## Scenario 2: find problems (US1)

`opentheme validate conformance/fixtures/…/invalid theme` → exit 1, each diagnostic with file,
pointer, code, message, and hint; `--json` prints one JSON document.

## Scenario 3: accessibility (US3)

`opentheme report specification/themes/reference/org.opentheme.aurora.opentheme.json --trusted`
→ conformant, exit 0.

## Scenario 4: CSS and preview (US4, US5)

```bash
opentheme css aurora.opentheme.json --trusted --scheme dark --element --scope app
opentheme preview aurora.opentheme.json --trusted --out aurora.html
```

**Expected**: the CSS equals `toStylesheet` for the same resolution; the preview is one file with
a section per mode and no external resources.

## Scenario 5: trust (US7)

Resolve a theme that misses the accessibility gate without `--trusted` → refused, exit 1; with
`--trusted` → resolved.

## Scenario 6: full verification

`pnpm verify` → green, including the CLI tests and `bench:cli`.
