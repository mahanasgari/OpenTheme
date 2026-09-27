# Contract: Transformations and Numeric Kernels

**Normative sources after implementation**: `specification/registry/1.0/transformations.json`
(signatures, domains, costs), `specification/spec/04-transformations.md`, and
`specification/spec/05-numeric-kernels.md` (algorithms and constants), plus kernel golden vectors in
`conformance/fixtures/kernels/`. Decisions: [research.md](../research.md) R6–R9 and R15.

## Common rules (FR-018)

- **Form**: `{ "$derive": { "op": <id>, "args": { <name>: <operand> } } }`. An operand is a
  literal, an alias, or a nested derivation. Nesting depth is at most 8.
- **Arguments**: every argument listed below is required unless marked optional. Unknown
  arguments are errors.
- **Domains**: validation evaluates every derivation in every declared mode using the theme's own
  values. Any operand outside its domain, whether a literal or a token value, is an error
  (`OT-DRV-004`). At resolution, an operand that depends on a user value is clamped into the
  domain, with an informational diagnostic (`OT-DRV-102`). This keeps every transformation total,
  so a permitted user value can never make a valid theme fail.
- **Output**: always a valid value of the output type. Numeric and dimension outputs are clamped
  to the target token's registry range, if any, with an informational diagnostic (`OT-DRV-101`).
  Colors are gamut-mapped to sRGB and quantized only in the final resolution stage, but
  contrast-aware operations quantize their own candidates internally before measuring.
- **Color computation**: in OKLab with IEEE 754 binary64, basic operations only, no fused
  multiply-add, and the normative kernels below. Alpha is premultiplied where blending occurs.
- **Contrast**: the WCAG 2.2 ratio on quantized sRGB (research R8). Translucent colors are
  composited onto each background first.
- **Cost**: every application adds its effort units to the per-mode budget of 200,000 (research
  R15).

## Color transformations

| `op` | Arguments (type, domain) | Output | Semantics | Cost |
|---|---|---|---|---|
| `color.mix` | `color` color; `toward` color; `ratio` number [0, 1] | color | Linear interpolation in premultiplied OKLab from `color` (ratio 0) to `toward` (ratio 1) | 1 |
| `color.lightness` | `color` color; `delta` number [−1, 1] | color | L′ = clamp(L + delta, 0, 1); chroma and hue kept, then gamut-mapped | 1 |
| `color.chroma` | `color` color; `factor` number [0, 4] | color | a′ = a × factor, b′ = b × factor, then gamut-mapped | 1 |
| `color.hue` | `color` color; `degrees` number [−360, 360] | color | Rotates (a, b) by `degrees` using the kernel sine and cosine | 1 |
| `color.alpha` | `color` color; `alpha` number [0, 1] | color | Replaces alpha | 1 |
| `color.composite` | `color` color; `backdrop` opaque color | opaque color | Source-over in gamma-encoded sRGB (what renderers display) | 1 |
| `color.contrast-select` | `backgrounds` 1–4 opaque colors; `candidates` 1–8 colors; `target` number [1, 21] | color | The first candidate whose minimum contrast across backgrounds meets `target`. If none does, the candidate with the highest minimum contrast (earliest on a tie) | 12 |
| `color.contrast-adjust` | `color` color; `backgrounds` 1–4 opaque colors; `target` number [1, 21] | color | See algorithm A1 | 48 |
| `color.mix-bounded` | `color` color; `toward` color; `ratio` number [0, 1]; `reference` opaque color; `minimum` number [1, 21] | color | See algorithm A2 | 48 |

**A1 `color.contrast-adjust`**:

1. If `color` already meets `target` against every background, return it.
2. Otherwise compute the two lightness endpoints (L = 0 and L = 1, gamut-mapped). Choose the
   endpoint with the higher minimum contrast; on a tie, choose the darker one.
3. If that endpoint misses `target`, return the endpoint. This is "the most legible achievable".
4. Otherwise bisect lightness between the input and the endpoint for exactly 32 iterations,
   quantizing each probe, and return the passing probe closest to the input.

**A2 `color.mix-bounded`**:

1. Let m(t) = `color.mix(color, toward, t)`.
2. If m(`ratio`) meets `minimum` against `reference`, return it.
3. Otherwise, if m(0) misses `minimum`, return `color` unchanged.
4. Otherwise bisect t in [0, `ratio`] for exactly 32 iterations and return the largest passing t.

**Guarantee used by the specification defaults (research R10)**: against a single opaque
background, `color.contrast-adjust` reaches any target up to 4.5 for every input, because black or
white achieves at least 4.58:1 against any color. Enhanced targets (7:1) are reached by the
high-contrast defaults because they first push the background to its extreme.

## Number and dimension transformations

| `op` | Arguments | Output | Semantics | Cost |
|---|---|---|---|---|
| `number.scale` | `value` number; `factor` number [0, 100] | number | value × factor | 1 |
| `number.add` | `value` number; `delta` number [−10⁶, 10⁶] | number | value + delta | 1 |
| `number.clamp` | `value` number; `min` number; `max` number (min ≤ max) | number | min(max(value, min), max) | 1 |
| `dimension.scale` | `value` dimension; `factor` number [0, 100] | dimension | Scales `value.value` | 1 |
| `dimension.add` | `value` dimension; `delta` dimension | dimension | Adds values (unit `px`) | 1 |
| `dimension.clamp` | `value`, `min`, `max` dimensions (min ≤ max) | dimension | Clamps | 1 |
| `dimension.round` | `value` dimension; `step` dimension > 0 | dimension | Nearest multiple of `step`, ties to the even multiple | 1 |

A literal-operand violation (e.g., `min > max`, or `ratio` = 1.5) is `OT-DRV-004` at validation.

## Normative numeric kernels (research R7)

| Kernel | Used by | Definition requirements |
|---|---|---|
| `cbrt` | sRGB → OKLab | Sign-symmetric; exact power-of-8 range reduction; fixed initial polynomial; fixed number of Newton steps; defined result 0 for magnitudes below 2⁻⁶⁰ |
| `log2`, `exp2` | sRGB transfer | Exact power-of-2 range reduction; fixed-degree polynomials with published binary64 coefficients |
| `srgb-decode`, `srgb-encode` | Contrast, OKLab conversion, output | Piecewise transfer (threshold 0.04045 / 0.0031308, exponent 2.4) built from `log2` and `exp2` |
| `sin`, `cos` | `color.hue` | Degrees reduced with exact `fmod` by 360, then to [−45°, 45°] by quadrant; fixed-degree polynomials |

- **Constants**: the OKLab matrices are the binary64 constants of CSS Color Module Level 4 and are
  republished in the specification.
- **Golden vectors**: each kernel has at least 1,000 golden vectors, with inputs and outputs as
  hexadecimal binary64, including range edges and subnormal inputs.
- **Conformance**: an implementation conforms only if it reproduces every vector bit for bit.
  Platform math functions MUST NOT be substituted.

## Gamut mapping and quantization

- **Gamut mapping**: OKLCH chroma reduction with a just-noticeable-difference test of 0.02, a
  linear-sRGB clip step, and exactly 24 bisection iterations over a chroma scale factor. The
  normative pseudocode is in chapter 05 (it is CSS Color 4–style, not the CSS pseudocode itself).
- **Quantization**: channel = round-half-even(clamp(c, 0, 1) × 255) / 255, and alpha =
  round-half-even(alpha × 1000) / 1000.
