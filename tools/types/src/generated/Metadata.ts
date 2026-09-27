/* Generated from specification/schemas/1.0/defs/metadata.schema.json */

/**
 * Reverse-domain id or uid. + 26 lowercase base32 chars
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "id".
 */
export type Id = string;
/**
 * Semantic version 2.0.0 string
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "version".
 */
export type Version = string;
/**
 * SPDX license expression
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "license".
 */
export type License = string;
/**
 * up to 16 plain-text items of up to 32 characters each
 *
 * @maxItems 16
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "keywords".
 */
export type Keywords =
  | []
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
    ];

export interface HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson {
  [k: string]: any;
}
/**
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "author".
 */
export interface Author {
  /**
   * Plain text author name; no URLs or email addresses
   */
  name: string;
}
/**
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "provenance".
 */
export interface Provenance {
  origin:
    | "specification-baseline"
    | "prebuilt"
    | "developer-authored"
    | "user-created"
    | "imported"
    | "ai-generated"
    | "ai-assisted";
  /**
   * Ordered list of { id, version } … up to 32 entries
   *
   * @maxItems 32
   */
  lineage?: {
    id: Id;
    version: Version;
    [k: string]: any;
  }[];
}
/**
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsMetadataSchemaJson`'s JSON-Schema
 * via the `definition` "compatibility".
 */
export interface Compatibility {
  /**
   * MAJOR.MINOR catalog version
   */
  catalog?: string;
  /**
   * map from namespace to version
   */
  extensions?: {
    [k: string]: string;
  };
}
