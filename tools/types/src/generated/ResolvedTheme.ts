/* Generated from specification/schemas/1.0/resolved-theme.schema.json */

/**
 * This interface was referenced by `OpenThemeResolvedTheme`'s JSON-Schema
 * via the `definition` "resolvedColor".
 */
export type ResolvedColor =
  | {
      /**
       * @minItems 3
       * @maxItems 3
       */
      srgb8: [number, number, number];
      alpha?: number;
      [k: string]: any;
    }
  | {
      system: string;
      [k: string]: any;
    };

export interface OpenThemeResolvedTheme {
  applied: {
    id: string;
    version: string;
    fallback: "none" | "previous" | "developer-default" | "specification-baseline";
    /**
     * Lowest trust level in the selected theme's inheritance chain (FR-048).
     */
    trust?: "trusted" | "untrusted";
    [k: string]: any;
  };
  /**
   * Effective resolved context: colorScheme, seedScheme, contrast, motion, density, sizeClass, textScale, forcedColors, direction, locale (chapter 10).
   */
  context: {
    [k: string]: any;
  };
  displayText?: {
    name?: string;
    description?: string;
    [k: string]: any;
  };
  /**
   * Resolved token map. Every value is concrete; encodings by type are normative in chapter 10, Resolved values: colors are srgb8 (or system under forced colors), dimensions and durations are {value, unit}, numbers are {number}, font families are {families}, composites have every member resolved.
   */
  tokens: {
    [k: string]: any;
  };
  components: {
    [k: string]: any;
  };
  layout: {
    variants?: {
      [k: string]: string;
    };
    [k: string]: any;
  };
  preferences: {
    [k: string]: {
      value?: any;
      status: "effective" | "clamped" | "fell-back" | "skipped" | "rejected";
      [k: string]: any;
    };
  };
  /**
   * Accessibility report for the effective mode.
   */
  accessibility?: {
    [k: string]: any;
  };
  diagnostics: OpenThemeDiagnostic[];
}
export interface OpenThemeDiagnostic {
  /**
   * Stable diagnostic code from diagnostics.json.
   */
  code: string;
  /**
   * Only error affects validity.
   */
  severity: "error" | "warning" | "info";
  location: Location;
  /**
   * Normative rule identifier.
   */
  rule: string;
  /**
   * Message template id from diagnostics.json.
   */
  message: string;
  /**
   * Hint template id from diagnostics.json.
   */
  hint: string;
  /**
   * Grammar-constrained parameters only (no free document text).
   */
  params: {
    [k: string]: string | number | boolean | string[];
  };
  /**
   * Additional related locations.
   */
  related?: Location[];
}
/**
 * This interface was referenced by `OpenThemeDiagnostic`'s JSON-Schema
 * via the `definition` "location".
 */
export interface Location {
  /**
   * Document the pointer refers to.
   */
  document: string;
  /**
   * RFC 6901 JSON Pointer.
   */
  pointer: string;
}
