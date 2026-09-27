/**
 * INTERNAL — not public API, no compatibility guarantee. Exposed only so the private
 * conformance harness can exercise normative internals (the numeric kernels, FR-C110).
 */
export { fromHex64, KERNELS, toHex64 } from "./kernels/index.js";
export { computeIntegrity } from "./canonical/integrity.js";
export * as colorTransforms from "./transforms/color.js";
export * as color from "./color/index.js";
export * as numberTransforms from "./transforms/number.js";
export * as engineModel from "./engine/model.js";
export * as engineEvaluate from "./engine/evaluate.js";
export * as engineEncode from "./engine/encode.js";
export * as validators from "./generated/validators.js";
export { validateTheme } from "./validate/theme.js";
export { validateHost } from "./validate/host.js";
export { resolve } from "./resolve/pipeline.js";
export { exportCheck, flattenTheme } from "./canonical/flatten.js";
export { compareVersions } from "./versioning/compare.js";
export { migrateTheme } from "./versioning/migrate.js";
export { parsePreferences } from "./preferences/document.js";
export { conformanceReport } from "./validate/accessibility.js";
export { DiagnosticCollector } from "./diagnostics/collector.js";
