# `store-write-failed`

**Where it surfaces**: Recorded in `controller.errors`.

## What failed

The `PreferenceStore.write` call threw or rejected.

## Why

The change was applied in memory but not persisted (FB-C002).

## How to fix it

Check your `PreferenceStore` implementation (quota, permissions). The next successful write persists the current document.
