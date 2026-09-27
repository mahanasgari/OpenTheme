/* Generated from specification/schemas/1.0/defs/customization.schema.json */

/**
 * std.<name> for standard points … or a theme-local identifier [a-z][a-z0-9-]*
 *
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "pointId".
 */
export type PointId = string;
/**
 * 1 to 16 token paths, or one context dimension (colorScheme, contrast, motion, density)
 *
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "target".
 */
export type Target =
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string]
  | [string, string, string, string, string]
  | [string, string, string, string, string, string]
  | [string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string, string, string]
  | [string, string, string, string, string, string, string, string, string, string, string, string, string, string]
  | [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string
    ]
  | [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string
    ]
  | {
      dimension: "colorScheme" | "contrast" | "motion" | "density";
    }
  | {
      textScale: "in-app";
    };
/**
 * Exactly one of: range { min, max, step }; range { gamut: "srgb", opaque: true }; enum [values]; or presets [{ id, label, value }]
 *
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "constraints".
 */
export type Constraints =
  | {
      range: RangeNumber | RangeColor;
    }
  | {
      /**
       * @minItems 1
       */
      enum: [string | number | boolean, ...(string | number | boolean)[]];
    }
  | {
      /**
       * @minItems 1
       */
      presets: [Preset, ...Preset[]];
    };
/**
 * Array of 1 to 8 family names, ending in a generic family
 *
 * @minItems 1
 * @maxItems 8
 */
export type FontFamilyList =
  | [
      | string
      | (
          | "serif"
          | "sans-serif"
          | "monospace"
          | "cursive"
          | "fantasy"
          | "system-ui"
          | "ui-serif"
          | "ui-sans-serif"
          | "ui-monospace"
          | "ui-rounded"
          | "math"
          | "emoji"
          | "fangsong"
        )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ]
  | [
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      ),
      (
        | string
        | (
            | "serif"
            | "sans-serif"
            | "monospace"
            | "cursive"
            | "fantasy"
            | "system-ui"
            | "ui-serif"
            | "ui-sans-serif"
            | "ui-monospace"
            | "ui-rounded"
            | "math"
            | "emoji"
            | "fangsong"
          )
      )
    ];
/**
 * [x1, y1, x2, y2] with x values in [0, 1]
 *
 * @minItems 4
 * @maxItems 4
 */
export type CubicBezier = [any, any, any, any];

/**
 * Customization points per data-model §9.
 */
export interface OpenThemeCustomizationPoints {
  /**
   * points: an array of at most 200 points
   *
   * @maxItems 200
   */
  points: Point[];
}
/**
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "point".
 */
export interface Point {
  id: PointId;
  label?: string;
  description?: string;
  localized?: Localized;
  target?: Target;
  /**
   * A token type, or enum for dimension targets
   */
  type?:
    | "color"
    | "dimension"
    | "fontFamily"
    | "fontWeight"
    | "number"
    | "opacity"
    | "duration"
    | "cubicBezier"
    | "strokeStyle"
    | "border"
    | "shadow"
    | "typography"
    | "density"
    | "enum";
  constraints?: Constraints;
  /**
   * Optional literal, or a preset id for preset points
   */
  default?: {
    [k: string]: any;
  };
  /**
   * Text-size point only: { min, max } for the effective text scale, with max ≥ 2
   */
  effectiveRange?: {
    min: number;
    max: number;
  };
}
/**
 * map from a BCP 47 language tag to { name?, description? }; at most 64 entries
 */
export interface Localized {
  [k: string]: {
    /**
     * Plain text, 1 to 100 characters
     */
    name?: string;
    /**
     * Plain text description, 1 to 1000 characters
     */
    description?: string;
  };
}
/**
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "rangeNumber".
 */
export interface RangeNumber {
  min: number;
  max: number;
  step: number;
}
/**
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "rangeColor".
 */
export interface RangeColor {
  gamut: "srgb";
  opaque: true;
}
/**
 * This interface was referenced by `OpenThemeCustomizationPoints`'s JSON-Schema
 * via the `definition` "preset".
 */
export interface Preset {
  id: string;
  label: string;
  /**
   * Literal or alias, never a derivation
   */
  value:
    | Color
    | Dimension
    | (
        | FontFamilyList
        | {
            default: FontFamilyList;
            [k: string]: FontFamilyList;
          }
      )
    | number
    | Duration
    | CubicBezier
    | ("solid" | "dashed" | "dotted")
    | Border
    | Shadow
    | Typography
    | ("compact" | "standard" | "comfortable")
    | string;
}
/**
 * { colorSpace: "srgb" | "oklch", components: [3 numbers in range], alpha?: 0..1, hex?: "#rrggbb" }
 */
export interface Color {
  colorSpace: "srgb" | "oklch";
  /**
   * @minItems 3
   * @maxItems 3
   */
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}
/**
 * { value: number, unit: "px" }
 */
export interface Dimension {
  value: number;
  unit: "px";
}
/**
 * { value: 0..1000, unit: "ms" }
 */
export interface Duration {
  value: number;
  unit: "ms";
}
/**
 * Composite border; members may carry physical: true
 */
export interface Border {
  width?: Dimension | string;
  style?: ("solid" | "dashed" | "dotted") | string;
  color?: Color | string;
  physical?: boolean;
}
/**
 * Composite shadow; members may carry physical: true
 */
export interface Shadow {
  offsetX?: Dimension | string;
  offsetY?: Dimension | string;
  blur?: Dimension | string;
  spread?: Dimension | string;
  color?: Color | string;
  physical?: boolean;
}
/**
 * Composite typography; members may carry physical: true
 */
export interface Typography {
  fontFamily?:
    | (
        | FontFamilyList
        | {
            default: FontFamilyList;
            [k: string]: FontFamilyList;
          }
      )
    | string;
  fontWeight?: number | string;
  fontSize?: Dimension | string;
  lineHeight?: number | Dimension | string;
  letterSpacing?: Dimension | string;
  physical?: boolean;
}
