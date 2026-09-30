# Research: Design Tokens Interchange

**Feature**: `005-design-tokens-interchange` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## IR1. Package and dependencies

- **Decision**: A new workspace package `packages/dtcg` (`@opentheme/dtcg`), TypeScript ES2022 ESM,
  runtime dependency `@opentheme/core` only, with the baseline token types and the seed-only
  example's seeds embedded at build time (like the Web adapter's registry data). The command-line
  tool gains `export` and `import` and a dependency on `@opentheme/dtcg`.
- **Rationale**: Format conversion is tooling, not theming behavior (constitution V); a library lets
  other tools reuse it, and the commands give designers the same conventions as the other commands.

## IR2. Export source of truth

- **Decision**: Values come from `core.resolve` for each mode with a policy that makes only the
  exported theme available. The authoring form (declared `$type` and `$derive`) comes from
  `core.documents.flatten`, which merges inheritance. Types come from the flattened declaration
  (with group `$type` inheritance), else the semantic baseline registry.
- **Rationale**: Chapter 16 requires computed values plus the derivation source; both must come from
  Core so the export never disagrees with applications.

## IR3. Value encodings (OpenTheme resolved → DTCG 2025.10)

| OpenTheme resolved | DTCG `$type` | DTCG `$value` |
|---|---|---|
| `{ srgb8, alpha }` | `color` | `{ colorSpace: "srgb", components: [r/255, g/255, b/255], alpha?, hex: "#rrggbb" }` (`alpha` only when not 1) |
| `{ value, unit: "px" }` | `dimension` | `{ value, unit: "px" }` |
| `{ value, unit: "ms" }` | `duration` | `{ value, unit: "ms" }` |
| `{ number }` | `number`, or `fontWeight` when the declared type is `fontWeight` | the number (`opacity` is exported as `number`) |
| `{ families }` | `fontFamily` | the array |
| `[x1, y1, x2, y2]` | `cubicBezier` | the array |
| stroke style string | `strokeStyle` | the string |
| border | `border` | `{ color, width, style }` |
| shadow | `shadow` | `{ color, offsetX, offsetY, blur, spread }` |
| typography | `typography` | `{ fontFamily, fontSize, fontWeight, letterSpacing?, lineHeight }` |

Not exported, and reported: `density` values, system colors (forced colors), a typography
`lineHeight` given as a dimension (DTCG's is a number), and the `physical` flag of composites.

## IR4. Derivation payload (finding D1)

- **Decision**: `$extensions["org.opentheme"].derive` holds the theme's `$derive` object exactly as
  declared (`{ op, args }`, aliases as written).
- **Rationale**: Chapter 16 requires keeping "the derivation source" so an import "can recover the
  authoring form"; the chapter's example uses a `{ from, via: [{ transform }] }` shape that no chapter,
  schema, or registry defines. Keeping the declared object is lossless and needs no new format.
  Recorded as finding D1 against chapter 16.

## IR5. Import mapping rules

- Tokens go under `primitive` (reserved group, chapter 03), keeping DTCG group structure. Aliases
  `{a.b}` become `{primitive.a.b}` after name conversion.
- **Names (finding D3)**: each segment is lowercased; characters outside `[a-z0-9-]` become `-`;
  runs of `-` collapse and leading or trailing `-` is removed. Imported names always follow
  `primitive`, so a digit-led segment is valid (chapter 03). Empty names, names over 64
  characters, and collisions are reported and left out.
- **Types**: `color` in `srgb` or `oklch` with numeric components; `dimension` in `px`; `duration`
  in `ms`, or `s` when `value × 1000` is an integer that divides back exactly; `fontFamily` (string
  or array); `fontWeight` numbers and the DTCG keywords (thin 100, extra-light 200, light 300,
  normal 400, medium 500, semi-bold 600, bold 700, extra-bold 800, black 900, extra-black 950, with
  their DTCG aliases); `number`; `cubicBezier`; `strokeStyle` keywords; `border`; `shadow` (a single
  object without `inset: true`); `typography`. Everything else (`rem`, other color spaces, `none`
  components, legacy string colors, `gradient`, `transition`, shadow lists, object stroke styles,
  `$ref`) is reported and left out.
- Tokens whose alias targets were left out are left out, repeatedly, until nothing changes; alias
  cycles are reported and left out.
- `$description` and `$deprecated` are kept; other `$extensions` are dropped and counted in the
  report.
- **Seeds and roles (finding D2)**: an optional mapping `{ "<target>": "<dtcg path>" }` where a
  target is `seed.<scheme>.background|foreground|accent`, `seed.font-family`, or a semantic baseline
  path. Seeds take the mapped token's literal value (following aliases); roles become aliases to the
  primitive. A scheme is supported when all three of its seeds are mapped; without any seeds the
  seed-only example's light seeds are used and reported.
- The theme gets `--id` or a fresh `uid.` identifier, `--name` or "Imported Tokens", version
  `1.0.0`, `provenance.origin` `imported`, and `compatibility.catalog` `1.0`. It is written only if
  Core validates it.
- `--restore-derivations` restores a kept derivation when every alias inside it maps to an imported
  token; otherwise the computed value stays.

## IR6. Safety and limits

- Import input is limited to the Theme Specification's document size (1 MiB) and nesting depth, is
  parsed with `JSON.parse` only, and nothing in it is executed. Alias resolution is iterative with a
  visited set. No network.

## IR7. Testing

- Export equals Core's resolved values for every token in every mode of both reference themes.
- Round trip: export, then import with a mapping of every baseline role that was exported; the
  imported theme is valid and resolves each mapped role to the same value.
- A DTCG corpus with every 2025.10 type and each unsupported variant; malformed and hostile inputs.
- A structural DTCG check (every token has a `$type` and a `$value` of that type's shape).
