# `unknown-preset`

**Where it surfaces**: Thrown by any operation that takes a policy.

## What failed

The policy names a preset that does not exist.

## Why

Presets are a closed, documented list (FR-C065).

## How to fix it

Use `"closed"` or `"common-personalization"`, or pass the abstract policy directly.
