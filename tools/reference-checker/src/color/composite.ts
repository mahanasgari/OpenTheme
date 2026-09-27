/**
 * Source-over compositing in gamma-encoded sRGB (what renderers display).
 * Backdrop is treated as opaque.
 */
export function compositeSourceOver(
  src: { r: number; g: number; b: number; alpha: number },
  backdrop: { r: number; g: number; b: number; alpha?: number },
): { r: number; g: number; b: number; alpha: 1 } {
  const a = src.alpha;
  const inv = 1 - a;
  return {
    r: src.r * a + backdrop.r * inv,
    g: src.g * a + backdrop.g * inv,
    b: src.b * a + backdrop.b * inv,
    alpha: 1,
  };
}
