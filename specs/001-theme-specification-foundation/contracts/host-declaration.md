# Contract: Host Declaration

**Normative sources after implementation**: `specification/schemas/1.0/host-declaration.schema.json`
and `specification/spec/17-host-declarations.md`. Field rules: [data-model.md](../data-model.md)
§7, §11, and §13.

A host declaration states what a host application consumes and what it adds: extension
contracts, extension tokens, and layout variants. It is supplied by the developer, is trusted, and
never contains presentation values of its own beyond defaults that alias or derive from standard
tokens. It uses the same encoding as a theme document (I-JSON, 1 MiB), with the suffix
`.opentheme-host.json`.

## Shape

```json
{
  "openthemeHost": "1.0",
  "id": "com.example.notes",
  "catalog": "1.0",
  "consumes": {
    "tokens": ["color.*", "font.*", "space.*", "radius.*", "focus.*", "motion.*"],
    "contracts": ["std/button@1", "std/text-input@1", "std/dialog@1", "std/tabs@1"]
  },
  "tokens": {
    "color": {
      "$type": "color",
      "rail": {
        "$description": "Line connecting entries in the timeline.",
        "$derive": { "op": "color.mix", "args": { "color": "{color.border.default}", "toward": "{color.action.primary.background}", "ratio": 0.3 } }
      }
    }
  },
  "contracts": [
    {
      "id": "com.example.notes/timeline",
      "version": "1.0.0",
      "description": "Vertical list of dated entries.",
      "parts": ["container", "rail", "marker", "date-label"],
      "states": ["default", "hover", "focus-visible", "selected"],
      "variants": { "emphasis": ["standard", "muted"] },
      "properties": {
        "container": { "background": "color", "padding": "dimension" },
        "rail": { "color": "color", "width": "dimension" },
        "marker": { "color": "color", "size": "dimension" },
        "date-label": { "color": "color", "text-style": "typography" }
      },
      "defaults": {
        "container": { "background": "{color.surface.base}", "padding": "{space.inset.md}" },
        "rail": { "color": "{com.example.notes/color.rail}", "width": "{border.width.thin}" },
        "marker": { "color": { "$states": { "default": "{color.action.primary.background}", "selected": "{color.selection.background}" } }, "size": "{size.icon.sm}" },
        "date-label": { "color": "{color.text.secondary}", "text-style": "{text.caption}" }
      },
      "pairs": [
        { "foreground": "date-label.color", "background": "container.background", "kind": "text" },
        { "foreground": "marker.color", "background": "container.background", "kind": "non-text" }
      ],
      "interactiveParts": ["marker"]
    }
  ],
  "layoutVariants": {
    "navigation": { "variants": ["top", "side", "bottom"], "default": "top" }
  }
}
```

## Rules

- `id` is the host namespace. It must not be, or start with, a reserved namespace (`std`,
  `org.opentheme`, `uid`). A reserved or colliding namespace makes the host declaration invalid
  (US5 scenario 3, `OT-HOST-001`).
- Contract identifiers are `<id>/<name>`. Versions follow semantic versioning, and a theme's
  styling applies only if it targets a compatible version (FR-086; same major, and a minor no
  newer than declared).
- Every property has a default. Defaults are aliases or derivations whose inputs are standard
  semantic tokens or the host's own extension tokens. The result is that a theme that knows
  nothing about the host still styles it (US5 scenario 1, FR-032).
- `pairs` reference `part.property` and follow the contrast pair kinds in data-model §12. Pairs
  are included in every accessibility report for themes applied to this host.
- `consumes` is informational, used for coverage reports (SC-002). A host may use tokens it does
  not list.
- Layout variants are fully implemented by the host, which remains responsible for their order and
  accessibility (FR-037). Themes may only select among them.
- The conformance suite includes two reference host declarations with different structures and
  extension contracts (FR-099): a notes-style app (timeline, tag chip) and a media-style app
  (player controls, playlist row). Both are generic and domain-neutral.
