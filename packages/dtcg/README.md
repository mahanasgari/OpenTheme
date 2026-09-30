# @opentheme/dtcg

OpenTheme ↔ [W3C Design Tokens Format Module 2025.10](https://www.designtokens.org/) interchange,
as the Theme Specification's chapter 16 defines it. Use it to take an OpenTheme theme into a design
tool, or to bring a design tool's tokens into OpenTheme.

Every exported value comes from OpenTheme Core, and every imported theme is validated by Core
before it is returned. Nothing is approximated: whatever one format cannot represent is left out
and listed in a report.

Status: `0.1.0-draft.0`, pre-release. Runtime dependency: `@opentheme/core` only.

## Export

```ts
import { createCore } from "@opentheme/core";
import { exportTheme } from "@opentheme/dtcg";

const core = createCore();
const { entry } = core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });
const result = exportTheme(core, entry!, { modes: [{ scheme: "dark", contrast: "standard" }] });
if (result.ok) {
  const dark = result.documents[0]?.document; // one DTCG document per mode
  console.log(JSON.stringify(dark).includes('"$type"')); // true
}
```

Each document holds the computed value of every token in that mode, with `$type`. A token the theme
declares as a derivation keeps it, as declared, under `$extensions["org.opentheme"].derive`.
Density values, system colors, and typography with a dimension line height have no DTCG form and
are reported.

## Import

```ts
import { importTokens } from "@opentheme/dtcg";

const result = importTokens(
  JSON.stringify({ brand: { $type: "color", ink: { $value: { colorSpace: "srgb", components: [0.1, 0.1, 0.12] } } } }),
  { mapping: { "color.text.primary": "brand.ink" }, name: "Brand" },
);
console.log(result.theme !== null, result.report.length); // true 2 (default seeds, default font)
```

- Tokens go under the reserved `primitive` group; aliases are rewritten.
- Names are lowercased and characters outside `[a-z0-9-]` become `-`; names that collide are left
  out.
- The optional mapping assigns seeds (`seed.light.background`, `seed.dark.accent`,
  `seed.font-family`, …) and semantic roles (`color.text.primary`, `space.4`, …) to token paths.
  Without seeds, the specification's example seeds are used and reported.
- Left out and reported: `rem`, colors outside `srgb` and `oklch`, `none` components, string colors,
  `gradient`, `transition`, shadow lists and inset shadows, object stroke styles, and `$ref`.
  Converted exactly and reported: seconds to milliseconds, font weight keywords.
- `restoreDerivations: true` restores kept derivations; by default the computed values are used,
  so an export-then-import round trip is exact.

## From the command line

`opentheme export <theme>` and `opentheme import <tokens.json> --out <theme.json>`; see
[`@opentheme/cli`](../cli/README.md).
