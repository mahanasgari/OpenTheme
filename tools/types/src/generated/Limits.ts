/* Generated from specification/schemas/1.0/registry/limits.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistryLimitsSchemaJson {
  /**
   * Specification version of this registry.
   */
  version: string;
  limits: {
    [k: string]: {
      value: number;
      description: string;
      example: any;
      [k: string]: any;
    };
  };
}
