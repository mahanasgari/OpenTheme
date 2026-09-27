/* Generated from specification/schemas/1.0/registry/rules.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistryRulesSchemaJson {
  /**
   * Specification version of this registry.
   */
  version: string;
  rules: {
    id: string;
    chapter: string;
    requirements: string[];
    summary: string;
    description: string;
    /**
     * @minItems 0
     */
    fixtures: string[];
    example: any;
    [k: string]: any;
  }[];
}
