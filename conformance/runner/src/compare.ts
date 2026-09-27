/**
 * Comparison rules for conformance fixture expectations (contracts/conformance.md).
 */
import { createHash } from "node:crypto";

export type DiagnosticLike = {
  code: string;
  location?: { document?: string; pointer?: string };
  severity?: string;
  rule?: string;
  params?: Record<string, unknown>;
};

export type CompareResult = {
  ok: boolean;
  failures: string[];
};

function locKey(d: DiagnosticLike): string {
  const doc = d.location?.document ?? "";
  const ptr = d.location?.pointer ?? "";
  return `${d.code}|${doc}|${ptr}`;
}

/** Ordered list of (code, location) pairs must match exactly. */
export function compareDiagnostics(
  expected: DiagnosticLike[],
  actual: DiagnosticLike[],
): CompareResult {
  const failures: string[] = [];
  const expKeys = expected.map(locKey);
  const actKeys = actual.map(locKey);
  if (expKeys.length !== actKeys.length) {
    failures.push(
      `diagnostic count: expected ${expKeys.length}, got ${actKeys.length}`,
    );
  }
  const n = Math.max(expKeys.length, actKeys.length);
  for (let i = 0; i < n; i += 1) {
    if (expKeys[i] !== actKeys[i]) {
      failures.push(
        `diagnostic[${i}]: expected ${expKeys[i] ?? "(missing)"}, got ${actKeys[i] ?? "(missing)"}`,
      );
    }
  }

  // When counts match, also check severity/rule/params for paired entries
  if (expKeys.length === actKeys.length) {
    for (let i = 0; i < expected.length; i += 1) {
      const e = expected[i]!;
      const a = actual[i]!;
      if (e.severity !== undefined && e.severity !== a.severity) {
        failures.push(
          `diagnostic[${i}] severity: expected ${e.severity}, got ${a.severity}`,
        );
      }
      if (e.rule !== undefined && e.rule !== a.rule) {
        failures.push(
          `diagnostic[${i}] rule: expected ${e.rule}, got ${a.rule}`,
        );
      }
      if (e.params !== undefined) {
        const ej = JSON.stringify(e.params);
        const aj = JSON.stringify(a.params ?? {});
        if (ej !== aj) {
          failures.push(
            `diagnostic[${i}] params: expected ${ej}, got ${aj}`,
          );
        }
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

/** RFC 8785-style deterministic JSON string for byte compare (sorted keys). */
export function jcsLike(value: unknown): string {
  return canonicalize(value);
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
      .join(",")}}`;
  }
  if (typeof value === "undefined") {
    return "null";
  }
  throw new TypeError(`unsupported JSON value: ${typeof value}`);
}

function pickPath(root: unknown, dotted: string): unknown {
  const parts = dotted.split(".");
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Resolve a subset path against a resolved theme, understanding flat token
 * maps (`tokens.color.surface.base.srgb8`), preference ids with dots
 * (`preferences.std.color-scheme.status`), and component ids with slashes.
 */
export function pickResolved(root: unknown, dotted: string): unknown {
  if (!root || typeof root !== "object") return undefined;
  const obj = root as Record<string, unknown>;

  if (dotted.startsWith("preferences.")) {
    const rest = dotted.slice("preferences.".length);
    const prefs = (obj.preferences ?? {}) as Record<string, unknown>;
    const keys = Object.keys(prefs).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (rest === k) return prefs[k];
      if (rest.startsWith(`${k}.`)) {
        return pickPath(prefs[k], rest.slice(k.length + 1));
      }
    }
    return undefined;
  }

  if (dotted.startsWith("tokens.")) {
    const rest = dotted.slice("tokens.".length);
    const tokens = (obj.tokens ?? {}) as Record<string, unknown>;
    const keys = Object.keys(tokens).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (rest === k) return tokens[k];
      if (rest.startsWith(`${k}.`)) {
        return pickPath(tokens[k], rest.slice(k.length + 1));
      }
    }
    return undefined;
  }

  if (dotted.startsWith("components.")) {
    const rest = dotted.slice("components.".length);
    const components = (obj.components ?? {}) as Record<string, unknown>;
    const keys = Object.keys(components).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (rest === k) return components[k];
      if (rest.startsWith(`${k}.`)) {
        return pickPath(components[k], rest.slice(k.length + 1));
      }
    }
    return undefined;
  }

  return pickPath(root, dotted);
}

/**
 * Compare resolve results by JCS bytes. When `subset: true`, only listed members
 * of `expected.resolved` are compared against the actual resolved object.
 */
export function compareResolved(
  expected: { resolved?: unknown; subset?: boolean; diagnostics?: DiagnosticLike[] },
  actual: { resolved?: unknown; diagnostics?: DiagnosticLike[] },
): CompareResult {
  const failures: string[] = [];

  if (expected.diagnostics) {
    const d = compareDiagnostics(
      expected.diagnostics,
      actual.diagnostics ?? [],
    );
    failures.push(...d.failures);
  }

  if (expected.resolved === undefined) {
    return { ok: failures.length === 0, failures };
  }

  if (expected.subset === true) {
    const exp = expected.resolved as Record<string, unknown>;
    const act = actual.resolved;
    for (const [key, expVal] of Object.entries(exp)) {
      const actVal = pickResolved(act, key);
      const ej = jcsLike(expVal);
      const aj = jcsLike(actVal);
      if (ej !== aj) {
        failures.push(`resolved.${key}: JCS mismatch`);
      }
    }
  } else {
    const ej = jcsLike(expected.resolved);
    const aj = jcsLike(actual.resolved);
    if (ej !== aj) {
      failures.push(
        `resolved: JCS mismatch (expected sha256=${sha(ej)}, actual sha256=${sha(aj)})`,
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
}

/** Kernel vectors must match bit for bit. */
export function compareKernels(
  expected: Array<[string, string, string]>,
  actual: Array<[string, string, string]>,
): CompareResult {
  const failures: string[] = [];
  if (expected.length !== actual.length) {
    failures.push(
      `vector count: expected ${expected.length}, got ${actual.length}`,
    );
  }
  const n = Math.max(expected.length, actual.length);
  for (let i = 0; i < n; i += 1) {
    const e = expected[i];
    const a = actual[i];
    if (!e || !a) {
      failures.push(`vector[${i}]: missing`);
      continue;
    }
    if (e[0] !== a[0] || e[1] !== a[1] || e[2] !== a[2]) {
      failures.push(
        `vector[${i}]: expected [${e.join(",")}], got [${a.join(",")}]`,
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

export function compareValidate(
  expected: {
    validity?: string;
    diagnostics?: DiagnosticLike[];
  },
  actual: {
    validity?: string;
    diagnostics?: DiagnosticLike[];
  },
): CompareResult {
  const failures: string[] = [];
  if (expected.validity !== undefined && expected.validity !== actual.validity) {
    failures.push(
      `validity: expected ${expected.validity}, got ${actual.validity}`,
    );
  }
  if (expected.diagnostics) {
    const d = compareDiagnostics(
      expected.diagnostics,
      actual.diagnostics ?? [],
    );
    failures.push(...d.failures);
  }
  return { ok: failures.length === 0, failures };
}

export function compareVersionsResult(
  expected: {
    classification?: string;
    reasons?: Array<{ kind?: string; detail?: string }>;
  },
  actual: {
    classification?: string;
    reasons?: Array<{ kind?: string; detail?: string }>;
  },
): CompareResult {
  const failures: string[] = [];
  if (
    expected.classification !== undefined &&
    expected.classification !== actual.classification
  ) {
    failures.push(
      `classification: expected ${expected.classification}, got ${actual.classification}`,
    );
  }
  if (expected.reasons) {
    const ek = expected.reasons.map((r) => `${r.kind}|${r.detail}`).join(";");
    const ak = (actual.reasons ?? [])
      .map((r) => `${r.kind}|${r.detail}`)
      .join(";");
    if (ek !== ak) {
      failures.push(`reasons: expected [${ek}], got [${ak}]`);
    }
  }
  return { ok: failures.length === 0, failures };
}

export function compareMigrateResult(
  expected: {
    migrated?: boolean;
    diagnostics?: DiagnosticLike[];
    document?: { opentheme?: string };
  },
  actual: {
    migrated?: boolean;
    diagnostics?: DiagnosticLike[];
    document?: { opentheme?: string };
  },
): CompareResult {
  const failures: string[] = [];
  if (expected.migrated !== undefined && expected.migrated !== actual.migrated) {
    failures.push(
      `migrated: expected ${expected.migrated}, got ${actual.migrated}`,
    );
  }
  if (
    expected.document?.opentheme !== undefined &&
    expected.document.opentheme !== actual.document?.opentheme
  ) {
    failures.push(
      `opentheme: expected ${expected.document.opentheme}, got ${actual.document?.opentheme}`,
    );
  }
  if (expected.diagnostics) {
    const d = compareDiagnostics(
      expected.diagnostics,
      actual.diagnostics ?? [],
    );
    failures.push(...d.failures);
  }
  return { ok: failures.length === 0, failures };
}

export function compareCanonicalizeResult(
  expected: { canonical?: string; integrity?: string },
  actual: { canonical?: string; integrity?: string },
): CompareResult {
  const failures: string[] = [];
  if (expected.canonical !== undefined && expected.canonical !== actual.canonical) {
    failures.push("canonical bytes differ");
  }
  if (expected.integrity !== undefined && expected.integrity !== actual.integrity) {
    failures.push(
      `integrity: expected ${expected.integrity}, got ${actual.integrity}`,
    );
  }
  return { ok: failures.length === 0, failures };
}

export function compareFlattenResult(
  expected: {
    document?: unknown;
    lineage?: unknown;
    diagnostics?: DiagnosticLike[];
    ok?: boolean;
  },
  actual: {
    document?: unknown;
    lineage?: unknown;
    diagnostics?: DiagnosticLike[];
    ok?: boolean;
  },
): CompareResult {
  const failures: string[] = [];
  if (expected.ok !== undefined && expected.ok !== actual.ok) {
    failures.push(`ok: expected ${expected.ok}, got ${actual.ok}`);
  }
  if (expected.document !== undefined) {
    if (jcsLike(expected.document) !== jcsLike(actual.document)) {
      failures.push("document differs");
    }
  }
  if (expected.lineage !== undefined) {
    if (jcsLike(expected.lineage) !== jcsLike(actual.lineage)) {
      failures.push("lineage differs");
    }
  }
  if (expected.diagnostics) {
    const d = compareDiagnostics(
      expected.diagnostics,
      actual.diagnostics ?? [],
    );
    failures.push(...d.failures);
  }
  return { ok: failures.length === 0, failures };
}

export function compareExportCheckResult(
  expected: { eligible?: boolean; diagnostics?: DiagnosticLike[] },
  actual: { eligible?: boolean; diagnostics?: DiagnosticLike[] },
): CompareResult {
  const failures: string[] = [];
  if (expected.eligible !== undefined && expected.eligible !== actual.eligible) {
    failures.push(
      `eligible: expected ${expected.eligible}, got ${actual.eligible}`,
    );
  }
  if (expected.diagnostics) {
    const d = compareDiagnostics(
      expected.diagnostics,
      actual.diagnostics ?? [],
    );
    failures.push(...d.failures);
  }
  return { ok: failures.length === 0, failures };
}

export function comparePreferencesResult(
  expected: { usable?: boolean; values?: unknown; diagnostics?: DiagnosticLike[] },
  actual: { usable?: boolean; values?: unknown; diagnostics?: DiagnosticLike[] },
): CompareResult {
  const failures: string[] = [];
  if (expected.usable !== undefined && expected.usable !== actual.usable) {
    failures.push(`usable: expected ${expected.usable}, got ${actual.usable}`);
  }
  if (expected.values !== undefined && jcsLike(expected.values) !== jcsLike(actual.values)) {
    failures.push("values differ");
  }
  if (expected.diagnostics) {
    const d = compareDiagnostics(expected.diagnostics, actual.diagnostics ?? []);
    failures.push(...d.failures);
  }
  return { ok: failures.length === 0, failures };
}
