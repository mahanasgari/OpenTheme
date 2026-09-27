export {
  DiagnosticCollector,
  ParamError,
  type Diagnostic,
  type DocumentKind,
  type Location,
  type ParamValue,
} from "./collector.js";
export {
  InternalError,
  loadDiagnosticRegistry,
  requireDiagnosticCode,
  type DiagnosticCodeEntry,
  type Severity,
} from "./registry.js";
