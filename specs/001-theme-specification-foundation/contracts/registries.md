# Contract: Normative Registries

**Location after implementation**: `specification/registry/1.0/*.json`, each validated by a schema
in `specification/schemas/1.0/registry/`. Registries are the single source of truth for every
closed vocabulary (Principle IV). Prose chapters cite registry entries instead of restating them,
and a consistency check fails the build if prose, schemas, registries, and fixtures disagree.

Every registry entry carries a `description` and at least one `example` (FR-003, NFR-006). Every
registry has a `version` equal to the specification version.

## `semantic-baseline.json`

```json
{
  "version": "1.0.0",
  "tokens": [
    {
      "path": "color.text.secondary",
      "type": "color",
      "description": "Supporting text such as captions and metadata.",
      "example": { "colorSpace": "srgb", "components": [0.36, 0.37, 0.4] },
      "default": { "$derive": { "op": "color.contrast-adjust", "args": {
        "color": { "$derive": { "op": "color.mix", "args": { "color": "{seed.foreground}", "toward": "{seed.background}", "ratio": 0.35 } } },
        "backgrounds": ["{color.surface.base}", "{color.surface.raised}", "{color.surface.sunken}"],
        "target": 4.5 } } },
      "highContrastDefault": "{color.text.primary}",
      "forcedColor": "canvas-text",
      "range": null,
      "deprecated": null
    }
  ],
  "pairs": [
    { "foreground": "color.text.secondary", "background": "color.surface.base", "kind": "text" }
  ],
  "distinguishable": [
    { "a": "color.status.danger.background", "b": "color.action.primary.background" }
  ],
  "distinguishableThreshold": 0.10
}
```

- `default` is a token value (a literal, alias, or derivation) that may reference only seeds and
  other baseline tokens.
- `highContrastDefault` is required for color types. It may reference only seeds and other tokens'
  high-contrast values (research R10).
- `forcedColor` is required for color types.
- `range` constrains numbers and dimensions (e.g., `{ "min": 0 }`).
- The token list covers every group FR-015 names, the reserved `seed.*` tokens, `radius.factor`,
  `size.target.min`, and the typography roles (body, heading levels 1–4, label, caption,
  monospace).

## `component-catalog.json`

```json
{ "version": "1.0.0", "catalog": "1.0", "contracts": [ { "id": "std/button", "version": "1.0.0", "description": "…",
  "parts": ["container", "label", "icon", "focus-ring"], "states": ["default", "hover", "focus-visible", "pressed", "disabled"],
  "variants": { "emphasis": ["primary", "secondary", "tertiary", "danger"], "size": ["sm", "md", "lg"] },
  "properties": { "container": { "background": "color", "border": "border", "corner-radius": "dimension", "min-height": "dimension", "padding-inline": "dimension" } },
  "defaults": { "container": { "background": { "$states": { "default": "{color.action.primary.background}" } } } },
  "pairs": [ { "foreground": "label.color", "background": "container.background", "kind": "text" } ],
  "interactiveParts": ["container"], "example": { } } ] }
```

The shape is identical to host contracts ([host-declaration.md](./host-declaration.md)). The catalog
lists the 14 contracts in data-model §7.

## `customization-points.json`

```json
{ "version": "1.0.0", "points": [ { "id": "std.text-size", "label": "Text size", "description": "…",
  "target": { "textScale": "in-app" }, "type": "number",
  "constraints": { "range": { "min": 1, "max": 2, "step": 0.05 } }, "default": 1,
  "effectiveRange": { "min": 1, "max": 3 }, "example": 1.25 } ] }
```

The file lists the 7 standard points (data-model §9), each with its widest allowed constraints and
its specification-default `effectiveRange` where applicable. Labels and descriptions are English
source strings with localization keys.

## `context-dimensions.json`

```json
{ "version": "1.0.0", "priority": ["contrast", "colorScheme", "density", "sizeClass", "motion"],
  "dimensions": {
    "colorScheme": { "values": ["light", "dark"], "variantsAllowed": true },
    "contrast": { "values": ["standard", "high"] },
    "motion": { "values": ["standard", "reduced"] },
    "density": { "values": ["compact", "standard", "comfortable"], "default": "standard" },
    "sizeClass": { "values": ["compact", "medium", "expanded"],
                   "thresholds": { "medium": { "value": 600, "unit": "px" }, "expanded": { "value": 1024, "unit": "px" } } } } }
```

## `transformations.json`

This file lists each transformation in [transformations.md](./transformations.md) with its
arguments (name, type, domain, optional), output type, effort cost, description, and example.

## `forced-colors.json`

This file lists the system color roles `canvas`, `canvas-text`, `link-text`, `button-face`,
`button-text`, `highlight`, `highlight-text`, `gray-text`, and `button-border`, each with a
description and its CSS system-color keyword as a non-normative mapping hint for web output
targets.

## `limits.json`

```json
{ "version": "1.0.0", "limits": {
  "documentBytes": 1048576, "tokens": 10000, "referenceDepth": 16, "derivationDepth": 8,
  "nestingDepth": 16, "inheritanceDepth": 4, "customizationPoints": 200, "overlays": 64,
  "styledContracts": 128, "localizedVariants": 64, "pointTargets": 16, "contrastCandidates": 8,
  "contrastBackgrounds": 4, "pathLength": 256, "pathSegmentLength": 64, "variantAxes": 16,
  "displayNameLength": 100, "descriptionLength": 1000, "motionDurationMs": 1000,
  "diagnostics": 200, "effortUnitsPerMode": 200000 } }
```

## `diagnostics.json`

This file lists each code in [diagnostics.md](./diagnostics.md) with its severity, rule
identifiers, English message and hint templates (placeholders refer only to allowed `params`), and
the fixture identifiers that produce it.

## `rules.json`

```json
{ "version": "1.0.0", "rules": [ { "id": "R-REF-004", "chapter": "03-tokens", "requirements": ["FR-017", "FR-059"],
  "summary": "References and derivations must not form cycles.", "fixtures": ["invalid/ref/cycle-direct", "invalid/ref/cycle-through-derivation", "invalid/inh/cycle-through-base"] } ] }
```

Every normative rule has an entry with at least one fixture, and every fixture names at least one
rule (NFR-010). Every functional requirement FR-001 to FR-099 maps to at least one rule, or, for
deliverable requirements such as FR-099, to the artifact check that verifies it. The consistency
check reports any requirement with neither.
