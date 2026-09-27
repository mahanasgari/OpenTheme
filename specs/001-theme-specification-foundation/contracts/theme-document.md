# Contract: Theme Document

**Normative sources after implementation**: `specification/schemas/1.0/theme.schema.json`
(structure) and `specification/spec/` chapters 01–15 (rules). This contract fixes the shape those
artifacts must have. Field rules are in [data-model.md](../data-model.md) §1–§12.

## Encoding

- I-JSON (RFC 7493), UTF-8, at most 1 MiB, with the suffix `.opentheme.json` (research R1).
- Top-level member order is irrelevant. Array order is significant (overlays, customization
  points, font fallbacks, lineage).
- The canonical form is normalization followed by JCS (RFC 8785). The integrity value is
  `sha256-<base64>` over the canonical bytes with `integrity` removed (research R3).

## Top-level shape

```json
{
  "opentheme": "1.0",
  "id": "org.example.harbor",
  "version": "2.1.0",
  "name": "Harbor",
  "description": "Calm blue theme with generous spacing.",
  "localized": { "fa": { "name": "بندر", "description": "پوسته‌ای آرام با فاصله‌گذاری دلباز." } },
  "author": { "name": "Example Studio" },
  "license": "CC-BY-4.0",
  "provenance": { "origin": "prebuilt", "lineage": [] },
  "compatibility": { "catalog": "1.0", "extensions": { "com.example.notes": "1.0" } },
  "extends": { "id": "org.opentheme.baseline", "version": "^1.0.0" },
  "colorSchemes": { "supported": ["light", "dark"], "default": "light" },
  "seeds": { "light": { }, "dark": { }, "fontFamily": [ ] },
  "tokens": { },
  "contexts": [ ],
  "components": { },
  "layout": { },
  "customization": { "points": [ ] },
  "$extensions": { "com.example.tooling": { "editorState": 3 } },
  "integrity": "sha256-…"
}
```

Required: `opentheme`, `id`, `version`, `name`, `provenance.origin`, `compatibility.catalog`,
`colorSchemes`, and `seeds`. Export additionally requires `author`, `license`, and `integrity`, and
forbids `extends`, because export flattens the chain (FR-049).

## Minimal valid theme (seed tokens only)

This is the smallest valid document (FR-016, FR-092). It resolves completely in light at standard
and high contrast.

```json
{
  "opentheme": "1.0",
  "id": "uid.k7q2m4x5c3v6b6n2z5r7t2y4wa",
  "version": "1.0.0",
  "name": "Quiet Paper",
  "provenance": { "origin": "user-created" },
  "compatibility": { "catalog": "1.0" },
  "colorSchemes": { "supported": ["light"], "default": "light" },
  "seeds": {
    "light": {
      "background": { "colorSpace": "srgb", "components": [0.98, 0.97, 0.95] },
      "foreground": { "colorSpace": "srgb", "components": [0.12, 0.12, 0.14] },
      "accent": { "colorSpace": "oklch", "components": [0.55, 0.15, 250] }
    },
    "fontFamily": ["Inter", "system-ui", "sans-serif"]
  }
}
```

## Tokens

Groups nest by name. A token is an object with `$type` (declared or inherited from its group) and
exactly one of `$value` or `$derive`.

```json
"tokens": {
  "primitive": {
    "$type": "color",
    "blue-600": { "$value": { "colorSpace": "oklch", "components": [0.52, 0.16, 252] } }
  },
  "color": {
    "action": {
      "primary": {
        "$type": "color",
        "background": { "$value": "{seed.accent}" },
        "background-hover": {
          "$derive": { "op": "color.lightness", "args": { "color": "{color.action.primary.background}", "delta": -0.06 } }
        },
        "text": {
          "$derive": {
            "op": "color.contrast-select",
            "args": {
              "backgrounds": ["{color.action.primary.background}", "{color.action.primary.background-hover}"],
              "candidates": ["{seed.background}", "{seed.foreground}"],
              "target": 4.5
            }
          }
        }
      }
    }
  },
  "radius": {
    "$type": "dimension",
    "md": {
      "$derive": { "op": "dimension.scale", "args": { "value": { "value": 6, "unit": "px" }, "factor": "{radius.factor}" } }
    }
  }
}
```

Rules:

- Aliases are strings of the form `{path}` and target whole tokens only.
- Host extension tokens use a qualified path: `{com.example.notes/color.rail}`.
- Members starting with `$` are reserved. Unknown `$` members are errors, except `$extensions`.
- Only the transformations listed in [transformations.md](./transformations.md) are valid `op`
  values.
- Standard semantic paths and their types come from the semantic baseline registry. A theme may
  set any of them, and every one it omits takes its specification default.

## Context overlays

```json
"contexts": [
  { "when": { "colorScheme": "dark" },
    "tokens": { "color": { "surface": { "raised": {
      "$derive": { "op": "color.mix-bounded", "args": {
        "color": "{seed.background}", "toward": "{seed.foreground}", "ratio": 0.08,
        "reference": "{seed.foreground}", "minimum": 4.5 } } } } } } },
  { "when": { "colorScheme": "dark", "contrast": "high" },
    "tokens": { "color": { "action": { "primary": { "background": {
      "$value": { "colorSpace": "srgb", "components": [1, 1, 1] } } } } } } },
  { "when": { "density": "compact" },
    "tokens": { "space": { "inset": { "md": { "$value": { "value": 8, "unit": "px" } } } } } }
]
```

Rules:

- Overlay tokens omit `$type`, which comes from the base declaration or the registry.
- Identical `when` maps are invalid.
- Precedence is ascending specificity, then contrast > colorScheme > density > sizeClass > motion.
- In high contrast, color values come only from overlays that include `contrast: high` or from the
  high-contrast specification defaults (research R11).

## Components

```json
"components": {
  "std/button": {
    "contract": "1.0",
    "parts": {
      "container": {
        "background": { "$states": { "default": "{color.action.primary.background}",
                                      "hover": "{color.action.primary.background-hover}" } },
        "corner-radius": "{radius.md}"
      }
    },
    "variants": {
      "emphasis": {
        "danger": { "parts": { "container": { "background": "{color.status.danger.background}" } } }
      }
    }
  },
  "com.example.notes/timeline": {
    "contract": "1.0",
    "parts": { "rail": { "color": "{com.example.notes/color.rail}" } }
  }
}
```

Rules:

- Values are token values: literal, alias, or `{ "$derive": … }`.
- `$states` keys must be states the contract declares. Variant axes and values must be ones the
  contract declares.
- Styling for a contract the host does not declare, or declares in an incompatible version, is
  ignored with an informational diagnostic (FR-032).

## Layout

```json
"tokens": { "layout": { "container": { "max-width": { "$value": { "value": 1200, "unit": "px" } } } } },
"layout": {
  "variants": { "navigation": { "compact": "bottom", "medium": "top", "expanded": "side" } }
}
```

- Layout tokens are ordinary tokens in the standard `layout` group under `tokens`, so each path
  has exactly one declaration site. They vary by size class through context overlays.
- The `layout` member holds only variant selections. Variant names must be ones the host declares
  for that region. Selections for undeclared regions are ignored with an informational
  diagnostic.

## Customization points

```json
"customization": {
  "points": [
    { "id": "std.accent" },
    { "id": "std.text-size", "constraints": { "range": { "min": 1, "max": 1.5, "step": 0.05 } },
      "effectiveRange": { "min": 1, "max": 3 } },
    { "id": "std.corner-roundness", "constraints": { "range": { "min": 0, "max": 2, "step": 0.25 } } },
    { "id": "sidebar-tint",
      "label": "Sidebar tint", "localized": { "fa": { "label": "رنگ نوار کناری" } },
      "target": ["color.surface.sunken"], "type": "color",
      "constraints": { "presets": [
        { "id": "neutral", "label": "Neutral", "value": "{seed.background}" },
        { "id": "warm", "label": "Warm", "value": { "colorSpace": "oklch", "components": [0.95, 0.03, 70] } } ] },
      "default": "neutral" }
  ]
}
```

Rules:

- A standard point entry may narrow the registry constraints but may not change the target or
  type.
- Local points need a label, target, type, and constraints.
- Presets are referenced by preset `id`. A preset value may be a literal or an alias to a theme
  token; it may not be a derivation.

## Forbidden content (FR-066; each has malicious fixtures)

- There is no member that accepts code, styling-language text, selectors, element or class names,
  URLs or other network addresses, conditions outside the five dimensions, or data access.
- Any string outside a defined grammar is a structure error. Attempts to smuggle content into
  display text are neutralized by the plain-text rule (FR-011); display text is never
  interpreted.
