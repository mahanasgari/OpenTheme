# `invalid-context`

**Where it surfaces**: Returned by `core.resolve` (`ok: false`); thrown by `createController` and `setContext`.

## What failed

A platform or environment value is outside the resolution-input schema, or an unknown member (such as `density` or a pixel width) was supplied.

## Why

Core never substitutes a guessed value (FR-C053). Density is a customization point, not context (FR-C052).

## How to fix it

Supply exactly: `platform { colorScheme, contrast, forcedColors, reducedMotion, textScale }` and `environment { sizeClass, locale, direction }`. The `pointer` names the offending member.
