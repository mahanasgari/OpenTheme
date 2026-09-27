/* Generated from specification/schemas/user-preferences/1.0/user-preferences.schema.json */

/**
 * Theme identifier, as in the theme metadata schema (chapter 02).
 *
 * This interface was referenced by `OpenThemeUserPreferencesDocument`'s JSON-Schema
 * via the `definition` "themeId".
 */
export type ThemeId = string;
/**
 * Semantic version 2.0.0 string.
 *
 * This interface was referenced by `OpenThemeUserPreferencesDocument`'s JSON-Schema
 * via the `definition` "version".
 */
export type Version = string;
/**
 * Customization point id: std.<name> or a theme-local [a-z][a-z0-9-]* id (chapter 09).
 *
 * This interface was referenced by `OpenThemeUserPreferencesDocument`'s JSON-Schema
 * via the `definition` "pointId".
 */
export type PointId = string;
/**
 * Value-level check (not applied by this schema): a finite number, a boolean, a string of at most 256 characters without control characters, or a color value.
 *
 * This interface was referenced by `OpenThemeUserPreferencesDocument`'s JSON-Schema
 * via the `definition` "permittedLiteral".
 */
export type PermittedLiteral = number | boolean | string | Color;

/**
 * One scope's personalization, stored separately from every theme (chapter 18). Document-level constraints are errors that make the document unusable. Whether each value is a permitted literal is a separate value-level check (#/$defs/permittedLiteral, OT-PREF-008 warning); it is deliberately not enforced by this schema so that one bad value never discards the others. Limits: 65536 bytes before parsing and nesting depth 8 (OT-PREF-002).
 */
export interface OpenThemeUserPreferencesDocument {
  /**
   * Format version as MAJOR.MINOR. A reader of M.N accepts M.0 through M.N; anything else is unsupported (OT-PREF-004).
   */
  openthemePreferences: string;
  /**
   * The user's selected theme, or null when the user has not chosen one.
   */
  selection: null | {
    id: ThemeId;
    version?: Version;
  };
  /**
   * The last theme applied with fallback "none", or null.
   */
  previous: null | {
    id: ThemeId;
    version: Version;
  };
  /**
   * Customization point id to value. Values should be permitted literals (#/$defs/permittedLiteral); an entry that is not produces OT-PREF-008, is ignored when compiling, and is kept as stored.
   */
  values: {
    [k: string]: any;
  };
  /**
   * Reverse-domain namespaced data preserved but never interpreted (chapter 15).
   */
  $extensions?: {
    [k: string]: any;
  };
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
