import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Severity = "error" | "warning" | "info";

export interface DiagnosticCodeEntry {
  code: string;
  severity: Severity;
  description: string;
  message: string;
  hint: string;
  messageTemplate: string;
  hintTemplate: string;
  params?: string[];
  rules: string[];
  fixtures: string[];
}

export class InternalError extends Error {
  readonly exitCode = 4;
  constructor(message: string) {
    super(message);
    this.name = "InternalError";
  }
}

let cached: Map<string, DiagnosticCodeEntry> | undefined;

function diagnosticsPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(
    here,
    "../../../../specification/registry/1.0/diagnostics.json",
  );
}

export function loadDiagnosticRegistry(
  filePath = diagnosticsPath(),
): Map<string, DiagnosticCodeEntry> {
  if (cached && filePath === diagnosticsPath()) return cached;
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
    codes: DiagnosticCodeEntry[];
  };
  const map = new Map<string, DiagnosticCodeEntry>();
  for (const entry of raw.codes) {
    map.set(entry.code, entry);
  }
  if (filePath === diagnosticsPath()) cached = map;
  return map;
}

export function requireDiagnosticCode(code: string): DiagnosticCodeEntry {
  const entry = loadDiagnosticRegistry().get(code);
  if (!entry) {
    throw new InternalError(`Unknown diagnostic code: ${code}`);
  }
  return entry;
}
