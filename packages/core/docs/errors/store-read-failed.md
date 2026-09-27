# `store-read-failed`

**Where it surfaces**: Recorded in `controller.errors`.

## What failed

The `PreferenceStore.read` call threw or rejected.

## Why

Store failures never change the applied appearance (FB-C002); the controller continued with the developer default.

## How to fix it

Check your `PreferenceStore` implementation. The stored data was not modified.
