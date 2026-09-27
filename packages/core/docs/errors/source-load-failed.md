# `source-load-failed`

**Where it surfaces**: Returned by `registry.admitFrom`.

## What failed

The host's `ThemeSource.load()` rejected or threw.

## Why

Core performs no I/O itself; loading is the host's `ThemeSource` (FR-C010).

## How to fix it

Check your `ThemeSource` implementation (network, file access, permissions) and retry.
