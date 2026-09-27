/* Generated from specification/schemas/1.0/fixture.schema.json */

export interface OpenThemeConformanceFixture {
  /**
   * Conformance request kind.
   */
  kind:
    | "validate"
    | "validate-host"
    | "resolve"
    | "canonicalize"
    | "flatten"
    | "export-check"
    | "compare-versions"
    | "migrate"
    | "kernel"
    | "validate-preferences"
    | "accessibility-report";
  /**
   * Rules exercised by this fixture.
   *
   * @minItems 1
   */
  rules: [string, ...string[]];
  /**
   * Human-readable fixture purpose.
   */
  description: string;
  /**
   * Optional simulated previous-major or other profile.
   */
  profile?: string;
  /**
   * Inline document, $file reference, or generate instruction.
   */
  input:
    | {
        [k: string]: any;
      }
    | {
        /**
         * Path restricted to fixtures or published themes/hosts/examples.
         */
        $file: string;
      }
    | {
        generate: {
          generator:
            "pad-bytes" | "nest-depth" | "token-count" | "reference-chain" | "derivation-depth" | "repeat-member";
          params?: {
            [k: string]: any;
          };
          [k: string]: any;
        };
      };
  /**
   * Kind-specific expectations.
   */
  expect: {
    [k: string]: any;
  };
}
