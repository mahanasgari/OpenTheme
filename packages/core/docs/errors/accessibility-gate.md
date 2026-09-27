# `accessibility-gate`

**Where it surfaces**: Returned by `registry.admit`, with the `OT-A11Y-003` diagnostics.

## What failed

An untrusted, otherwise valid theme has a declared color pair below its WCAG 2.2 AA threshold in a mode it supports.

## Why

By default Core refuses untrusted themes that are not accessible (FR-C028). Trusted themes are never refused; their shortfalls are only reported.

## How to fix it

Fix the pairs named in the `OT-A11Y-003` diagnostics. A host that must accept such themes can set `accessibilityGate: "relaxed"`; shortfalls are still reported.
