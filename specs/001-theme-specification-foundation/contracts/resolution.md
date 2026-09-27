# Contract: Resolution Input, Algorithm, and Resolved Theme

**Normative sources after implementation**:
`specification/schemas/1.0/resolution-input.schema.json`,
`specification/schemas/1.0/resolved-theme.schema.json`, and
`specification/spec/10-inheritance-and-resolution.md`. Field rules:
[data-model.md](../data-model.md) §14–§15. Decisions: [research.md](../research.md) R11–R12.

Resolution is a pure, deterministic function:
`resolve(input, registries) → { resolved, diagnostics }`. It reads no clock, randomness, network,
or hidden state (Principle X). Everything that varies is in `input`.

## Resolution input (abstract model)

This is the normative input of the algorithm. It is **not** the Customization Policy or User
Preferences document format; those later formats must compile into it losslessly.

```json
{
  "themes": [
    { "trust": "trusted", "document": { "…": "org.example.harbor 2.1.0" } },
    { "trust": "untrusted", "document": { "…": "uid.k7q2… 1.0.0" } }
  ],
  "host": { "…": "host declaration or null" },
  "selection": { "id": "org.example.harbor" },
  "previous": { "id": "org.example.harbor", "version": "2.0.0" },
  "platform": { "colorScheme": "dark", "contrast": "standard", "forcedColors": false, "reducedMotion": true, "textScale": 1.5 },
  "environment": { "sizeClass": "expanded", "locale": "fa-IR", "direction": "rtl" },
  "preferences": {
    "std.accent": { "colorSpace": "srgb", "components": [0.9, 0.3, 0.1] },
    "std.text-size": 1.2,
    "std.color-scheme": "light",
    "sidebar-tint": "warm"
  },
  "policy": {
    "availableThemes": ["org.example.harbor", "uid.k7q2m4x5c3v6b6n2z5r7t2y4wa"],
    "defaultTheme": "org.example.harbor",
    "permittedPoints": {
      "std.accent": {},
      "std.text-size": { "constraints": { "range": { "min": 1, "max": 1.3, "step": 0.05 } } },
      "std.color-scheme": {}
    },
    "allowedColorSchemes": ["light", "dark"],
    "locks": { "color.status.danger.background": { "colorSpace": "srgb", "components": [0.75, 0.1, 0.1] } },
    "protected": ["color.status.danger", "color.status.warning"],
    "accessibilityFloor": "wcag22-aa"
  }
}
```

- `trust` is assigned by the host according to how it obtained the document. It is never read
  from the document (FR-010). It belongs to the document entry: there is no identifier-keyed
  trust, and every entry MUST state `trusted` or `untrusted`. Base themes are resolved from
  this same list. The schema also accepts `theme` as shorthand for one more entry with trust
  `trusted`. Entry order never affects trust or which document is selected.
- `protected` entries are token paths or group prefixes. They resolve to theme or specification
  values and are immune to user values. `locks` replace the value outright (FR-051, FR-070).
- A preference is applied only if its point is declared by the selected theme and present in
  `permittedPoints` (FR-043). All others are skipped with a diagnostic (FB-006).

## Algorithm stages (normative order)

1. **Select**:
   - Candidates are `themes` entries whose `id` is in `availableThemes`.
   - A selection without a version picks the candidate with the highest SemVer precedence,
     independent of entry order (`R-RES-005`).
   - An untrusted entry never replaces or shadows a trusted entry with the same `id`. It is
     treated as distinct and flagged `OT-SEC-001` (FR-068, FB-010).
   - The selected theme and its base chain (resolved from the same `themes` list) are validated.
   - If invalid or unsupported, the fallback chain is `previous`, then `defaultTheme`, then the
     specification baseline theme (FB-001). `applied.fallback` records which one was used.
2. **Context**:
   - Color scheme: the user's preference, then the platform, then the policy default, limited to
     `allowedColorSchemes` ∩ the theme's supported schemes. If the intersection is empty, the
     theme's declared default is used (FR-053, FB-003).
   - Contrast is `high` if the platform or user requests it; policy cannot prevent it (FR-052,
     FR-053).
   - Motion is `reduced` if the platform or user requests it.
   - Density comes from the user's preference, else the theme's default.
   - `sizeClass` is taken from the environment (FR-038).
3. **Declare**: for each standard semantic token, host extension token, and contract property,
   the winning declaration is chosen from lowest to highest layer:
   1. specification defaults and host contract defaults (in high contrast, the high-contrast
      defaults);
   2. the theme chain, base first, with overlays by specificity and the high-contrast sourcing
      rule;
   3. user values after FR-044 enforcement (clamp, snap, or fall back), where the last-declared
      point wins among points sharing a target;
   4. policy locks and protected paths.
4. **Evaluate**: aliases and derivations are evaluated over the declaration graph in topological
   order, with ties broken by canonical path order. Locked values are fixed inputs, so dependents
   see them (FR-055, US1 scenario 3). The effort budget applies.
5. **Post-process**:
   - Effective text scale = max(platform, clamp(platform × in-app, effectiveRange.min,
     effectiveRange.max)) applied to font sizes and dimension line heights (FR-020).
   - Target-size floor of 24 px on interactive parts (FR-075).
   - Forced colors map every color to its system role (FR-054).
   - Reduced motion sets every duration to its reduced value (FR-028).
6. **Quantize** colors (research R6).
7. **Check**:
   - Compute the accessibility report for the effective mode.
   - With `accessibilityFloor: wcag22-aa`, every user value that a failing pair depends on is
     rejected (`OT-A11Y-007`). Stages 3 to 7 run once more with those points at their documented
     defaults (FB-007).
   - With `relaxed`, failures remain as warnings (Principle VIII).

The result must be complete: every standard semantic token, host extension token, and property of
every standard and host-declared contract has exactly one concrete value (FR-057).

## Resolved theme (output)

```json
{
  "applied": { "id": "org.example.harbor", "version": "2.1.0", "fallback": "none" },
  "context": { "colorScheme": "light", "contrast": "standard", "motion": "reduced", "density": "standard",
               "sizeClass": "expanded", "textScale": 1.8, "forcedColors": false, "direction": "rtl" },
  "displayText": { "name": "بندر", "description": "پوسته‌ای آرام با فاصله‌گذاری دلباز." },
  "tokens": {
    "color.action.primary.background": { "srgb8": [230, 76, 26], "alpha": 1 },
    "font.size.body": { "value": 28.8, "unit": "px" },
    "motion.duration.medium": { "value": 0, "unit": "ms" },
    "layout.container.max-width": { "value": 1200, "unit": "px" }
  },
  "components": {
    "std/button": { "container": { "background": { "default": { "srgb8": [230, 76, 26], "alpha": 1 } } } }
  },
  "layout": { "variants": { "navigation": "side" } },
  "preferences": {
    "std.accent": { "status": "effective" },
    "std.text-size": { "status": "effective", "value": 1.2 },
    "sidebar-tint": { "status": "skipped" }
  },
  "accessibility": { "mode": "light/standard", "pairs": [ { "foreground": "color.text.primary", "background": "color.surface.base", "ratio": 14.2, "threshold": 4.5, "pass": true } ] },
  "diagnostics": [ { "code": "OT-CUS-103", "severity": "info", "location": { "document": "input", "pointer": "/preferences/sidebar-tint" }, "rule": "R-CUS-012", "message": "cus.skipped.not-permitted", "hint": "cus.skipped.not-permitted.hint", "params": { "point": "sidebar-tint" } } ]
}
```

- Under forced colors, a color value is `{ "system": "canvas-text" }` instead of `srgb8` (FR-054).
- Dimensions are always in `px`. Output targets (a later feature) map them to platform units.
- Resolved values are serialized with JCS, so two conforming implementations produce identical
  bytes (NFR-001, SC-004).

## Normative resolution examples (FR-058)

The conformance suite provides at least one example for each ordered pair of layers (10 pairs from
5 layers) crossed with each context dimension (5), plus examples for every failure behavior
FB-001 to FB-013, US3 scenarios 1–7, US4 scenarios 1–10, and the text-scale cases of FR-020. Each
example has exactly one expected output (SC-009).
