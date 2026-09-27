# Contract: Conformance Suite, Runner Protocol, and Reference Checker CLI

**Location after implementation**: `conformance/` (fixtures, sweep generators, runner) and
`tools/reference-checker/` (non-normative reference implementation). Fixture fields:
[data-model.md](../data-model.md) §18. Decisions: [research.md](../research.md) R7, R10, R16, and
R18.

The conformance suite, not any implementation, defines expected outcomes. Any implementation, in
any language, conforms by passing it through the runner protocol below. The protocol, fixtures,
runner, and reference checker are this feature's deliverables toward the SC-004 cross-feature
release gate (dual-implementation agreement is verified when the production core passes the same
suite).

## Suite layout

```text
conformance/
├── fixtures/
│   ├── valid/            # valid themes and host declarations, one rule focus each
│   ├── invalid/          # grouped by area: doc, meta, tok, ref, drv, ctx, cmp, lay, cus, inh, lim, a11y, host
│   ├── malicious/        # one or more per forbidden-content category and per resource limit (SC-003)
│   ├── resolution/       # layer-pair × dimension matrix, FB-001…FB-013, US3/US4 scenarios, text scale
│   ├── canonical/        # canonical form + integrity, export/re-import round trips (SC-011)
│   ├── inheritance/      # flattening, trust propagation, identifier collisions
│   ├── versioning/       # 1.x compatibility, deprecation, simulated previous major + migration (US6)
│   ├── examples/         # annotated minimal → full-featured examples (FR-092), mirrored from specification/examples
│   └── kernels/          # numeric kernel golden vectors (R7)
├── sweeps/
│   ├── accents.json      # SC-014 generator parameters (10×10×10 sRGB grid)
│   └── seeds.json        # SC-015 generator parameters
└── runner/               # implementation-agnostic runner (TypeScript), protocol below
```

## Fixture file

One JSON file per fixture (I-JSON). Any input document may be given as `{ "$file": "<path>" }`,
a repository-relative path restricted to `conformance/fixtures/**` and
`specification/{themes,hosts,examples}/**`, so fixtures exercise the published themes and hosts
without copying them. Inputs at or beyond the resource limits are produced instead by
`input.generate`, a closed set of deterministic generators that the runner expands into bytes
before sending a request, so the repository never stores multi-megabyte fixtures:

| Generator | Parameters | Produces |
|---|---|---|
| `pad-bytes` | `base` (inline theme), `bytes` | The base theme padded with an `$extensions` string to exactly `bytes` bytes |
| `nest-depth` | `depth` | An `$extensions` value nested to `depth` levels |
| `token-count` | `base`, `count` | The base theme with `count` primitive tokens |
| `reference-chain` | `base`, `length` | A chain of `length` aliases ending at a seed |
| `derivation-depth` | `base`, `depth` | One token whose derivation nests `depth` levels |
| `repeat-member` | `base`, `pointer`, `count`, `template` | `count` copies of `template` at `pointer`, with deterministic distinct names |

The expanded input is part of the fixture's meaning: every implementation receives identical
bytes.

```json
{
  "id": "invalid/ref/cycle-through-derivation",
  "kind": "validate",
  "rules": ["R-REF-004", "R-DRV-003"],
  "description": "A derives from B, and B aliases A: a reference cycle through a derivation.",
  "input": { "theme": { "…": "inline theme document" }, "bases": [], "host": null },
  "expect": {
    "validity": "invalid",
    "diagnostics": [
      { "code": "OT-REF-003", "location": { "document": "theme", "pointer": "/tokens/color/a/$derive" } }
    ]
  }
}
```

**Expectation semantics** (exact; no partial credit):

| Kind | `expect` members | Comparison |
|---|---|---|
| `validate` | `validity`, `diagnostics` | The ordered list of `(code, location)` pairs must equal the expected list exactly. Severity, rule, and params must match the registry |
| `resolve` | `resolved` (complete or `subset: true`), `diagnostics` | The JCS bytes of each expected member must equal the actual bytes |
| `canonicalize` | `canonical` (exact text), `integrity` | Byte equality |
| `flatten` | `document`, `lineage`, optional `diagnostics` | Canonical equality |
| `export-check` | `eligible`, `diagnostics` | Eligibility and exact diagnostic list |
| `compare-versions` | `classification`: `compatible` \| `breaking`, with reasons | Equality |
| `migrate` | `document`, `diagnostics` | Canonical equality and the exact diagnostic list |
| `kernel` | `vectors`: array of `[function, inputHex, outputHex]` | Bit equality |

- **Sweeps**: generators produce fixtures deterministically at run time from the parameters in
  `sweeps/`. With `--impl`, sweep requests go over the runner protocol to that
  implementation; without it, they run against the reference checker in-process. Their assertions are the ones in SC-014 and SC-015: completeness, every pair passing,
  and rejection only where the success criterion allows it.
- **Traceability**: every fixture's `rules` must exist in `rules.json`, and every rule must be
  exercised by at least one fixture (NFR-010).

## Runner protocol (for any implementation)

The runner launches an implementation's adapter executable and exchanges newline-delimited JSON
(one object per line, UTF-8) over standard input and output.

1. **Handshake**. The runner sends:

   ```json
   {"type":"hello","protocol":"1","spec":"1.0"}
   ```

   The implementation replies:

   ```json
   {"type":"hello","implementation":"<name>","version":"<semver>","supports":["validate","resolve","canonicalize","flatten","compare-versions","migrate","kernel"]}
   ```

2. **Requests**. The runner sends

   ```json
   {"type":"request","id":"<fixture id>","kind":"validate","input":{…}}
   ```

   and the implementation replies

   ```json
   {"type":"response","id":"<fixture id>","result":{…}}
   ```

   or

   ```json
   {"type":"response","id":"<fixture id>","unsupported":true}
   ```

   `result` has the same members as `expect`, fully populated.

3. **Shutdown**. The runner sends `{"type":"bye"}`, and the implementation exits with code 0.

Rules:

- The runner's options are `--impl <command>` (default: the reference checker), `--filter <glob>`
  on fixture identifiers, `--verbose` (show expected and actual results), and `--report <dir>`.
- The runner applies a per-request timeout (10 s).
- It reports pass, fail, unsupported, and timeout per fixture, as a summary and in JUnit XML.
- An implementation claims conformance only if every fixture passes. "Unsupported" is allowed only
  for kinds outside the claimed conformance class. The classes are *validator* (validate,
  canonicalize, kernel) and *resolver* (all kinds).
- The protocol carries data only. The runner never executes code taken from fixtures.

## Reference checker CLI (`ot-ref`)

This is a non-normative, private implementation used to author and verify the suite. It is not
published as a product (R18).

| Command | Purpose | Output | Exit code |
|---|---|---|---|
| `ot-ref validate <theme> [--base <file>]… [--host <file>] [--json]` | Validate a theme | Diagnostics plus the accessibility report | 0 valid, 1 invalid, 2 unsupported |
| `ot-ref validate-host <host> [--json]` | Validate a host declaration | Diagnostics | 0 or 1 |
| `ot-ref resolve <input.json> [--json]` | Resolve a resolution input | Resolved theme | 0 |
| `ot-ref canonicalize <theme>` | Canonical bytes and integrity | Text | 0 or 1 |
| `ot-ref flatten <theme> --base <file>…` | Export flattening | Document | 0 or 1 |
| `ot-ref export-check <theme> [--base <file>]…` | Export eligibility (US7 scenario 4) | Diagnostics | 0 eligible, 1 not |
| `ot-ref compare <old> <new>` | Theme version classification (FR-084) | Classification | 0 |
| `ot-ref migrate <theme> --manifest <file>` | Apply a migration manifest | Document plus diagnostics | 0 or 1 |
| `ot-ref serve-conformance` | Runner protocol endpoint | NDJSON | 0 |

Every command is non-interactive. `--json` produces machine-readable output on stdout, and
human-readable output goes to stderr. Exit code 3 means a usage error, and 4 an internal error
(Principle XI).
