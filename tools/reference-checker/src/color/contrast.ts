import { srgbDecode } from "../kernels/srgb-transfer.js";
import { quantizeSrgb } from "./quantize.js";
import { compositeSourceOver } from "./composite.js";

export type OpaqueSrgb = { r: number; g: number; b: number; alpha: 1 };

function relativeLuminance(c: { r: number; g: number; b: number }): number {
  const R = srgbDecode(c.r);
  const G = srgbDecode(c.g);
  const B = srgbDecode(c.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * WCAG 2.2 contrast ratio on quantized sRGB. Translucent `fg` is composited
 * onto opaque `bg` first. Comparison is exact (4.499 fails 4.5).
 */
export function contrastRatio(
  fg: { r: number; g: number; b: number; alpha: number },
  bg: { r: number; g: number; b: number; alpha: number },
): number {
  const opaqueBg = {
    r: bg.r,
    g: bg.g,
    b: bg.b,
    alpha: 1 as const,
  };
  const composited =
    fg.alpha >= 1
      ? { r: fg.r, g: fg.g, b: fg.b, alpha: 1 as const }
      : compositeSourceOver(fg, opaqueBg);
  const qFg = quantizeSrgb(composited);
  const qBg = quantizeSrgb(opaqueBg);
  const L1 = relativeLuminance(qFg);
  const L2 = relativeLuminance(qBg);
  const lighter = L1 > L2 ? L1 : L2;
  const darker = L1 > L2 ? L2 : L1;
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(
  fg: { r: number; g: number; b: number; alpha: number },
  bg: { r: number; g: number; b: number; alpha: number },
  target: number,
): boolean {
  return contrastRatio(fg, bg) >= target;
}
