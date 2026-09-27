/* Generated from specification/schemas/1.0/defs/layout.schema.json */

/**
 * Theme layout member: variants.<region> is a variant name or a map from size class to variant name.
 */
export interface OpenThemeLayoutSelection {
  /**
   * Region → variant name, or size-class map.
   */
  variants?: {
    [k: string]:
      | string
      | {
          compact?: string;
          medium?: string;
          expanded?: string;
        };
  };
  /**
   * Optional reflow budget inputs for FR-039 (narrowest size class ≤ 320 px).
   */
  metrics?: {
    minWidths?: number[];
    fixedWidths?: number[];
    gutters?: number[];
  };
}
