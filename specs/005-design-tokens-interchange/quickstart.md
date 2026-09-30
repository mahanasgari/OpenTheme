# Quickstart and Validation Guide: Design Tokens Interchange

**Feature**: `005-design-tokens-interchange` | **Contract**: [contracts/api.md](./contracts/api.md)

## Scenario 1: export (US1)

```bash
opentheme export aurora.opentheme.json --trusted --out-dir tokens
```

**Expected**: `tokens/aurora.light.tokens.json` and `tokens/aurora.dark.tokens.json`; every value
equals `opentheme resolve --json` for that scheme; derived tokens carry
`$extensions["org.opentheme"].derive`.

## Scenario 2: import (US2)

```bash
opentheme import tokens/aurora.light.tokens.json --mapping roles.json --out imported.opentheme.json
opentheme validate imported.opentheme.json
```

**Expected**: a valid theme with tokens under `primitive`; mapped roles resolve to the exported
values; the report lists anything left out.

## Scenario 3: verification

`pnpm verify` → green, including the interchange tests.
