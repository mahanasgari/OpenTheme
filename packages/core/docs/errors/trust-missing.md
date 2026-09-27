# `trust-missing`

**Where it surfaces**: Returned by `registry.admit` and `registry.admitFrom`.

## What failed

An admission request had no `trust`, or a value other than `"trusted"` or `"untrusted"`.

## Why

Trust is assigned by the host, never inferred from the document (FR-C020, FR-C021). Core refuses rather than guess, and it checks trust before reading any byte.

## How to fix it

Pass `trust: "trusted"` only for documents you bundle at build time. Everything else (user files, downloads, AI output, shared links) is `trust: "untrusted"` with a `source`.
