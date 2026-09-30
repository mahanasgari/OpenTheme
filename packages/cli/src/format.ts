/**
 * Output formatting (research LR5; FR-T006, FR-T021): human-readable diagnostics with Core's English
 * templates, and one JSON document with sorted keys. Diagnostics keep Core's order.
 */
import type { Diagnostic } from "@opentheme/core";
import { formatDiagnostic } from "@opentheme/core/templates";

export interface Styler {
  red(s: string): string;
  yellow(s: string): string;
  dim(s: string): string;
  bold(s: string): string;
}

const ansi = (code: number) => (s: string) => `\u001b[${code}m${s}\u001b[0m`;
export const plain: Styler = { red: (s) => s, yellow: (s) => s, dim: (s) => s, bold: (s) => s };
export const colored: Styler = { red: ansi(31), yellow: ansi(33), dim: ansi(2), bold: ansi(1) };

/**
 * Text from files (member names, pointers, token names, file names) is untrusted: C0 and C1
 * controls, DEL, and bidirectional overrides are shown escaped, so a file cannot rewrite or reorder
 * the author's terminal. Styling is applied after cleaning. JSON output needs none of this.
 */
export function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, (c) => `\\u{${c.charCodeAt(0).toString(16)}}`);
}

export interface DisplayDiagnostic extends Diagnostic {
  readonly message: string;
  readonly hint: string;
}

/** Core's diagnostic plus its English message and hint. */
export function withText(d: Diagnostic): DisplayDiagnostic {
  const t = formatDiagnostic(d) ?? { message: d.message, hint: d.hint };
  return { ...d, message: t.message, hint: t.hint };
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[], s: Styler): string {
  let out = "";
  for (const raw of diagnostics) {
    const d = withText(raw);
    const sev = d.severity === "error" ? s.red("error") : d.severity === "warning" ? s.yellow("warning") : s.dim("info");
    const doc = d.location.document === "theme" ? "" : ` ${s.dim(`[${clean(d.location.document)}]`)}`;
    out += `  ${sev} ${s.bold(d.code)} ${clean(d.location.pointer) || '""'}${doc}\n`;
    out += `        ${clean(d.message)}\n`;
    if (d.hint) out += `        ${s.dim(`hint: ${clean(d.hint)}`)}\n`;
  }
  return out;
}

export function counts(diagnostics: readonly Diagnostic[]): string {
  const n = (sev: string) => diagnostics.filter((d) => d.severity === sev).length;
  const parts: string[] = [];
  const e = n("error");
  const w = n("warning");
  const i = n("info");
  if (e) parts.push(`${e} error${e === 1 ? "" : "s"}`);
  if (w) parts.push(`${w} warning${w === 1 ? "" : "s"}`);
  if (i) parts.push(`${i} info`);
  return parts.join(", ");
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** One JSON document with sorted keys and a trailing newline. */
export function toJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
