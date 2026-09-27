# Modify corner roundness

Scenario 2 (FR-091): edit addressable values, then re-validate.

## Before

```opentheme
{
  "opentheme": "1.0",
  "id": "uid.abcdefghijklmnopqrstuv2345",
  "version": "1.0.0",
  "name": "Roundness Demo",
  "provenance": {
    "origin": "developer-authored"
  },
  "compatibility": {
    "catalog": "1.0"
  },
  "colorSchemes": {
    "supported": [
      "light"
    ],
    "default": "light"
  },
  "seeds": {
    "light": {
      "background": {
        "colorSpace": "srgb",
        "components": [
          0.98,
          0.97,
          0.95
        ]
      },
      "foreground": {
        "colorSpace": "srgb",
        "components": [
          0.12,
          0.12,
          0.14
        ]
      },
      "accent": {
        "colorSpace": "oklch",
        "components": [
          0.55,
          0.15,
          250
        ]
      }
    },
    "fontFamily": [
      "Source Sans 3",
      "system-ui",
      "sans-serif"
    ]
  },
  "tokens": {
    "radius": {
      "factor": {
        "$type": "number",
        "$value": 1
      }
    }
  },
  "customization": {
    "points": [
      {
        "id": "std.corner-roundness"
      }
    ]
  }
}
```

## After

```opentheme
{
  "opentheme": "1.0",
  "id": "uid.abcdefghijklmnopqrstuv2345",
  "version": "1.0.0",
  "name": "Roundness Demo",
  "provenance": {
    "origin": "developer-authored"
  },
  "compatibility": {
    "catalog": "1.0"
  },
  "colorSchemes": {
    "supported": [
      "light"
    ],
    "default": "light"
  },
  "seeds": {
    "light": {
      "background": {
        "colorSpace": "srgb",
        "components": [
          0.98,
          0.97,
          0.95
        ]
      },
      "foreground": {
        "colorSpace": "srgb",
        "components": [
          0.12,
          0.12,
          0.14
        ]
      },
      "accent": {
        "colorSpace": "oklch",
        "components": [
          0.55,
          0.15,
          250
        ]
      }
    },
    "fontFamily": [
      "Source Sans 3",
      "system-ui",
      "sans-serif"
    ]
  },
  "tokens": {
    "radius": {
      "factor": {
        "$type": "number",
        "$value": 1.5
      }
    }
  },
  "customization": {
    "points": [
      {
        "id": "std.corner-roundness"
      }
    ]
  }
}
```

## Edited pointers

- `/tokens/radius/factor/$value` — `1` → `1.5`
