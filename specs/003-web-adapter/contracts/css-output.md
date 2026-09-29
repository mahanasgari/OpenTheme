# Contract: CSS Output (naming and serialization)

**Version**: `css-output 1.0` (versioned with `@opentheme/web`; FR-W002) | **Spec**:
[../spec.md](../spec.md) | **Research**: WR2, WR3, WR10

This is the adapter's public output contract. Stylesheets written against these names keep working
for every theme; a change to a name or a value format is a breaking change of `@opentheme/web`.

## Names

A **segment** is `[a-z0-9][a-z0-9-]*`: chapter 03's token segment grammar `[a-z][a-z0-9-]*`,
widened to the digit-led segments the semantic baseline itself uses (`space.0` to `space.9`;
finding W3). No segment contains `_`. A **host identifier** is dot-separated segments. Names are
built from the Resolved Theme's paths:

| Source | Name |
|---|---|
| Token `s1.s2.….sn` | `--ot-s1_s2_…_sn` |
| Host token `<host-id>/s1.….sn` | `--ot-<host-id with "." as "_">__s1_…_sn` |
| Composite member `m` of a token (camelCase, for example `fontSize`) | the token's name + `___` + `m` in kebab case (`font-size`) |
| Component property value | `--otc-<contract>_<part>_<property>_<state>` |
| Component variant value | `--otc-<contract>_v_<axis>_<value>_<part>_<property>_<state>` |
| Composite member of a component value | as above + `___` + member |

`<contract>` is the contract id with `/` written as `__` and `.` as `_` (for example `std/button`
is `std__button`; `com.example.notes/timeline` is `com_example_notes__timeline`).

Examples:

| Resolved path | Custom property |
|---|---|
| `color.text.primary` | `--ot-color_text_primary` |
| `text.body` (typography) member `fontSize` | `--ot-text_body___font-size` |
| `com.example.notes/color.rail` | `--ot-com_example_notes__color_rail` |
| `std/button` → `container` → `background` → `hover` | `--otc-std__button_container_background_hover` |
| `std/button` variant `emphasis=primary`, `label.color.default` | `--otc-std__button_v_emphasis_primary_label_color_default` |

**Injectivity**: `_` never occurs inside a segment, so runs of one, two, and three underscores
decode unambiguously; `--ot-` and `--otc-` never overlap. **Omissions**: a path containing a
segment outside the grammar is not written and is reported (finding W1).

## Values

| Resolved value | Written as |
|---|---|
| `{ srgb8: [r, g, b], alpha: 1 }` | `rgb(r g b)` |
| `{ srgb8: [r, g, b], alpha: a }` | `rgb(r g b / a)` |
| `{ system: role }` | the role's CSS system color: `Canvas`, `CanvasText`, `LinkText`, `ButtonFace`, `ButtonText`, `Highlight`, `HighlightText`, `GrayText`, `ButtonBorder` |
| `{ value: n, unit: "px" }` | `npx` |
| `{ value: n, unit: "ms" }` | `nms` |
| `{ number: n }` or `n` | `n` |
| `{ families: [...] }` | `"Name One", "Name Two", sans-serif`: generic families unquoted; other names double-quoted with `\` and `"` escaped |
| `[x1, y1, x2, y2]` (cubic Bézier) | `cubic-bezier(x1, y1, x2, y2)` |
| stroke style | `solid`, `dashed`, or `dotted` |
| border `{ width, style, color }` | `<width> <style> <color>`, and each member as its own property |
| shadow `{ offsetX, offsetY, blur, spread, color, inset }` | `[inset ]<x> <y> <blur> <spread> <color>`, and each member |
| typography `{ fontFamily, fontWeight, fontSize, lineHeight, letterSpacing }` | each member as its own property only |

Numbers are written in ECMAScript's shortest round-trip form; decoding recovers the exact value.
The `physical` flag of composites is not written (it only affects resolution). Any other value
shape is not written and is reported (finding W2).

## Stylesheet shape

```css
/* document scope */
:root { --ot-…: …; … }
/* element scope "sidebar" */
[data-opentheme-scope="sidebar"] { --ot-…: …; … }
```

Declarations are in name order (UTF-16 code units). The adapter owns one
`<style data-opentheme-scope="<id>">` element per scope; server rendering emits the same element,
optionally with a host-supplied `nonce`.

## Conformance

For every Core resolution fixture: serialize, then decode with this contract's inverse; the decoded
tokens and components are JCS-identical to Core's resolved `tokens` and `components`, excluding
reported omissions (FR-W050, constitution V).
