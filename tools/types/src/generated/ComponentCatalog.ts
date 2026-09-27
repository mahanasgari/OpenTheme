/* Generated from specification/schemas/1.0/registry/component-catalog.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistryComponentCatalogSchemaJson {
  /**
   * Specification version.
   */
  version: string;
  catalog: string;
  contracts: {
    id: string;
    version: string;
    description: string;
    example: any;
    parts: string[];
    states: string[];
    variants?: {
      [k: string]: any;
    };
    properties: {
      [k: string]: any;
    };
    defaults: {
      [k: string]: any;
    };
    pairs: any[];
    interactiveParts: string[];
    [k: string]: any;
  }[];
}
