# 16. Design Tokens Mapping

**Status**: Normative. Research R19. Maps OpenTheme ↔ W3C Design Tokens Format Module 2025.10
(FR-096).

## Export (OpenTheme → DTCG)

For each requested color scheme / mode, export produces **one** DTCG 2025.10 document whose tokens
carry **computed** values for that mode (aliases and derivations already evaluated).

When a token was produced from a derivation, the exporter MUST retain the derivation source under:

```text
$extensions["org.opentheme"].derive
```

so a later OpenTheme import can recover the authoring form. Primitive `$type` / `$value` pairs that
are already concrete need no extension payload.

```opentheme
{
  "color": {
    "accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.2, 0.4, 0.6]
      },
      "$extensions": {
        "org.opentheme": {
          "derive": {
            "from": "{seeds.light.accent}",
            "via": [{ "transform": "color.chroma", "args": { "factor": 0.8 } }]
          }
        }
      }
    }
  }
}
```

## Import (DTCG → OpenTheme)

Import maps DTCG tokens to OpenTheme primitives, or by name mapping into the theme's semantic
token tree. Unknown DTCG types that OpenTheme does not define MUST be rejected or placed under
`$extensions` without affecting core validation.

## What does not map

The following OpenTheme constructs have no lossless DTCG 2025.10 equivalent and MUST be documented
as out of scope for a pure DTCG round trip:

| OpenTheme | Notes |
| --- | --- |
| `$derive` graphs | Exported as computed values; source kept only in `$extensions["org.opentheme"]` |
| Context overlays | Optional mapping to DTCG Resolver Module modifiers is non-normative tooling |
| Component contracts | Host/UI structure, not design tokens |
| Customization points | Preference schema, not tokens |
| `rem` dimensions | OpenTheme uses `px` only |
| Theme `extends` / layout / host declarations | Outside DTCG |

## Worked import sketch

```opentheme
{
  "opentheme": "1.0",
  "id": "uid.abcdefghijklmnopqrstuv2345",
  "version": "1.0.0",
  "name": "Imported Tokens",
  "provenance": { "origin": "imported" },
  "compatibility": { "catalog": "1.0" },
  "colorSchemes": { "supported": ["light"], "default": "light" },
  "seeds": {
    "light": {
      "background": { "colorSpace": "srgb", "components": [1, 1, 1] },
      "foreground": { "colorSpace": "srgb", "components": [0, 0, 0] },
      "accent": { "colorSpace": "srgb", "components": [0.2, 0.4, 0.8] }
    },
    "fontFamily": ["system-ui", "sans-serif"]
  },
  "tokens": {
    "color": {
      "surface": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": [0.98, 0.98, 0.99] }
      }
    }
  }
}
```
