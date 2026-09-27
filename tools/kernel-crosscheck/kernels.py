"""Normative numeric kernels (chapter 05), Python reimplementation.

Uses only the Python standard library. Binary64 bit patterns via struct.
"""

from __future__ import annotations

import math
import struct


def to_bits(x: float) -> int:
    return struct.unpack(">Q", struct.pack(">d", x))[0]


def from_bits(bits: int) -> float:
    return struct.unpack(">d", struct.pack(">Q", bits & ((1 << 64) - 1)))[0]


def to_hex64(x: float) -> str:
    return f"{to_bits(x):016X}"


def from_hex64(hex_s: str) -> float:
    return from_bits(int(hex_s, 16))


def abs64(x: float) -> float:
    return from_bits(to_bits(x) & 0x7FFFFFFFFFFFFFFF)


def copysign(magnitude: float, sign_source: float) -> float:
    mag = to_bits(magnitude) & 0x7FFFFFFFFFFFFFFF
    sign = to_bits(sign_source) & 0x8000000000000000
    return from_bits(mag | sign)


TWO_60 = from_bits(0x43B0000000000000)  # 2^60 (was 2^61: finding F16)
TWO_NEG_60 = from_bits(0x3C30000000000000)


MIN_NORMAL = from_bits(0x0010000000000000)  # 2^-1022


def pow2(k: int) -> float:
    """2^k for k in [-1022, 1023], built from the exponent field."""
    return from_bits((k + 1023) << 52)


def ldexp(m: float, exp: int) -> float:
    """m x 2^exp rounded once (chapter 05): exact scaling while the result stays normal, then a
    single multiply, so a subnormal result is not double-rounded (finding F32)."""
    if m == 0.0 or not math.isfinite(m) or exp == 0:
        return m
    v = m
    e = int(exp)
    while e >= 60:
        v = v * TWO_60
        e -= 60
        if not math.isfinite(v):
            return v
    while e > 0:
        v = v * 2.0
        e -= 1
    while e <= -60 and abs(v) >= MIN_NORMAL * TWO_60:
        v = v * TWO_NEG_60
        e += 60
    if e == 0:
        return v
    if e >= -1022:
        return v * pow2(e)
    # |v| < 2^-962 here, so |v| x 2^e < 2^-1984: the correctly rounded result is zero.
    return copysign(0.0, v)
    while e <= -60:
        v = v * TWO_NEG_60
        e += 60
    while e > 0:
        v = v * 2.0
        e -= 1
    while e < 0:
        v = v / 2.0
        e += 1
    return v


def frexp(x: float) -> tuple[float, int]:
    a = abs64(x)
    if a == 0.0 or not math.isfinite(a):
        return x, 0
    bits = to_bits(a)
    exp_field = (bits >> 52) & 0x7FF
    frac_bits = bits & 0x000FFFFFFFFFFFFF
    if exp_field == 0:
        # Subnormal: each exact doubling lowers the exponent by one, starting from 2^0 (F16).
        v = a
        unbiased = 0
        while v < 1.0:
            v = v * 2.0
            unbiased -= 1
        return copysign(v, x), unbiased
    frac = from_bits(0x3FF0000000000000 | frac_bits)
    return copysign(frac, x), exp_field - 1023


# --- cbrt ---

THRESH = from_hex64("3C30000000000000")
C0 = from_hex64("3FF01B94FA5ED924")
C1 = from_hex64("4000824969BB1DA8")
C2 = from_hex64("C003334AEF7483EC")
C3 = from_hex64("40008503C420852F")
C4 = from_hex64("BFE79EAF86304017")


def _floor_div3(e: int) -> tuple[int, int]:
    q = e // 3
    r = e - 3 * q
    return q, r


def cbrt(x: float) -> float:
    if math.isnan(x) or x == 0.0 or not math.isfinite(x):
        return x
    a = abs64(x)
    if a < THRESH:
        return copysign(0.0, x)
    frac, exp = frexp(a)
    q, r = _floor_div3(exp)
    m = ldexp(abs64(frac), r)
    u = (m - 1.0) / 7.0  # chapter 05 step 5: division, not a rounded 1/7 (finding F21)
    y = C0 + u * (C1 + u * (C2 + u * (C3 + u * C4)))
    for _ in range(3):
        y2 = y * y
        y = (2.0 * y + m / y2) / 3.0
    return copysign(ldexp(y, q), x)


# --- log2 / exp2 ---

P0 = from_hex64("3FE55554F7DC5A64")
P1 = from_hex64("3FD99A9E1A61AC76")
P2 = from_hex64("3FD2187698D11CF1")
P3 = from_hex64("3FD1046AAFEC1971")
INV_LN2 = from_hex64("3FF71547652B82FE")
LN2 = from_hex64("3FE62E42FEFA39EF")


def log2(x: float) -> float:
    if math.isnan(x):
        return x
    if x < 0.0:
        return from_bits(0x7FF8000000000000)
    if x == 0.0:
        return float("-inf")
    if x == float("inf"):
        return float("inf")
    frac, exp = frexp(x)
    f = abs64(frac) - 1.0
    s = f / (2.0 + f)
    s2 = s * s
    p = P0 + s2 * (P1 + s2 * (P2 + s2 * P3))
    ln = 2.0 * s + s * s2 * p
    return exp + ln * INV_LN2


def exp2(x: float) -> float:
    if math.isnan(x):
        return x
    if x == float("inf"):
        return float("inf")
    if x == float("-inf"):
        return 0.0
    if x >= 1024.0:
        return float("inf")
    if x <= -1075.0:
        return 0.0
    n = math.floor(x + 0.5)
    f = x - n
    z = f * LN2
    total = 1.0
    term = 1.0
    for k in range(1, 11):
        term = (term * z) / k
        total = total + term
    return ldexp(total, int(n))


# --- sRGB ---

T_DECODE = from_hex64("3FA4B5DCC63F1412")
INV_12_92 = from_hex64("3FB3D0722149B580")
C_0_055 = from_hex64("3FAC28F5C28F5C29")
INV_1_055 = from_hex64("3FEE54EDCD0AEB60")
EXP_24 = from_hex64("4003333333333333")
T_ENCODE = from_hex64("3F69A5C37387B719")
C_12_92 = from_hex64("4029D70A3D70A3D7")
C_1_055 = from_hex64("3FF0E147AE147AE1")
INV_24 = from_hex64("3FDAAAAAAAAAAAAB")


def srgb_decode(c: float) -> float:
    if c <= T_DECODE:
        return c * INV_12_92
    return exp2(EXP_24 * log2((c + C_0_055) * INV_1_055))


def srgb_encode(c: float) -> float:
    if c <= T_ENCODE:
        return c * C_12_92
    return C_1_055 * exp2(log2(c) * INV_24) - C_0_055


# --- trig ---

DEG2RAD = from_hex64("3F91DF46A2529D39")
S0 = from_hex64("3FEFFFFFFED58092")
S1 = from_hex64("BFC555544672ACE7")
S2 = from_hex64("3F81107A54D6FD77")
S3 = from_hex64("BF2997B6DF01704C")
C0t = from_hex64("3FEFFFFFF580D854")
C1t = from_hex64("BFDFFFFB3A765E0D")
C2t = from_hex64("3FA55401C8A6FB6C")
C3t = from_hex64("BF564A42AE83C185")


def _reduce_degrees(d: float) -> float:
    if math.isnan(d) or not math.isfinite(d):
        return d
    if d == 0.0:
        return 0.0
    return d - 360.0 * math.floor(d / 360.0)


def _eval_sin_cos(x_deg: float) -> tuple[float, float]:
    rad = x_deg * DEG2RAD
    z = rad * rad
    s = rad * (S0 + z * (S1 + z * (S2 + z * S3)))
    c = C0t + z * (C1t + z * (C2t + z * C3t))
    return s, c


def _sin_cos_degrees(d: float) -> tuple[float, float]:
    if math.isnan(d) or not math.isfinite(d):
        return d, d
    r = _reduce_degrees(d)
    if r > 315.0:
        s, c = _eval_sin_cos(r - 360.0)
        return s, c
    if r > 225.0:
        s, c = _eval_sin_cos(270.0 - r)
        return -c, s
    if r > 135.0:
        s, c = _eval_sin_cos(r - 180.0)
        return -s, -c
    if r > 45.0:
        s, c = _eval_sin_cos(90.0 - r)
        return c, s
    s, c = _eval_sin_cos(r)
    return s, c


def sin_deg(d: float) -> float:
    return _sin_cos_degrees(d)[0]


def cos_deg(d: float) -> float:
    return _sin_cos_degrees(d)[1]


KERNELS = {
    "cbrt": cbrt,
    "log2": log2,
    "exp2": exp2,
    "srgb-decode": srgb_decode,
    "srgb-encode": srgb_encode,
    "sin": sin_deg,
    "cos": cos_deg,
}


def apply_kernel(name: str, x: float) -> float:
    return KERNELS[name](x)
