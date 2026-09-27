import { compareVersions as cmp, migrateTheme } from "@opentheme/core/internal-conformance";

/** `compare-versions`: theme-version classification (chapter 14). */
export function compareVersions(input: unknown): Record<string, unknown> {
  const p = input as { old: Record<string, unknown>; new: Record<string, unknown> };
  return { ...cmp(p.old, p.new) };
}

/** `migrate`: apply a migration manifest (chapter 14). */
export function migrate(input: unknown): Record<string, unknown> {
  const p = input as { theme: Record<string, unknown>; manifest: Parameters<typeof migrateTheme>[1] };
  return { ...migrateTheme(p.theme, p.manifest) };
}
