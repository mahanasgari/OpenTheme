/**
 * `opentheme resolve <theme>` (US2; FR-T030 to FR-T033): Core's resolution for a context, in full
 * or for the requested paths, with resolution diagnostics and a notice when the theme fell back.
 */
import { CONTEXT_OPTIONS, contextOptions, INPUT_OPTIONS, parse, presetOption, type Values } from "../args.js";
import { clean, toJson, withText } from "../format.js";
import { type Io, readInput, UsageError } from "../io.js";
import { diagnosticsBlock, fallbackNotice, loadTheme, type Loaded, resolveTheme } from "../theme.js";

const HELP = `Usage: opentheme resolve <theme> [options]

Resolves a theme for a context and prints the resolved tokens and components.

Context:   --scheme light|dark|no-preference  --contrast standard|high  --forced-colors
           --reduced-motion  --text-scale <n>  --size compact|medium|expanded  --locale <tag>
           --dir ltr|rtl
Output:    --path <path>  Only this token path, or component path such as
                          std/button.container.background.default (repeatable)
           --json  --no-color
Prefs:     --preset closed|common-personalization  --preferences <file>  --set <point>=<json>
Inputs:    --trusted  --source <source>  --base <file>  --host <file>  --relaxed-gate
`;

export const RESOLVE_OPTIONS = {
  ...INPUT_OPTIONS,
  ...CONTEXT_OPTIONS,
  path: { type: "string", multiple: true },
  preset: { type: "string" },
  preferences: { type: "string" },
  set: { type: "string", multiple: true },
} as const;

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** User preference values from --preferences and --set (--set wins). */
export function preferenceValues(loaded: Loaded, values: Values): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof values.preferences === "string") {
    const parsed = loaded.core.preferences.parse(readInput(values.preferences));
    if (!parsed.document) throw new UsageError(`${values.preferences}: not a usable User Preferences document`);
    Object.assign(out, parsed.document.values);
  }
  for (const s of Array.isArray(values.set) ? values.set : []) {
    const eq = s.indexOf("=");
    if (eq <= 0) throw new UsageError(`--set expects <point>=<json>, got "${s}"`);
    try {
      out[s.slice(0, eq)] = JSON.parse(s.slice(eq + 1)) as unknown;
    } catch {
      throw new UsageError(`--set ${s.slice(0, eq)}: the value is not JSON (quote strings: '"dark"')`);
    }
  }
  if (Object.keys(out).length > 0 && values.preset === undefined) {
    throw new UsageError("preferences need a policy that permits them; add --preset common-personalization");
  }
  return out;
}

/** A token path, or a component path `<contract>.<part>.<property>[.<state>]`. */
export function pick(resolved: Rec, path: string): unknown {
  const tokens = isRecord(resolved.tokens) ? resolved.tokens : {};
  if (Object.hasOwn(tokens, path)) return tokens[path];
  const slash = path.indexOf("/");
  const components = isRecord(resolved.components) ? resolved.components : {};
  if (slash > 0) {
    const [local, ...segments] = path.slice(slash + 1).split(".");
    let node: unknown = components[`${path.slice(0, slash)}/${local}`];
    for (const seg of segments) node = isRecord(node) && Object.hasOwn(node, seg) ? node[seg] : undefined;
    if (node !== undefined && segments.length > 0) return node;
  }
  throw new UsageError(`unknown path "${path}"`);
}

const show = (v: unknown) => clean(JSON.stringify(v));

export function resolveCommand(argv: readonly string[], io: Io): number {
  const { values, positionals } = parse(argv, RESOLVE_OPTIONS);
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  const context = contextOptions(values);
  const preset = presetOption(values);
  const loaded = loadTheme("resolve", values, positionals, io);
  if (typeof loaded === "number") return loaded;
  const r = resolveTheme(loaded, context, preferenceValues(loaded, values), preset);
  const resolved = r.result.resolved as unknown as Rec;
  const paths = Array.isArray(values.path) ? values.path : [];
  const selected = paths.length > 0 ? Object.fromEntries(paths.map((p) => [p, pick(resolved, p)])) : null;
  const status = r.fallback ? 1 : 0;
  const diagnostics = r.result.diagnostics;

  if (values.json) {
    io.stdout(
      toJson({
        command: "resolve",
        path: loaded.path,
        ...(loaded.options.relaxedGate ? { gate: "relaxed" } : {}),
        applied: resolved.applied,
        outcome: r.result.outcome,
        ...(selected ? { values: selected } : { resolved }),
        diagnostics: diagnostics.map(withText),
        status,
      }),
    );
    return status;
  }
  const s = loaded.styler;
  const applied = resolved.applied as { id: string; version: string };
  const ctx = resolved.context as Rec;
  io.stdout(fallbackNotice(r, s));
  io.stdout(`${s.bold(clean(loaded.path))}: ${clean(`${applied.id}@${applied.version}`)} · ${ctx.colorScheme} · ${ctx.contrast} contrast · ${ctx.sizeClass} · text ×${ctx.textScale}\n`);
  if (selected) {
    for (const [p, v] of Object.entries(selected)) io.stdout(`${clean(p)} = ${show(v)}\n`);
  } else {
    io.stdout(s.bold("tokens\n"));
    for (const [p, v] of Object.entries(resolved.tokens as Rec)) io.stdout(`  ${clean(p)} = ${show(v)}\n`);
    io.stdout(s.bold("components\n"));
    for (const [contract, parts] of Object.entries(resolved.components as Rec)) {
      for (const [part, props] of Object.entries(parts as Rec)) {
        if (part === "$variants") {
          io.stdout(`  ${clean(contract)} $variants = ${show(props)}\n`);
          continue;
        }
        for (const [prop, states] of Object.entries(props as Rec)) {
          for (const [state, v] of Object.entries(states as Rec)) io.stdout(`  ${clean(`${contract}.${part}.${prop}.${state}`)} = ${show(v)}\n`);
        }
      }
    }
  }
  io.stdout(diagnosticsBlock(diagnostics, s));
  return status;
}
