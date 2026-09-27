# `source-missing`

**Where it surfaces**: Returned by `registry.admit` and `registry.admitFrom`.

## What failed

An untrusted admission had no `source` category.

## Why

Every untrusted document must state how the host obtained it, so the host's per-source settings can apply (FR-C026).

## How to fix it

Pass `source: "user-created" | "imported" | "shared" | "ai-generated"`, chosen from how your app obtained the bytes, never from the document's `provenance`.
