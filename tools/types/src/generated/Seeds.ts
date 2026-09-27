/* Generated from specification/schemas/1.0/defs/seeds.schema.json */

export interface HttpsOpenthemeOrgSchemas10DefsSeedsSchemaJson {
  colorSchemes: {
    /**
     * Non-empty set drawn from light, dark, and declared variants
     *
     * @minItems 1
     */
    supported: [string, ...string[]];
    /**
     * One of supported
     */
    default: string;
    variants?: {
      [k: string]: {
        fallback: "light" | "dark";
        [k: string]: any;
      };
    };
  };
  seeds: {
    /**
     * Ordered font family fallback list ending in a generic family
     *
     * @minItems 1
     * @maxItems 8
     */
    fontFamily:
      | [string]
      | [string, string]
      | [string, string, string]
      | [string, string, string, string]
      | [string, string, string, string, string]
      | [string, string, string, string, string, string]
      | [string, string, string, string, string, string, string]
      | [string, string, string, string, string, string, string, string];
    /**
     * Per-scheme seeds: background, foreground, accent (opaque)
     */
    [k: string]: {
      background: OpaqueColor;
      foreground: OpaqueColor;
      accent: OpaqueColor;
      [k: string]: any;
    };
  };
}
/**
 * Opaque sRGB or OKLCH color (seeds must not be translucent)
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsSeedsSchemaJson`'s JSON-Schema
 * via the `definition` "opaqueColor".
 */
export interface OpaqueColor {
  colorSpace: "srgb" | "oklch";
  /**
   * @minItems 3
   * @maxItems 3
   */
  components: [number, number, number];
  alpha?: 1;
  hex?: string;
  [k: string]: any;
}
