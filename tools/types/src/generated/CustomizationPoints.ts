/* Generated from specification/schemas/1.0/registry/customization-points.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistryCustomizationPointsSchemaJson {
  /**
   * Specification version.
   */
  version: string;
  points: {
    id: string;
    label: string;
    description: string;
    localizationKey?: string;
    target?: any;
    type?: string;
    constraints?: {
      [k: string]: any;
    };
    default?: any;
    effectiveRange?: {
      [k: string]: any;
    };
    example: any;
    [k: string]: any;
  }[];
}
