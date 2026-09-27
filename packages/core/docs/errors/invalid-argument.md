# `invalid-argument`

**Where it surfaces**: Thrown for programming errors; returned for data-dependent ones.

## What failed

An argument or setting does not match the typed API: an unknown setting, a value out of range, a malformed request, or a snapshot that this Core did not produce.

## Why

Core validates every argument instead of guessing (contracts/operational-errors.md).

## How to fix it

Check the argument named by `pointer` against the public API reference.
