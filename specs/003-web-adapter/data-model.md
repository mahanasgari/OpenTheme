# Data Model: OpenTheme Web Adapter

**Feature**: `003-web-adapter` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

The adapter adds no theme data. Its input is Core's Resolved Theme (`resolved-theme.schema.json`)
and Core's controller; its output is CSS text and CSS object model changes.

## 1. Declaration

| Field | Type | Rule |
|---|---|---|
| `name` | string | `--ot-…` or `--otc-…` per the naming contract ([contracts/css-output.md](./contracts/css-output.md)) |
| `value` | string | Produced only by the serializer for the resolved value's type |

## 2. Declaration Set

An ordered list of Declarations for one Resolved Theme.

- Order: `name` in UTF-16 code-unit order (deterministic, FR-W004).
- Unique names (the naming scheme is injective).
- Built from `resolved.tokens` and `resolved.components`; nothing else from the result is written.
- **Omissions**: entries skipped because a name segment is outside the grammar or a value shape has
  no serializer (research WR10). Each omission records the source path and the reason.

## 3. Scope

| Field | Type | Notes |
|---|---|---|
| `id` | string | Host-chosen, `[a-z][a-z0-9-]*`; also the preference store key suffix |
| `target` | the document or an element | The document scope uses `:root`; an element scope gets `data-opentheme-scope="<id>"` |
| `controller` | Core ThemeController | One per scope; never shared |
| `context` | Context Source | Live browser signals plus host inputs |
| `store` | Preference Store or none | Default: the Browser Preference Store |
| `styleElement` | `<style data-opentheme-scope="<id>">` | Created, or adopted from server rendering |
| `current` | Declaration Set | What is currently applied, for diffing |

**States**: `attached` → (updates) → `detached`. `detach()` removes the rule, the style element (if
the adapter created or adopted it), the scope attribute, and every listener; calling it again does
nothing. Attaching to a target already managed by another scope is refused
(`scope-conflict`).

## 4. Context Source

| Core field | Source | Default when unavailable |
|---|---|---|
| `platform.colorScheme` | `prefers-color-scheme` | `no-preference` |
| `platform.contrast` | `prefers-contrast: more` | `standard` |
| `platform.forcedColors` | `forced-colors: active` | `false` |
| `platform.reducedMotion` | `prefers-reduced-motion: reduce` | `false` |
| `platform.textScale` | host input (optional root-font-size helper) | `1` |
| `environment.sizeClass` | host input (optional width helper, thresholds 600 / 1024 px) | required from the host |
| `environment.direction` | computed direction of the target | `ltr` |
| `environment.locale` | nearest `lang` attribute | host default locale |

Change detection: the source keeps the last context sent to Core and forwards a change only when
some field differs.

## 5. Browser Preference Store

| Operation | Behavior |
|---|---|
| `read(scope)` | The bytes at key `<prefix><scope>` (default prefix `opentheme:`), or `null`; storage exceptions reject |
| `write(scope, bytes)` | Stores the canonical document bytes; quota or access exceptions reject |
| `clear(scope)` | Removes the key |
| `readInitial(scope)` | Synchronous read for the first resolution; returns `null` on any failure |

The store never interprets the bytes; Core parses and validates them (chapter 18).

## 6. Adapter Report

Per update: the omissions of the Declaration Set, and the number of properties set and removed.
Exposed to the host for diagnostics; never written into the page.
