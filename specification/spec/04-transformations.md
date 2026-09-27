# 04. Transformations

**Status**: Normative. Full signatures: `specification/registry/1.0/transformations.json`.

## Common rules (FR-018)

Form: `{ "$derive": { "op": <id>, "args": { <name>: <operand> } } }`. Operands are literals,
aliases, or nested derivations (depth ≤ 8).

Validation evaluates every derivation in every declared mode using the theme's own values.
Literal operands outside a domain are `OT-DRV-004`. At resolution, user-dependent operands are
clamped into domain with `OT-DRV-102`. Outputs clamp to token ranges with `OT-DRV-101`.

Color computation is in OKLab with normative kernels. Contrast uses WCAG 2.2 on quantized sRGB.
Effort costs sum per mode; budget is 200,000 units (`OT-DRV-007`).

## Operations

The sixteen operations and costs are those in the transformations registry and
contracts/transformations.md: nine color ops (including `color.contrast-select` cost 12,
`color.contrast-adjust` and `color.mix-bounded` cost 48) and seven number/dimension ops.

## Normative color algorithms

Colors are OKLab with straight alpha. `gamutMap` and `lin` are defined in chapter 05. `q(c)` is the
quantized sRGB of `c`: `gamutMap(c)`, then `srgbEncode` of each channel of `lin`, then chapter 05
quantization (channels as `k / 255`). `minC(c, B)` is the minimum over backgrounds `b ∈ B` of the
WCAG 2.2 ratio between `q(c)` and `q(b)` (a translucent `q(c)` is composited source-over onto the
opaque `q(b)` first, then quantized). `meets(c, B, t)` is `minC(c, B) ≥ t`.
`clamp(x, lo, hi)` returns `lo` if `x < lo`, `hi` if `x > hi`, else `x`.

```text
color.mix(c, d, r):
  t ← clamp(r, 0, 1); w0 ← c.alpha × (1 − t); w1 ← d.alpha × t; α ← w0 + w1
  if α = 0: return (0, 0, 0, alpha 0)
  return ((c.L × w0 + d.L × w1) / α, (c.a × w0 + d.a × w1) / α, (c.b × w0 + d.b × w1) / α, α)

color.lightness(c, δ): return gamutMap(clamp(c.L + δ, 0, 1), c.a, c.b) with alpha c.alpha
color.chroma(c, f):    return gamutMap(c.L, c.a × f, c.b × f) with alpha c.alpha
color.hue(c, deg):     s ← sin(deg); k ← cos(deg)   (degree kernels, chapter 05)
                       return gamutMap(c.L, c.a × k − c.b × s, c.a × s + c.b × k) with alpha c.alpha
color.alpha(c, x):     return (c.L, c.a, c.b, alpha clamp(x, 0, 1))
color.composite(c, bd):
  s ← q(c); g ← q(bd)
  per channel: o ← s × s.alpha + g × (1 − s.alpha)      (gamma-encoded, not re-quantized)
  return the OKLab of the gamma-encoded sRGB o, alpha 1

color.contrast-select(B, C, t):
  best ← C[0]; bestMin ← minC(C[0], B)
  for each cand in C (in order):
    m ← minC(cand, B); if m ≥ t: return cand
    if m > bestMin: best ← cand; bestMin ← m
  return best
```

## Algorithm A1 — `color.contrast-adjust`

```text
color.contrast-adjust(c, B, t):
  if meets(c, B, t): return c
  e0 ← gamutMap(0, c.a, c.b); e1 ← gamutMap(1, c.a, c.b)      (alpha c.alpha)
  m0 ← minC(e0, B); m1 ← minC(e1, B)
  end ← e0 if m0 > m1; e1 if m1 > m0; on a tie the one with the smaller L (e0 if equal)
  if not meets(end, B, t): return end                          (most legible achievable)
  lo ← c.L; hi ← end.L; best ← end
  repeat exactly 32 times:
    mid ← (lo + hi) / 2; probe ← gamutMap(mid, c.a, c.b) with alpha c.alpha
    if meets(probe, B, t):
      best ← probe
      if end.L > c.L: hi ← mid else lo ← mid                   (move toward the input)
    else if end.L > c.L: lo ← mid
    else: hi ← mid
  return best
```

Note that the bisection interval ends at the lightness of the gamut-mapped endpoint (`end.L`),
which can differ from 0 or 1 after clipping.

## Algorithm A2 — `color.mix-bounded`

```text
color.mix-bounded(c, d, r, ref, min):
  full ← color.mix(c, d, r); if meets(full, [ref], min): return full
  if not meets(color.mix(c, d, 0), [ref], min): return c
  lo ← 0; hi ← r; best ← color.mix(c, d, 0)
  repeat exactly 32 times:
    mid ← (lo + hi) / 2; probe ← color.mix(c, d, mid)
    if meets(probe, [ref], min): best ← probe; lo ← mid else hi ← mid
  return best
```
