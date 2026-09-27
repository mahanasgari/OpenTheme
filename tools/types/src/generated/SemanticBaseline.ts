/* Generated from specification/schemas/1.0/registry/semantic-baseline.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistrySemanticBaselineSchemaJson {
  /**
   * Specification version.
   */
  version: string;
  tokens: {
    path: string;
    type: string;
    description: string;
    example: any;
    default?: any;
    highContrastDefault?: any;
    forcedColor?: string | null;
    reducedMotionDefault?: any;
    range?: any;
    deprecated?: any;
    reserved?: boolean;
    [k: string]: any;
  }[];
  pairs: {
    [k: string]: any;
  }[];
  distinguishable: {
    [k: string]: any;
  }[];
  distinguishableThreshold: number;
}
