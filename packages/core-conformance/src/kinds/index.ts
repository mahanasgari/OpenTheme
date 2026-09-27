/** Protocol kind → handler. A missing entry is reported as `unsupported`. */
import { canonicalize } from "./canonicalize.js";
import { exportCheck, flatten } from "./documents.js";
import { kernel } from "./kernel.js";
import { resolve } from "./resolve.js";
import { validate } from "./validate.js";
import { validatePreferences } from "./validate-preferences.js";
import { accessibilityReport } from "./accessibility-report.js";
import { compareVersions, migrate } from "./versions.js";
import { validateHost } from "./validate-host.js";

export type Handler = (input: unknown) => Record<string, unknown>;

export const handlers: Partial<Record<string, Handler>> = {
  kernel,
  canonicalize,
  flatten,
  "export-check": exportCheck,
  validate,
  resolve,
  "compare-versions": compareVersions,
  migrate,
  "validate-preferences": validatePreferences,
  "accessibility-report": accessibilityReport,
  "validate-host": validateHost,
};
