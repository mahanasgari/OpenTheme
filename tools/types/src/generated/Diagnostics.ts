/* Generated from specification/schemas/1.0/registry/diagnostics.schema.json */

export interface HttpsOpenthemeOrgSchemas10RegistryDiagnosticsSchemaJson {
  /**
   * Specification version of this registry.
   */
  version: string;
  codes: {
    code: string;
    severity: "error" | "warning" | "info";
    description: string;
    message: string;
    hint: string;
    messageTemplate: string;
    hintTemplate: string;
    params?: string[];
    rules: string[];
    fixtures: string[];
    example: any;
    /**
     * Present when the entry is retired: why, and that it is never reported.
     */
    retired?: string;
    [k: string]: any;
  }[];
}
