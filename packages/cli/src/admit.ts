/**
 * Admission with command-line trust (research LR2; FR-T010 to FR-T012). One Core per run: host
 * declarations first (trusted developer input), then base themes, then the themes the command is
 * about. Trust comes only from --trusted; nothing inside a document changes it.
 */
import { createCore, type Core, type Diagnostic, type OperationalError, type RegistryEntry } from "@opentheme/core";
import type { InputOptions } from "./args.js";
import { readInput } from "./io.js";

export interface Admitted {
  readonly path: string;
  readonly kind: "theme" | "host";
  readonly validity: "valid" | "invalid" | "refused";
  readonly diagnostics: readonly Diagnostic[];
  readonly error: OperationalError | null;
  readonly entry: RegistryEntry | null;
}

export function openCore(options: InputOptions): Core {
  return createCore({
    untrustedSources: { [options.source]: true },
    accessibilityGate: options.relaxedGate ? "relaxed" : "enforce",
  });
}

/** A host declaration carries `openthemeHost`; this peek is the only look at the bytes before Core. */
export function kindOf(bytes: Uint8Array): "theme" | "host" {
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return v !== null && typeof v === "object" && !Array.isArray(v) && "openthemeHost" in v ? "host" : "theme";
  } catch {
    return "theme";
  }
}

export function admit(core: Core, path: string, bytes: Uint8Array, kind: "theme" | "host", options: InputOptions): Admitted {
  const trusted = kind === "host" || options.trusted;
  const r = core.registry.admit(
    trusted ? { kind, bytes, trust: "trusted" } : { kind, bytes, trust: "untrusted", source: options.source },
  );
  const validity = r.status === "registered" || r.status === "already-registered" ? "valid" : r.status;
  return { path, kind, validity, diagnostics: r.diagnostics, error: r.error, entry: r.entry };
}

/**
 * Admit the --host and --base inputs; returns their results, in the order given, so failures can
 * be shown. A base can only be admitted after the base it extends, so bases are admitted in passes
 * until a pass admits nothing new; the order on the command line does not matter.
 */
export function admitContext(core: Core, options: InputOptions): Admitted[] {
  const out: Admitted[] = [];
  if (options.host) out.push(admit(core, options.host, readInput(options.host), "host", options));
  const bytes = options.bases.map((b) => readInput(b));
  const results = new Map<number, Admitted>();
  for (let progress = true; progress; ) {
    progress = false;
    options.bases.forEach((path, i) => {
      if (results.get(i)?.validity === "valid") return;
      const r = admit(core, path, bytes[i]!, "theme", options);
      if (r.validity === "valid") progress = true;
      results.set(i, r);
    });
  }
  options.bases.forEach((_, i) => out.push(results.get(i)!));
  return out;
}
