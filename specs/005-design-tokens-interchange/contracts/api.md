# Contract: `@opentheme/dtcg` and the `export` / `import` commands

**Version**: 0.1.0 (pre-release) | **Spec**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md)

## Library

```ts
export interface Mode { readonly scheme: "light" | "dark"; readonly contrast: "standard" | "high" }
export interface ReportEntry {
  readonly path: string;
  readonly action: "left-out" | "converted" | "renamed" | "restored" | "kept-computed" | "defaulted" | "dropped-extensions";
  readonly reason: string;
}

export function exportTheme(core: Core, theme: RegistryEntryRef, options?: { modes?: readonly Mode[] }):
  | { ok: true; documents: readonly { mode: Mode; document: object }[]; report: readonly ReportEntry[] }
  | { ok: false; error: OperationalError };

export function importTokens(input: string | Uint8Array, options?: {
  mapping?: Readonly<Record<string, string>>;
  id?: string; name?: string; restoreDerivations?: boolean;
}): {
  theme: object | null;              // null when nothing usable, or Core rejects it
  text: string | null;               // canonical two-space JSON with a trailing newline
  report: readonly ReportEntry[];
  diagnostics: readonly Diagnostic[]; // Core's diagnostics when the theme is invalid
};
```

Default modes: every supported scheme at standard contrast. Results are deterministic.

## Commands

```text
opentheme export <theme> [--mode <scheme>[:<contrast>]]... [--out-dir <dir>] [--force]
                 [input options] [--json]
  writes <out-dir>/<theme name>.<scheme>[-high].tokens.json (default out-dir: the theme's directory)

opentheme import <tokens.json> --out <theme.json> [--mapping <file>] [--id <id>] [--name <name>]
                 [--restore-derivations] [--force] [--json]
```

Exit statuses follow the command-line tool: `1` when the theme is invalid or the import produces a
theme Core rejects; `2` usage; `3` files.
