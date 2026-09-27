# 05. Numeric Kernels

**Status**: Normative. Research R6, R7. Golden vectors: `conformance/fixtures/kernels/`.

## Computation model

All normative numeric work uses IEEE 754 binary64 **basic** operations only (+, −, ×, ÷,
square root). Implementations MUST NOT use fused multiply-add (FMA) or extended-precision
intermediates for normative results.

Platform math libraries MUST NOT substitute for the kernels below. Conformance requires
bit-exact reproduction of every golden vector in `conformance/fixtures/kernels/`.

Hexadecimal binary64 literals below are 16 uppercase hex digits encoding the big-endian IEEE
754 bit pattern. The helper `fromHex64` / `toHex64` converts between a binary64 value and that
encoding.

## Shared bit helpers

Let `bits(x)` be the `uint64` big-endian encoding of binary64 `x`, and `float(b)` the inverse.

- `toHex64(x)` = lowercase-insensitive hex of `bits(x)`, always written uppercase, width 16.
- `fromHex64(h)` = `float(parseHex(h))`.
- `abs(x)` = `|x|` (sign bit cleared).
- `copysign(m, s)` = magnitude of `m` with the sign bit of `s`.
- `ldexp(m, e)` for finite nonzero `m` adjusts the unbiased exponent of `m` by the integer `e`
  (clamping through underflow to signed zero and overflow to signed infinity). Equivalently
  `m × 2^e` computed only via exponent-field arithmetic, never via a platform power function.
  The result is rounded once (round half to even): a subnormal result is the correctly rounded
  `m × 2^e`, never the result of repeated halving.

## Kernel: `cbrt`

**Rule**: `R-KRN-001`. Used by sRGB → OKLab.

1. If `x` is NaN, ±∞, or ±0, return `x`.
2. Let `sign = copysign(1, x)` and `a = abs(x)`.
3. If `a < fromHex64("3C30000000000000")` (that is, `2⁻⁶⁰`), return `copysign(0, x)`.
4. Let `e` be the unbiased binary exponent of `a` and `frac` its significand in `[1, 2)`.
   Write `e = 3q + r` with integer `q` and remainder `r ∈ {0,1,2}` (floor division).
   Set `m = ldexp(frac, r)` so `m ∈ [1, 8)` and `a = m × 8^q`.
5. Let `u = (m − 1) / 7`. Evaluate the degree-4 Horner polynomial with coefficients
   (low degree first):

   | i | hex | decimal |
   |---|---|---|
   | 0 | `3FF01B94FA5ED924` | 1.0067338733766258 |
   | 1 | `4000824969BB1DA8` | 2.063616586706946 |
   | 2 | `C003334AEF7483EC` | −2.400045271628633 |
   | 3 | `40008503C420852F` | 2.0649485895561592 |
   | 4 | `BFE79EAF86304017` | −0.738120805823203 |

   Call the result `y`.
6. Perform **exactly three** Newton iterations for the real cube root:
   `y ← (2y + m / (y × y)) / 3`.
7. Return `sign × ldexp(y, q)`.

## Kernel: `log2`

**Rule**: `R-KRN-002`. Domain: `x > 0` for normative color work. Special cases:

- NaN → NaN; `x < 0` → NaN; `+0`/`−0` → −∞; `+∞` → `+∞`.

For finite `x > 0`:

1. Write `x = 2^k × (1 + f)` with integer `k` and `f ∈ [0, 1)`.
2. Let `s = f / (2 + f)` and `s2 = s × s`.
3. Evaluate `P(s2)` as a degree-3 Horner polynomial (low degree first):

   | i | hex | decimal |
   |---|---|---|
   | 0 | `3FE55554F7DC5A64` | 0.6666664925604207 |
   | 1 | `3FD99A9E1A61AC76` | 0.40006210876771975 |
   | 2 | `3FD2187698D11CF1` | 0.2827431194641142 |
   | 3 | `3FD1046AAFEC1971` | 0.26589457683475987 |

4. Let `ln = 2s + s × s2 × P(s2)`.
5. Return `k + ln × fromHex64("3FF71547652B82FE")` (`1 / ln(2)`).

## Kernel: `exp2`

**Rule**: `R-KRN-003`. Special cases: NaN → NaN; `+∞` → `+∞`; `−∞` → `+0`.

For finite `x`:

1. If `x ≥ 1024`, return `+∞`. If `x ≤ −1075`, return `+0`.
2. Let `n = floor(x + 0.5)` (half toward +∞), then `f = x − n`, so `f ∈ (−0.5, 0.5]`.
3. Let `z = f × fromHex64("3FE62E42FEFA39EF")` (`ln(2)`).
4. Compute the Taylor sum with **exactly ten** multiplicative updates after the constant 1:
   start with `sum = 1` and `term = 1`; for `k = 1…10`: `term ← term × z / k`,
   `sum ← sum + term`.
5. Return `ldexp(sum, n)`.

## Kernel: `srgb-decode`

**Rule**: `R-KRN-004`. Input channel `c` is treated as a binary64 value.

- Let `T = fromHex64("3FA4B5DCC63F1412")` (`0.04045`).
- If `c ≤ T`, return `c × fromHex64("3FB3D0722149B580")` (`1/12.92`).
- Otherwise return
  `exp2(fromHex64("4003333333333333") × log2((c + fromHex64("3FAC28F5C28F5C29")) × fromHex64("3FEE54EDCD0AEB60")))`
  that is `exp2(2.4 × log2((c + 0.055) / 1.055))`.

## Kernel: `srgb-encode`

**Rule**: `R-KRN-005`.

- Let `U = fromHex64("3F69A5C37387B719")` (`0.0031308`).
- If `c ≤ U`, return `c × fromHex64("4029D70A3D70A3D7")` (`12.92`).
- Otherwise return
  `fromHex64("3FF0E147AE147AE1") × exp2(log2(c) × fromHex64("3FDAAAAAAAAAAAAB")) − fromHex64("3FAC28F5C28F5C29")`
  that is `1.055 × exp2(log2(c) / 2.4) − 0.055`.

## Kernels: `sin`, `cos` (degrees)

**Rules**: `R-KRN-006`, `R-KRN-007`. Argument is an angle in **degrees**.

1. Reduce `d` into `[0, 360)`. First, if `d` is ±0, treat it as `+0`. Then
   `r = d − 360 × floor(d / 360)` (for any other finite `d`; NaN/±∞ propagate).
2. Map into a quadrant and a reduced angle `x ∈ [−45, 45]`:

   | range of `r` | quadrant note | reduced `x` | `sin` | `cos` |
   |---|---|---|---|---|
   | `[0, 45]` | 1a | `r` | `+S(x)` | `+C(x)` |
   | `(45, 135]` | 1b/2a | `90 − r` | `+C(x)` | `+S(x)` with sign of cos from quadrant |
   | `(135, 225]` | 2b/3a | `r − 180` | `−S(x)` | `−C(x)` |
   | `(225, 315]` | 3b/4a | `270 − r` | `−C(x)` | `+S(x)` (cos sign + in Q4) |
   | `(315, 360)` | 4b | `r − 360` | `+S(x)` | `+C(x)` |

   Normative procedure (identical results):

   ```text
   if r > 315:           x = r - 360;   sin =  S(x); cos =  C(x)
   else if r > 225:      x = 270 - r;   sin = -C(x); cos =  S(x)
   else if r > 135:      x = r - 180;   sin = -S(x); cos = -C(x)
   else if r > 45:       x = 90 - r;    sin =  C(x); cos =  S(x)
   else:                 x = r;         sin =  S(x); cos =  C(x)
   ```

3. Let `rad = x × fromHex64("3F91DF46A2529D39")` (`π/180`).
4. Let `z = rad × rad`.
5. `S(x)` (odd polynomial in `rad`):
   `S = rad × (S0 + z × (S1 + z × (S2 + z × S3)))` with

   | | hex | decimal |
   |---|---|---|
   | S0 | `3FEFFFFFFED58092` | 0.9999999978281429 |
   | S1 | `BFC555544672ACE7` | −0.16666654052583071 |
   | S2 | `3F81107A54D6FD77` | 0.008332210268121127 |
   | S3 | `BF2997B6DF01704C` | −0.00019525630296157931 |

6. `C(x)` (even polynomial):
   `C = C0 + z × (C1 + z × (C2 + z × C3))` with

   | | hex | decimal |
   |---|---|---|
   | C0 | `3FEFFFFFF580D854` | 0.9999999804483743 |
   | C1 | `BFDFFFFB3A765E0D` | −0.49999886235443186 |
   | C2 | `3FA55401C8A6FB6C` | 0.04165654730194643 |
   | C3 | `BF564A42AE83C185` | −0.0013604785145241171 |

`sin(d)` returns the `sin` column; `cos(d)` returns the `cos` column.

## OKLab matrices

The OKLab matrices are the binary64 constants of CSS Color Module Level 4, republished here.
Each cell is `fromHex64` of the given hex (decimal shown for readability).

Linear sRGB → LMS:

| | R | G | B |
|---|---|---|---|
| L | `3FDA61D629F2E197` (0.4122214708) | `3FE129A2D9E60E32` (0.5363325363) | `3FAA572112081026` (0.0514459929) |
| M | `3FCB1FA76156A7C5` (0.2119034982) | `3FE5C84A69936914` (0.6806995451) | `3FBB7E5DF0497455` (0.1073969566) |
| S | `3FB69AFD7A044C17` (0.0883024619) | `3FD207AE728A2F45` (0.2817188376) | `3FE428C9177A5EDB` (0.6299787005) |

LMS′ (after `cbrt`) → OKLab:

| | L′ | M′ | S′ |
|---|---|---|---|
| L | `3FCAF02A3FE8A4FA` (0.2104542553) | `3FE9655120032AAD` (0.7936177850) | `BF70ADD9BD572B38` (−0.0040720468) |
| a | `3FFFA5E1BFFFDE12` (1.9779984951) | `C0036DC1BFFE5D3E` (−2.4285922050) | `3FDCD686FFF371A5` (0.4505937099) |
| b | `3F9A869680B729E0` (0.0259040371) | `3FE90C776001F502` (0.7827717662) | `BFE9E0AC0001353D` (−0.8086757660) |

OKLab → LMS′:

| | L | a | b |
|---|---|---|---|
| L′ | `3FF0000000000000` (1) | `3FD95D9920068C8A` (0.3963377774) | `3FCB9F751FFA8CC8` (0.2158037573) |
| M′ | `3FF0000000000000` (1) | `BFBB06117FEEC881` (−0.1055613458) | `BFB058BF3FE39E34` (−0.0638541728) |
| S′ | `3FF0000000000000` (1) | `BFB6E86F5FDF38B5` (−0.0894841775) | `BFF4A9ECBFFEAA8D` (−1.2914855480) |

LMS → linear sRGB:

| | L | M | S |
|---|---|---|---|
| R | `40104E955DC3D73A` (4.0767416621) | `C00A76317EA9DE73` (−3.3077115913) | `3FCD906C3222FFEF` (0.2309699292) |
| G | `BFF44B85A62C2AFF` (−1.2684380046) | `4004E0C87D01BF65` (2.6097574011) | `BFD5D82D4F5D4F2A` (−0.3413193965) |
| B | `BF712FEA56E00671` (−0.0041960863) | `BFE68267C131178D` (−0.7034186147) | `3FFB5263CAEF6BCD` (1.7076147010) |

## Gamut mapping

Out-of-gamut colors are mapped to sRGB by OKLCH chroma reduction with a just-noticeable
difference (JND) of `0.02`, in the spirit of CSS Color Module Level 4. The normative algorithm is
the one below; it differs from the CSS pseudocode (lightness is clamped rather than shortcut to
white or black, the gamut test uses linear sRGB, and the bisection runs over a chroma scale factor
with no early exit). Every step uses binary64 basic operations and the kernels above.

Definitions, for an OKLab color `c = (L, a, b)`:

- `lin(c)`: OKLab → LMS′ (matrix above), cube each channel (`x × x × x`), then LMS → linear
  sRGB. Each matrix row is evaluated as `row0 × x + row1 × y + row2 × z`, left to right.
- `inGamut(c)`: every channel of `lin(c)` lies in `[0, 1]` (inclusive, no tolerance).
- `clip(c)`: clamp each channel of `lin(c)` to `[0, 1]`, then linear sRGB → LMS → `cbrt` →
  OKLab.
- `ΔE(p, q)`: `sqrt(ΔL² + Δa² + Δb²)` in OKLab.

```text
gamutMap(L, a, b):
  L ← clamp(L, 0, 1)
  start ← (L, a, b)
  if inGamut(start): return start
  c0 ← clip(start)
  if ΔE(c0, start) < 0.02: return c0
  lo ← 0; hi ← 1; best ← c0
  repeat exactly 24 times:
    t ← (lo + hi) / 2
    cand ← (L, a × t, b × t)
    if inGamut(cand):
      best ← cand; lo ← t
    else:
      cl ← clip(cand)
      if ΔE(cl, cand) < 0.02: best ← cl; lo ← t
      else: hi ← t
  if inGamut(best): return best
  return clip(best)
```

The mapped color is converted for output as `srgbEncode` of each channel of `lin(result)`, then
quantized (below); quantization clamps any residual excursion outside `[0, 1]`.

## Quantization

- Channel: `roundHalfEven(clamp(c, 0, 1) × 255) / 255`
- Alpha: `roundHalfEven(alpha × 1000) / 1000`

`roundHalfEven` is round-ties-to-even on the binary64 value, implemented without `Math.round`.

## Conformance

Golden vectors under `conformance/fixtures/kernels/` have `kind` `"kernel"` and
`expect.vectors` as an array of `[function, inputHex, outputHex]`. A conforming implementation
returns bit-identical `outputHex` for every entry. Rules `R-KRN-001`…`R-KRN-007` bind each
kernel.
