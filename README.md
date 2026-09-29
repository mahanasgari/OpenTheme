# OpenTheme

OpenTheme is an open, domain-neutral **Theme Specification**: a declarative, machine-readable
contract for presentation themes. A theme changes how an application looks, never what it does.
This repository holds the specification, its conformance suite, and **OpenTheme Core**, a
framework-agnostic runtime that implements it.

**Status**: specification `1.0.0-draft.3`, `@opentheme/core` `0.1.0-draft`. Drafts
carry no compatibility guarantee.

## What is here

| Path | What it is |
|---|---|
| [`specification/`](specification/) | The normative specification: chapters 00–18, JSON Schemas, registries, the baseline and reference themes, example hosts, and the [changelog](specification/CHANGELOG.md) |
| [`conformance/`](conformance/) | 284 conformance fixtures, sweeps, and the implementation-agnostic runner (NDJSON protocol) |
| [`packages/core/`](packages/core/) | `@opentheme/core`: trust-aware admission, a theme registry, deterministic resolution, and a preferences controller ([README](packages/core/README.md)) |
| [`packages/web/`](packages/web/) | `@opentheme/web`: applies resolved themes to web pages as CSS custom properties, follows system settings live, and remembers preferences on the device ([README](packages/web/README.md)) |
| [`tools/`](tools/) | Private tooling: the non-normative reference checker `ot-ref`, spec-lint, generated types, benchmarks, and the Python kernel cross-check |
| [`specs/`](specs/) | Spec Kit feature documents: [001 Foundation](specs/001-theme-specification-foundation/), [002 Core runtime](specs/002-core-runtime/), and [003 Web adapter](specs/003-web-adapter/) |
| [`evaluations/`](evaluations/) | Manual evaluation protocols |

## Key properties

- **Declarative and safe.** Themes are data (I-JSON) with bounded size, depth, and effort; they
  never carry code.
- **Trust is host-assigned.** Trust comes from where the host got a document, never from the
  document's content. Untrusted themes are validated, gated, and cannot impersonate trusted ones.
- **Deterministic.** Resolution produces byte-identical results across runtimes. Color math uses
  normative binary64 kernels, not platform math.
- **Accessible by default.** Contrast floors, high-contrast and forced-colors modes, reduced motion,
  and text scaling are part of the specification.
- **Two independent implementations.** Core and the reference checker agree byte for byte on every
  fixture and sweep, checked in CI.

## Getting started

Requires Node.js 24 or later, pnpm 10, and Python 3 (for the kernel cross-check).

```bash
pnpm install
pnpm build
pnpm verify              # every gate, including the performance budgets
pnpm verify:correctness  # every gate except the benchmarks (what CI blocks on)
```

Other useful commands: `pnpm conformance` (reference checker), `pnpm conformance:core` (Core),
`pnpm crosscheck:core`, `pnpm bench:core`, and `pnpm bench:core:browser` (a self-contained page
for running Core's determinism check and benchmarks in a browser), `pnpm conformance:web`, and
`pnpm bench:web:browser`.

To use Core, see [`packages/core/README.md`](packages/core/README.md) and the agent guide
[`packages/core/AGENTS.md`](packages/core/AGENTS.md); for web pages, see
[`packages/web/README.md`](packages/web/README.md). Contributors and coding agents should read
[`AGENTS.md`](AGENTS.md) for the repository's invariants.

## License

- Code, JSON Schemas, registries, conformance fixtures, and the official themes: [Apache
  License 2.0](LICENSE).
- Specification prose (`specification/spec/`, the changelog, and the other documentation):
  [Creative Commons Attribution 4.0 International](LICENSE-docs).
