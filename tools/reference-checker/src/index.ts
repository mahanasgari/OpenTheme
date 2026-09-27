/** Private non-normative reference checker entry (ot-ref). */
export { parseIJson, ParseError } from "./parse/index.js";
export type { JsonValue, ParseResult } from "./parse/index.js";
export {
  applyKernel,
  cbrt,
  cos,
  exp2,
  fromHex64,
  log2,
  sin,
  srgbDecode,
  srgbEncode,
  toHex64,
} from "./kernels/index.js";
export type { KernelName } from "./kernels/index.js";
export { validateTheme, validateThemeObject, validateHost } from "./validate/index.js";
export type { ValidateResult } from "./validate/index.js";
export {
  resolveTheme,
  resolvedToJcs,
  selectTheme,
  loadSpecificationBaseline,
  resolveContext,
  enforcePreference,
} from "./resolve/index.js";
export type { ResolveInput, ResolvedTheme } from "./resolve/index.js";
export { migrateTheme } from "./versioning/migrate.js";
export type { MigrationManifest, MigrateResult } from "./versioning/migrate.js";
export { compareThemes } from "./versioning/compare.js";
export type { CompareResult, CompareClassification } from "./versioning/compare.js";
export { contrastRatio, meetsContrast } from "./color/index.js";
export { canonicalize, canonicalizeToBytes } from "./canonical/jcs.js";
export type { Json } from "./canonical/jcs.js";
export { normalizeTheme } from "./canonical/normalize.js";
export {
  computeIntegrity,
  attachIntegrity,
  integrityOfCanonicalBytes,
} from "./canonical/integrity.js";
export { flattenTheme, checkExportEligibility } from "./canonical/flatten.js";

