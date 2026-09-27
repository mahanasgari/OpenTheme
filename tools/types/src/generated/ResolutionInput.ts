/* Generated from specification/schemas/1.0/resolution-input.schema.json */

export interface OpenThemeResolutionInput {
  /**
   * User-selected theme.
   */
  selection: {
    id: string;
    version?: string;
    [k: string]: any;
  };
  /**
   * Last valid applied theme, or null.
   */
  previous?: null | {
    id: string;
    version: string;
    [k: string]: any;
  };
  /**
   * Available theme documents. Trust is assigned by the host to each document entry, never read from the document and never keyed by identifier (FR-010, FR-068). Base themes for inheritance are resolved from this same list (FR-048).
   */
  themes?: {
    /**
     * Host-assigned trust for this document instance, based on how the host obtained it.
     */
    trust: "trusted" | "untrusted";
    /**
     * Inline theme document or $file reference.
     */
    document: {
      [k: string]: any;
    };
  }[];
  /**
   * Shorthand for one additional `themes` entry with trust `trusted`, supplied by the host. Its trust comes from the member it is placed in, never from its content.
   */
  theme?: {
    [k: string]: any;
  };
  /**
   * Host declaration or null.
   */
  host?: {
    [k: string]: any;
  };
  platform: {
    colorScheme: "light" | "dark" | "no-preference";
    contrast: "standard" | "high";
    forcedColors: boolean;
    reducedMotion: boolean;
    textScale: number;
  };
  environment: {
    sizeClass: "compact" | "medium" | "expanded";
    /**
     * BCP 47 language tag.
     */
    locale: string;
    direction: "ltr" | "rtl";
  };
  /**
   * Map from customization point id to value.
   */
  preferences: {
    [k: string]: any;
  };
  policy: {
    availableThemes?: string[];
    defaultTheme?: string;
    permittedPoints?: {
      [k: string]: any;
    };
    allowedColorSchemes?: string[];
    locks?: {
      [k: string]: any;
    };
    protected?: string[];
    accessibilityFloor?: "wcag22-aa" | "relaxed";
  };
}
