/**
 * Cross-runtime determinism (NFR-C002; task T084): the SHA-256 of the JCS form of every resolution
 * fixture's result, through the public API. Pure: runs unchanged in Node and in a browser.
 */
import { createCore } from "../src/index.js";
import { jcs } from "../src/canonical/jcs.js";
import { base64, sha256, utf8Encode } from "../src/canonical/sha256.js";

export interface DeterminismCase {
  readonly id: string;
  readonly host: string | null;
  readonly themes: readonly { readonly trust: "trusted" | "untrusted"; readonly bytes: string }[];
  readonly request: Record<string, unknown>;
}

const ALL = { "user-created": true, imported: true, shared: true, "ai-generated": true } as const;

export function runDeterminism(cases: readonly DeterminismCase[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of cases) {
    const core = createCore({ untrustedSources: ALL, accessibilityGate: "relaxed" });
    if (c.host !== null) core.registry.admit({ kind: "host", bytes: c.host, trust: "trusted" });
    for (const t of c.themes) {
      core.registry.admit({ kind: "theme", bytes: t.bytes, trust: t.trust, ...(t.trust === "untrusted" ? { source: "shared" as const } : {}) });
    }
    const result = core.resolve(core.registry.snapshot(), c.request as never);
    out[c.id] = `sha256-${base64(sha256(utf8Encode(jcs(result))))}`;
  }
  return out;
}
