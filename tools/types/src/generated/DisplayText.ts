/* Generated from specification/schemas/1.0/defs/display-text.schema.json */

/**
 * Plain text without C0/C1 controls, bidi embedding/override/isolate (U+202A–U+202E, U+2066–U+2069), or noncharacters. U+200E, U+200F, and U+061C are allowed.
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsDisplayTextSchemaJson`'s JSON-Schema
 * via the `definition` "displayString".
 */
export type DisplayString = string;
/**
 * Plain text, 1 to 100 characters
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsDisplayTextSchemaJson`'s JSON-Schema
 * via the `definition` "displayName".
 */
export type DisplayName = DisplayString;
/**
 * Plain text description, 1 to 1000 characters
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsDisplayTextSchemaJson`'s JSON-Schema
 * via the `definition` "descriptionString".
 */
export type DescriptionString = DisplayString;

export interface HttpsOpenthemeOrgSchemas10DefsDisplayTextSchemaJson {
  [k: string]: any;
}
/**
 * map from a BCP 47 language tag to { name?, description? }; at most 64 entries
 *
 * This interface was referenced by `HttpsOpenthemeOrgSchemas10DefsDisplayTextSchemaJson`'s JSON-Schema
 * via the `definition` "localized".
 */
export interface Localized {
  [k: string]: {
    name?: DisplayName;
    description?: DescriptionString;
  };
}
