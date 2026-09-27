import type { DiagnosticCollector } from "../diagnostics/collector.js";

const SUPPORTED = "1.0";

/**
 * Version gate and metadata checks. Returns false if the version is unsupported
 * (caller should skip further semantic validation).
 */
export function validateMetadata(
  doc: Record<string, unknown>,
  collector: DiagnosticCollector,
): boolean {
  const version = doc.opentheme;
  if (typeof version !== "string") {
    return false; // schema already reported
  }

  if (version === SUPPORTED) {
    return true;
  }

  // Major mismatch → OT-VER-001; same-major unsupported minor → OT-VER-002
  const major = version.split(".")[0];
  if (major !== "1") {
    collector.add({
      code: "OT-VER-001",
      rule: "R-VER-001",
      location: { document: "theme", pointer: "/opentheme" },
      params: { version },
    });
  } else {
    collector.add({
      code: "OT-VER-002",
      rule: "R-VER-002",
      location: { document: "theme", pointer: "/opentheme" },
      params: { version },
    });
  }
  return false;
}
