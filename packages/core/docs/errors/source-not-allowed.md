# `source-not-allowed`

**Where it surfaces**: Returned by `registry.admit` and `registry.admitFrom`.

## What failed

Untrusted themes from this source category are turned off in the settings.

## Why

Every category is off by default (FR-C024). The document was not parsed or registered.

## How to fix it

If your product accepts such themes, enable the category: `createCore({ untrustedSources: { imported: true } })` or `core.updateSettings(...)`.
