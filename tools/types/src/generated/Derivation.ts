/* Generated from specification/schemas/1.0/defs/derivation.schema.json */

/**
 * One of the 16 transformation identifiers in transformations.json
 *
 * This interface was referenced by `OpenThemeDerivation`'s JSON-Schema
 * via the `definition` "op".
 */
export type Op =
  | "color.mix"
  | "color.lightness"
  | "color.chroma"
  | "color.hue"
  | "color.alpha"
  | "color.composite"
  | "color.contrast-select"
  | "color.contrast-adjust"
  | "color.mix-bounded"
  | "number.scale"
  | "number.add"
  | "number.clamp"
  | "dimension.scale"
  | "dimension.add"
  | "dimension.clamp"
  | "dimension.round";
/**
 * Literal, alias, or nested derivation
 *
 * This interface was referenced by `OpenThemeDerivation`'s JSON-Schema
 * via the `definition` "operand".
 */
export type Operand =
  | (
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
      | string
    )
  | Derive
  | Operand[];
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
 * $derive: { op, args } per data-model §5. Nesting depth, operand types, and domains are validator rules.
 */
export interface OpenThemeDerivation {
  [k: string]: any;
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
/**
 * This interface was referenced by `OpenThemeDerivation`'s JSON-Schema
 * via the `definition` "derive".
 */
export interface Derive {
  op: Op;
  args: {
    [k: string]: Operand;
  };
}
