/**
 * The normative resolution function (chapter 10; contracts/resolution.md; research R12):
 * resolve(input) → { resolved, diagnostics }. Pure and synchronous.
 */
import { contrastRatio, quantize } from "../color/index.js";
import { jcs } from "../canonical/jcs.js";
import { DiagnosticCollector, type Diagnostic } from "../diagnostics/collector.js";
import { type Decl, declareBase, type EvalContext, evaluate } from "../engine/evaluate.js";
import { encodeValue, resolveComposites, isComposite } from "../engine/encode.js";
import { aliasTarget, buildModel, isRecord, seedSchemeOf, type ThemeModel } from "../engine/model.js";
import { BASELINE, BASELINE_PAIRS, CATALOG, DISTINGUISHABLE, DISTINGUISHABLE_THRESHOLD, type Contract } from "../engine/registry.js";
import { decodeLiteral, type Value } from "../engine/values.js";
import { roundHalfEven } from "../kernels/index.js";
import { shapeOf } from "../validate/grammar.js";
import { hostTokenDefs, THRESHOLDS } from "../validate/accessibility.js";
import { hostContracts } from "../validate/theme.js";
import { resolveComponents, styledDerivations } from "./components.js";
import { declaredPointIds, effectivePoints, enforce, type EnforcedPreference } from "./preferences.js";
import { type Fallback, selectTheme, type ThemeEntry } from "./select.js";
import type { Prepared } from "./prepare.js";

export interface ResolutionInput {
  readonly themes?: readonly { readonly trust?: string; readonly document: Readonly<Record<string, unknown>> }[];
  readonly theme?: Readonly<Record<string, unknown>>;
  readonly host?: Readonly<Record<string, unknown>> | null;
  readonly selection: { readonly id: string; readonly version?: string };
  readonly previous?: { readonly id: string; readonly version: string } | null;
  readonly platform: {
    readonly colorScheme: "light" | "dark" | "no-preference";
    readonly contrast: "standard" | "high";
    readonly forcedColors: boolean;
    readonly reducedMotion: boolean;
    readonly textScale: number;
  };
  readonly environment: { readonly sizeClass: "compact" | "medium" | "expanded"; readonly locale: string; readonly direction: "ltr" | "rtl" };
  readonly preferences?: Readonly<Record<string, unknown>>;
  readonly policy?: {
    readonly availableThemes?: readonly string[];
    readonly defaultTheme?: string;
    readonly permittedPoints?: Readonly<Record<string, unknown>>;
    readonly allowedColorSchemes?: readonly string[];
    readonly locks?: Readonly<Record<string, unknown>>;
    readonly protected?: readonly string[];
    readonly accessibilityFloor?: "wcag22-aa" | "relaxed";
  };
}

export interface ResolveResult {
  readonly resolved: Record<string, unknown>;
  readonly diagnostics: Diagnostic[];
}

function escapePointer(s: string): string {
  return s.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** RFC 4647 lookup over the theme's localized display text. */
export function displayText(doc: Readonly<Record<string, unknown>>, locale: string): { name: string; description?: string } {
  let name = String(doc.name ?? "");
  let description = typeof doc.description === "string" ? doc.description : undefined;
  const localized = isRecord(doc.localized) ? doc.localized : {};
  const keys = Object.keys(localized);
  let tag = locale;
  while (tag) {
    const hit = keys.find((k) => k.toLowerCase() === tag.toLowerCase());
    if (hit) {
      const l = localized[hit] as Record<string, unknown>;
      if (typeof l.name === "string") name = l.name;
      if (typeof l.description === "string") description = l.description;
      break;
    }
    const cut = tag.lastIndexOf("-");
    tag = cut > 0 ? tag.slice(0, cut) : "";
  }
  return description !== undefined ? { name, description } : { name };
}

function isProtected(path: string, protectedPaths: readonly string[]): boolean {
  return protectedPaths.some((p) => path === p || path.startsWith(`${p}.`));
}

/** `prepared` reuses validation of frozen documents; it never changes the output (FR-C071). */
export function resolve(input: ResolutionInput, prepared?: Prepared): ResolveResult {
  const c = new DiagnosticCollector("input");
  const policy = input.policy ?? {};
  const themes: ThemeEntry[] = (input.themes ?? []).map((e) => ({
    trust: e.trust === "trusted" ? "trusted" : "untrusted",
    document: e.document,
  }));
  if (input.theme) themes.push({ trust: "trusted", document: input.theme });
  const host = input.host && isRecord(input.host) ? input.host : null;

  // Stage 1: select.
  const selected = selectTheme(
    {
      themes,
      selection: input.selection,
      previous: input.previous ?? null,
      ...(policy.availableThemes ? { availableThemes: policy.availableThemes } : {}),
      ...(policy.defaultTheme ? { defaultTheme: policy.defaultTheme } : {}),
      host,
    },
    c,
    prepared,
  );
  const model = buildModel(selected.merged);
  const previousDoc =
    input.previous && input.previous.id === model.id
      ? themes.find((t) => t.document.id === input.previous!.id && t.document.version === input.previous!.version)?.document
      : undefined;

  // Preferences: effective set and FR-044 enforcement.
  const prefs = input.preferences ?? {};
  const declared = declaredPointIds(model);
  const points = effectivePoints(model, policy.permittedPoints, c);
  const previousPoints = previousDoc ? declaredPointIds(buildModel(previousDoc)) : new Set<string>();
  const enforced = new Map<string, EnforcedPreference>();
  const statusOut: Record<string, Record<string, unknown>> = {};
  for (const [pid, value] of Object.entries(prefs)) {
    const point = points.get(pid);
    const ptr = { document: "input", pointer: `/preferences/${escapePointer(pid)}` };
    if (!point) {
      if (!declared.has(pid) && previousPoints.has(pid)) c.add("OT-CUS-104", ptr);
      else c.add("OT-CUS-103", ptr);
      statusOut[pid] = { status: "skipped" };
      continue;
    }
    if (point.unusable) {
      enforced.set(pid, { point, status: "rejected", value });
      continue;
    }
    // A point whose every target is protected is skipped (chapter 09; no diagnostic).
    if (Array.isArray(point.target) && point.target.length > 0 && (point.target as string[]).every((t) => isProtected(t, policy.protected ?? []))) {
      statusOut[pid] = { status: "skipped", value };
      continue;
    }
    // A preference cannot undo a platform accessibility request (FR-052; no diagnostic).
    if (
      (pid === "std.contrast" && input.platform.contrast === "high" && value !== "high") ||
      (pid === "std.motion" && input.platform.reducedMotion && value !== "reduced")
    ) {
      enforced.set(pid, { point, status: "rejected", value });
      continue;
    }
    const e = enforce(point, value);
    if (e.status === "clamped") c.add("OT-CUS-101", ptr);
    if (e.status === "fell-back") c.add("OT-CUS-102", ptr);
    enforced.set(pid, e);
  }

  // Stage 2: context.
  const dim = (id: string): unknown => {
    const e = enforced.get(id);
    return e && e.status !== "rejected" ? e.value : undefined;
  };
  const supported = model.supportedSchemes;
  const allowed = policy.allowedColorSchemes;
  const ok = (s: unknown): s is string => typeof s === "string" && supported.includes(s) && (!allowed || allowed.includes(s));
  const wanted = [dim("std.color-scheme"), input.platform.colorScheme !== "no-preference" ? input.platform.colorScheme : undefined];
  let colorScheme = wanted.find(ok);
  if (!colorScheme) {
    const requested = wanted.find((w) => typeof w === "string");
    colorScheme = model.defaultScheme;
    if (requested !== undefined && requested !== colorScheme) c.add("OT-CTX-101", { document: "input", pointer: "/platform/colorScheme" });
  }
  const contrast: "standard" | "high" = input.platform.contrast === "high" || dim("std.contrast") === "high" ? "high" : "standard";
  const motion: "standard" | "reduced" = input.platform.reducedMotion || dim("std.motion") === "reduced" ? "reduced" : "standard";
  const densityPref = dim("std.density");
  const density = (typeof densityPref === "string" ? densityPref : "standard") as EvalContext["density"];
  const ctx: EvalContext = { colorScheme, contrast, motion, density, sizeClass: input.environment.sizeClass };

  const textPoint = dim("std.text-size");
  const inApp = typeof textPoint === "number" ? textPoint : 1;
  const range = points.get("std.text-size")?.effectiveRange ?? { min: 1, max: 3 };
  const product = input.platform.textScale * inApp;
  const clampedScale = product < range.min ? range.min : product > range.max ? range.max : product;
  // Rounded to 12 decimal places (chapter 11), half to even.
  const rawScale = clampedScale > input.platform.textScale ? clampedScale : input.platform.textScale;
  const textScale = roundHalfEven(rawScale * 1e12) / 1e12;

  const locks = isRecord(policy.locks) ? policy.locks : {};
  const contracts = hostContracts(host);
  const protectedPaths = policy.protected ?? [];
  const hostTokens = hostTokenDefs(host);

  const run = (rejected: ReadonlySet<string>) => {
    // Stage 3: declare.
    const decls = declareBase(model, ctx, hostTokens);
    const userPaths = new Set<string>();
    for (const [pid, e] of enforced) {
      if (!Array.isArray(e.point.target) || e.value === undefined) continue;
      if (e.status === "rejected" && !rejected.has(pid)) continue;
      const value = rejected.has(pid) ? e.point.default : e.value;
      if (value === undefined || value === null) continue;
      for (const target of e.point.target as string[]) {
        if (isProtected(target, protectedPaths)) continue;
        const existing = decls.get(target);
        const type = existing?.type ?? BASELINE.get(target)?.type;
        if (!type) continue;
        decls.set(target, { path: target, type, raw: value, layer: 3, document: "input", pointer: `/preferences/${escapePointer(pid)}` });
        if (!rejected.has(pid)) userPaths.add(target);
      }
    }
    const lockedComponents: Record<string, unknown> = {};
    for (const [path, value] of Object.entries(locks)) {
      if (path.startsWith("components.")) {
        lockedComponents[path] = value;
        continue;
      }
      const existing = decls.get(path);
      if (!existing) continue;
      if (aliasTarget(value) !== null || !shapeOf(existing.type, value)) {
        c.add("OT-TOK-004", { document: "input", pointer: `/policy/locks/${escapePointer(path)}` });
        continue;
      }
      decls.set(path, { ...existing, raw: value, layer: 4, document: "input", pointer: `/policy/locks/${escapePointer(path)}` });
      userPaths.delete(path);
    }
    for (const sd of styledDerivations(contracts, model, ctx, host !== null)) {
      decls.set(sd.path, { path: sd.path, type: sd.type as Decl["type"], raw: sd.raw, layer: 2, document: "theme", pointer: "" });
    }
    // Stage 4: evaluate.
    const result = evaluate(decls, "resolve", userPaths);
    for (const issue of result.issues) {
      if (issue.code === "OT-DRV-101" || issue.code === "OT-DRV-102") c.add(issue.code, { document: issue.document, pointer: issue.pointer });
    }
    return { decls, result, lockedComponents };
  };

  let pass = run(new Set());
  const forced = input.platform.forcedColors;
  let report = accessibilityReport(pass.result.values, ctx, forced);
  // Stage 7 floor: reject user values that a failing pair depends on, then re-run once.
  if ((policy.accessibilityFloor ?? "wcag22-aa") === "wcag22-aa") {
    const rejected = new Set<string>();
    for (const p of report.pairs) {
      if (p.pass) continue;
      for (const [pid, e] of enforced) {
        if (e.status === "rejected") continue;
        if (!Array.isArray(e.point.target)) continue;
        const depends = (e.point.target as string[]).some(
          (t) => pass.result.userDependent.has(t) && (pass.result.userDependent.has(p.foreground) || pass.result.userDependent.has(p.background)),
        );
        if (depends) rejected.add(pid);
      }
    }
    if (rejected.size > 0) {
      for (const pid of rejected) {
        c.add("OT-A11Y-007", { document: "input", pointer: `/preferences/${escapePointer(pid)}` });
        const e = enforced.get(pid)!;
        enforced.set(pid, { ...e, status: "rejected", value: prefs[pid] });
      }
      pass = run(rejected);
      report = accessibilityReport(pass.result.values, ctx, forced);
    }
  }
  for (const [pid, e] of enforced) {
    statusOut[pid] = { status: e.status, ...(e.value !== undefined ? { value: e.value } : {}) };
  }

  // Stage 5: post-process, then stage 6: quantize/encode.
  const values = new Map(pass.result.values);
  const tokens = new Map<string, unknown>();
  const derived = new Map<string, unknown>();
  for (const [path, v] of values) {
    if (path.startsWith("components.")) {
      derived.set(path, encodeValue(v));
      continue;
    }
    if (path.startsWith("primitive.")) continue;
    tokens.set(path, encodeValue(v));
  }
  postProcess(tokens, values, ctx, input, textScale, c, model.physical);
  resolveComposites(tokens);
  for (const p of report.pairs) void p;

  const components = resolveComponents(contracts, model, ctx, tokens, pass.lockedComponents, input.platform.forcedColors, host !== null, derived);
  const layout = resolveLayout(model, host, ctx.sizeClass, c);

  const resolved: Record<string, unknown> = {
    applied: { id: model.id, version: model.version, fallback: selected.fallback as Fallback, trust: selected.trust },
    context: {
      colorScheme,
      seedScheme: seedSchemeOf(model, colorScheme),
      contrast,
      motion,
      density,
      sizeClass: ctx.sizeClass,
      textScale,
      forcedColors: input.platform.forcedColors,
      direction: input.environment.direction,
      locale: input.environment.locale,
    },
    displayText: displayText(selected.entry.document, input.environment.locale),
    tokens: Object.fromEntries(tokens),
    components,
    layout,
    preferences: statusOut,
    accessibility: report,
  };
  const diagnostics = c.finish();
  resolved.diagnostics = diagnostics;
  return { resolved, diagnostics };
}

interface PairResult {
  readonly foreground: string;
  readonly background: string;
  readonly ratio: number;
  readonly threshold: number;
  readonly pass: boolean;
  readonly kind: string;
}

function accessibilityReport(values: ReadonlyMap<string, Value>, ctx: EvalContext, forced: boolean) {
  const pairs: PairResult[] = [];
  // Under forced colors every color is a system role, so no pair is measured (chapter 11).
  if (forced) return { mode: `${ctx.colorScheme}/${ctx.contrast}`, pairs, complete: [...BASELINE.keys()].every((p) => values.has(p)) };
  const seedPair = { foreground: "seed.foreground", background: "seed.background", kind: "text" as const };
  for (const pair of [seedPair, ...BASELINE_PAIRS]) {
    if (pair.kind === "disabled") continue;
    const fg = values.get(pair.foreground);
    const bg = values.get(pair.background);
    if (!fg || !bg || fg.k !== "color" || bg.k !== "color") continue;
    const ratio = contrastRatio(quantize(fg.lab), quantize(bg.lab));
    const threshold = THRESHOLDS[ctx.contrast][pair.kind];
    pairs.push({ foreground: pair.foreground, background: pair.background, ratio, threshold, pass: ratio >= threshold, kind: pair.kind });
  }
  void DISTINGUISHABLE;
  void DISTINGUISHABLE_THRESHOLD;
  const complete = [...BASELINE.keys()].every((p) => values.has(p));
  return { mode: `${ctx.colorScheme}/${ctx.contrast}`, pairs, complete };
}

function postProcess(
  tokens: Map<string, unknown>,
  values: ReadonlyMap<string, Value>,
  ctx: EvalContext,
  input: ResolutionInput,
  textScale: number,
  c: DiagnosticCollector,
  physical: ReadonlySet<string>,
): void {
  // Text scale: composite fontSize members and dimension lineHeight members.
  if (textScale !== 1) {
    for (const [path, v] of tokens) {
      if (BASELINE.get(path)?.type !== "typography" && !isComposite(v)) continue;
      if (!isComposite(v)) continue;
      const out: Record<string, unknown> = { ...v };
      for (const member of ["fontSize", "lineHeight"]) {
        const m = out[member];
        if (isRecord(m) && typeof m.value === "number" && m.unit === "px") out[member] = { ...m, value: m.value * textScale };
      }
      tokens.set(path, out);
    }
  }
  // Target size floor (FR-075).
  for (const path of [...tokens.keys()]) {
    if (path !== "size.target.min" && !path.startsWith("size.control.height.")) continue;
    const v = tokens.get(path);
    if (isRecord(v) && typeof v.value === "number" && v.value < 24) {
      tokens.set(path, { value: 24, unit: "px" });
      c.add("OT-A11Y-006", { document: "theme", pointer: `/tokens/${path.split(".").map(escapePointer).join("/")}` });
    }
  }
  // Reduced motion (FR-028).
  if (ctx.motion === "reduced") {
    for (const path of [...tokens.keys()]) {
      if (!path.startsWith("motion.duration.")) continue;
      const rm = BASELINE.get(path)?.reducedMotionDefault;
      tokens.set(path, rm !== undefined ? encodeValue(decodeLiteral("duration", rm)!) : { value: 0, unit: "ms" });
    }
  }
  // Logical start/end mirroring (FR-077).
  if (input.environment.direction === "rtl") {
    for (const path of [...tokens.keys()]) {
      if (!path.endsWith("-start") && !path.endsWith(".start")) continue;
      const other = path.replace(/(-|\.)start$/, "$1end");
      if (!tokens.has(other)) continue;
      const a = tokens.get(path);
      const b = tokens.get(other);
      if (physical.has(path) || physical.has(other) || isPhysical(a) || isPhysical(b)) continue;
      tokens.set(path, b);
      tokens.set(other, a);
    }
  }
  // Forced colors (FR-054).
  if (input.platform.forcedColors) {
    for (const [path, v] of values) {
      if (v.k !== "color" || !tokens.has(path)) continue;
      const role = BASELINE.get(path)?.forcedColor;
      tokens.set(path, { system: role ?? "canvas-text" });
    }
  }
  void jcs;
}

function isPhysical(v: unknown): boolean {
  return isRecord(v) && v.physical === true;
}

/** Layout variant selection (chapter 08): size-class map with fallback, host-declared only. */
function resolveLayout(
  model: ThemeModel,
  host: Readonly<Record<string, unknown>> | null,
  sizeClass: string,
  c: DiagnosticCollector,
) {
  const variants: Record<string, string> = {};
  const sel = isRecord(model.layout.variants) ? model.layout.variants : {};
  const declared = host && isRecord(host.layoutVariants) ? host.layoutVariants : {};
  const regions = [...new Set([...Object.keys(declared), ...Object.keys(sel)])];
  for (const region of regions) {
    const v = sel[region];
    let name: string | undefined;
    if (typeof v === "string") name = v;
    else if (isRecord(v)) {
      for (const key of [sizeClass, "expanded", "medium", "compact"]) {
        if (typeof v[key] === "string") {
          name = v[key] as string;
          break;
        }
      }
    }
    const entry = isRecord(declared[region]) ? (declared[region] as Record<string, unknown>) : undefined;
    if (name && host && (!entry || !Array.isArray(entry.variants) || !entry.variants.includes(name))) {
      c.add("OT-LAY-001", { document: "theme", pointer: `/layout/variants/${escapePointer(region)}` });
      name = undefined;
    }
    if (!name && entry && typeof entry.default === "string") name = entry.default;
    if (name) variants[region] = name;
  }
  return { variants };
}

export type { Decl, Contract };
export { CATALOG };
