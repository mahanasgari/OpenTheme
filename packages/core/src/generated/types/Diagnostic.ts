/* Generated from specification/schemas/1.0/diagnostic.schema.json */

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
