# `deprecated-api`

**Where it surfaces**: Recorded in `controller.errors` or returned alongside a result.

## What failed

A deprecated export was used.

## Why

Deprecations are announced one minor version ahead (FR-C102).

## How to fix it

Move to the replacement named in the message before the next major version.
