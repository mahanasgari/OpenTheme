/**
 * Color model (research R6, R8; chapter 05): OKLab internally, CSS Color 4 gamut mapping with a
 * fixed iteration bound, 8-bit sRGB quantization, and WCAG 2.2 contrast on quantized values.
 * Only binary64 basic operations and the normative kernels are used.
 */
import { cbrt, fromHex64, roundHalfEven, sinCosDegrees, srgbDecode, srgbEncode } from "../kernels/index.js";

/** A color in OKLab with straight (non-premultiplied) alpha. */
export interface Lab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
  readonly alpha: number;
}

/** A quantized sRGB color: 8-bit channels and alpha in multiples of 0.001. */
export interface Srgb8 {
  readonly srgb8: readonly [number, number, number];
  readonly alpha: number;
}

const h = fromHex64;
// Linear sRGB → LMS
const M1 = [
  [h("3FDA61D629F2E197"), h("3FE129A2D9E60E32"), h("3FAA572112081026")],
  [h("3FCB1FA76156A7C5"), h("3FE5C84A69936914"), h("3FBB7E5DF0497455")],
  [h("3FB69AFD7A044C17"), h("3FD207AE728A2F45"), h("3FE428C9177A5EDB")],
] as const;
// LMS′ → OKLab
const M2 = [
  [h("3FCAF02A3FE8A4FA"), h("3FE9655120032AAD"), h("BF70ADD9BD572B38")],
  [h("3FFFA5E1BFFFDE12"), h("C0036DC1BFFE5D3E"), h("3FDCD686FFF371A5")],
  [h("3F9A869680B729E0"), h("3FE90C776001F502"), h("BFE9E0AC0001353D")],
] as const;
// OKLab → LMS′
const M3 = [
  [h("3FF0000000000000"), h("3FD95D9920068C8A"), h("3FCB9F751FFA8CC8")],
  [h("3FF0000000000000"), h("BFBB06117FEEC881"), h("BFB058BF3FE39E34")],
  [h("3FF0000000000000"), h("BFB6E86F5FDF38B5"), h("BFF4A9ECBFFEAA8D")],
] as const;
// LMS → linear sRGB
const M4 = [
  [h("40104E955DC3D73A"), h("C00A76317EA9DE73"), h("3FCD906C3222FFEF")],
  [h("BFF44B85A62C2AFF"), h("4004E0C87D01BF65"), h("BFD5D82D4F5D4F2A")],
  [h("BF712FEA56E00671"), h("BFE68267C131178D"), h("3FFB5263CAEF6BCD")],
] as const;

type Row = readonly [number, number, number];
type Mat = readonly [Row, Row, Row];

function mul(m: Mat, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

/** Gamma-encoded sRGB channels → OKLab (L, a, b). */
export function srgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const [l, m, s] = mul(M1, srgbDecode(r), srgbDecode(g), srgbDecode(b));
  return mul(M2, cbrt(l), cbrt(m), cbrt(s));
}

/** OKLab → gamma-encoded sRGB channels (unclipped). */
export function oklabToSrgb(L: number, a: number, b: number): [number, number, number] {
  const [l1, m1, s1] = mul(M3, L, a, b);
  const [r, g, bl] = mul(M4, l1 * l1 * l1, m1 * m1 * m1, s1 * s1 * s1);
  return [srgbEncode(r), srgbEncode(g), srgbEncode(bl)];
}

/** OKLCH (L, C, hue degrees) → OKLab. */
export function oklchToOklab(L: number, C: number, hue: number): [number, number, number] {
  const [sin, cos] = sinCosDegrees(hue);
  return [L, C * cos, C * sin];
}

export interface ColorLiteral {
  readonly colorSpace: "srgb" | "oklch";
  readonly components: readonly [number, number, number];
  readonly alpha?: number;
}

export function fromLiteral(c: ColorLiteral): Lab {
  const alpha = c.alpha ?? 1;
  const [x, y, z] = c.components;
  const [L, a, b] =
    c.colorSpace === "oklch" ? oklchToOklab(x, y, z) : srgbToOklab(x, y, z);
  return { L, a, b, alpha };
}

export function fromSrgb8(c: Srgb8): Lab {
  const [L, a, b] = srgbToOklab(c.srgb8[0] / 255, c.srgb8[1] / 255, c.srgb8[2] / 255);
  return { L, a, b, alpha: c.alpha };
}

const JND = 0.02;
const GAMUT_ITERATIONS = 24;

/** OKLab → linear sRGB (chapter 05 `lin`), unclipped. */
export function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const [l1, m1, s1] = mul(M3, L, a, b);
  return mul(M4, l1 * l1 * l1, m1 * m1 * m1, s1 * s1 * s1);
}

export function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const [l, m, s] = mul(M1, r, g, b);
  return mul(M2, cbrt(l), cbrt(m), cbrt(s));
}

function inGamut(L: number, a: number, b: number): boolean {
  const [r, g, bl] = oklabToLinear(L, a, b);
  return r >= 0 && r <= 1 && g >= 0 && g <= 1 && bl >= 0 && bl <= 1;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function clip(L: number, a: number, b: number): [number, number, number] {
  const [r, g, bl] = oklabToLinear(L, a, b);
  return linearToOklab(clamp01(r), clamp01(g), clamp01(bl));
}

function deltaE(p: readonly number[], q: readonly number[]): number {
  const dL = p[0]! - q[0]!;
  const da = p[1]! - q[1]!;
  const db = p[2]! - q[2]!;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Gamut mapping to sRGB exactly as the normative pseudocode in chapter 05 ("Gamut mapping"):
 * clamp L, test in linear sRGB, clip in linear sRGB, and bisect a chroma scale factor for exactly
 * 24 iterations. Returns the mapped color in OKLab.
 */
export function gamutMapOklab(L0: number, a: number, b: number): [number, number, number] {
  const L = L0 < 0 ? 0 : L0 > 1 ? 1 : L0;
  const start: [number, number, number] = [L, a, b];
  if (inGamut(L, a, b)) return start;
  const c0 = clip(L, a, b);
  if (deltaE(c0, start) < JND) return c0;
  let lo = 0;
  let hi = 1;
  let best: [number, number, number] = c0;
  for (let i = 0; i < GAMUT_ITERATIONS; i += 1) {
    const t = (lo + hi) / 2;
    const cand: [number, number, number] = [L, a * t, b * t];
    if (inGamut(cand[0], cand[1], cand[2])) {
      best = cand;
      lo = t;
      continue;
    }
    const cl = clip(cand[0], cand[1], cand[2]);
    if (deltaE(cl, cand) < JND) {
      best = cl;
      lo = t;
    } else {
      hi = t;
    }
  }
  if (inGamut(best[0], best[1], best[2])) return best;
  return clip(best[0], best[1], best[2]);
}

/** Gamut-map, then encode to gamma sRGB channels (may slightly exceed [0, 1]; quantize clamps). */
export function gamutMap(L: number, a: number, b: number): [number, number, number] {
  const [mL, ma, mb] = gamutMapOklab(L, a, b);
  const [r, g, bl] = oklabToLinear(mL, ma, mb);
  return [srgbEncode(r), srgbEncode(g), srgbEncode(bl)];
}

export function quantizeChannel(c: number): number {
  const v = c < 0 ? 0 : c > 1 ? 1 : c;
  return roundHalfEven(v * 255);
}

export function quantizeAlpha(alpha: number): number {
  return roundHalfEven(alpha * 1000) / 1000;
}

/** Gamut-map and quantize an OKLab color for output (research R6). */
export function quantize(c: Lab): Srgb8 {
  const [r, g, b] = gamutMap(c.L, c.a, c.b);
  return {
    srgb8: [quantizeChannel(r), quantizeChannel(g), quantizeChannel(b)],
    alpha: quantizeAlpha(c.alpha),
  };
}

const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722;

/** WCAG 2.2 relative luminance of an opaque quantized color. */
export function luminance(c: Srgb8): number {
  return (
    LUM_R * srgbDecode(c.srgb8[0] / 255) +
    LUM_G * srgbDecode(c.srgb8[1] / 255) +
    LUM_B * srgbDecode(c.srgb8[2] / 255)
  );
}

/** Source-over in gamma-encoded sRGB onto an opaque backdrop (color.composite). */
export function compositeOver(fg: Srgb8, backdrop: Srgb8): Srgb8 {
  const alpha = fg.alpha;
  const ch = (i: 0 | 1 | 2) => {
    const v = (fg.srgb8[i] / 255) * alpha + (backdrop.srgb8[i] / 255) * (1 - alpha);
    return quantizeChannel(v);
  };
  return { srgb8: [ch(0), ch(1), ch(2)], alpha: 1 };
}

/**
 * WCAG 2.2 contrast ratio on quantized values (research R8). The background is opaque; a
 * translucent foreground is composited onto it (source-over) and re-quantized first.
 */
export function contrastRatio(fg: Srgb8, bg: Srgb8): number {
  const opaqueBg: Srgb8 = { srgb8: bg.srgb8, alpha: 1 };
  const solidFg = fg.alpha < 1 ? compositeOver(fg, opaqueBg) : fg;
  const l1 = luminance(solidFg);
  const l2 = luminance(opaqueBg);
  const hi = l1 > l2 ? l1 : l2;
  const lo = l1 > l2 ? l2 : l1;
  return (hi + 0.05) / (lo + 0.05);
}
