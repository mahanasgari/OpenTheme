# `superseded`

**Where it surfaces**: Recorded in `controller.errors` (informational).

## What failed

Stored preferences finished loading after a newer user change.

## Why

A late asynchronous result must not undo what the user just did (FB-C004), so it was discarded.

## How to fix it

No action is needed. If it happens often, supply `initial` synchronously when creating the controller.
