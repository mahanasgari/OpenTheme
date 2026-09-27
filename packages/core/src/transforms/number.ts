/**
 * Number and dimension transformations (contracts/transformations.md). Dimensions are in px.
 */
import { roundHalfEven } from "../kernels/index.js";

export interface Dimension {
  readonly value: number;
  readonly unit: "px";
}

export function numberScale(value: number, factor: number): number {
  return value * factor;
}

export function numberAdd(value: number, delta: number): number {
  return value + delta;
}

export function numberClamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function dimensionScale(value: Dimension, factor: number): Dimension {
  return { value: value.value * factor, unit: "px" };
}

export function dimensionAdd(value: Dimension, delta: Dimension): Dimension {
  return { value: value.value + delta.value, unit: "px" };
}

export function dimensionClamp(value: Dimension, min: Dimension, max: Dimension): Dimension {
  return { value: numberClamp(value.value, min.value, max.value), unit: "px" };
}

/** Nearest multiple of `step`, ties to the even multiple. */
export function dimensionRound(value: Dimension, step: Dimension): Dimension {
  return { value: roundHalfEven(value.value / step.value) * step.value, unit: "px" };
}
