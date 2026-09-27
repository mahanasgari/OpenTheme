/* Generated from specification/schemas/1.0/registry/context-dimensions.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistryContextDimensionsSchemaJson {
  /**
   * Specification version of this registry.
   */
  version: string;
  /**
   * @minItems 1
   */
  priority: [string, ...string[]];
  dimensions: {
    [k: string]: {
      /**
       * @minItems 1
       */
      values: [string, ...string[]];
      variantsAllowed?: boolean;
      default?: string;
      thresholds?: {
        [k: string]: any;
      };
      description: string;
      example: any;
      [k: string]: any;
    };
  };
}
