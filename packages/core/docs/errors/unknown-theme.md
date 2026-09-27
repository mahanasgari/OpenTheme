# `unknown-theme`

**Where it surfaces**: Returned by `describeCustomization` and `documents.flatten`.

## What failed

No selectable entry with that identifier exists in the snapshot.

## Why

Only registered, valid, admitted themes available under the policy can be described (FR-C042, FR-C066).

## How to fix it

Admit the theme first, include it in the policy's `availableThemes`, and use a fresh snapshot.
