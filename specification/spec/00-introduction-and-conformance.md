# 00. Introduction and Conformance

**Status**: Normative. Specification version `1.0.0-draft.1`.

## Scope and product boundaries

OpenTheme defines a Theme Specification: a declarative, machine-readable contract for
presentation themes. A theme changes how an application looks, never what it does. OpenTheme is
not a page builder, business-logic framework, state manager, or auth/payment system.

The vocabulary is domain-neutral. Host applications declare their own semantic needs through
documented extension mechanisms. Consumer-specific concepts MUST NOT appear in this
specification.

## Terminology

This document uses the constitution's terms: Theme Specification, Theme, Customization Policy,
User Preferences, Core, Output target, Adapter, Host application, and Trusted source.

## Conformance classes

An implementation claims one or both classes:

| Class | Required kinds |
|---|---|
| *validator* | `validate`, `canonicalize`, `kernel` |
| *resolver* | all runner kinds: validate, resolve, canonicalize, flatten, compare-versions, migrate, kernel |

Conformance is demonstrated by passing the published conformance suite through the NDJSON runner
protocol. The suite, not any implementation, defines expected outcomes.

## Language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in
RFC 2119.

## Sources of truth

| Artifact | Role |
|---|---|
| Prose chapters in `specification/spec/` | Normative rules and algorithms |
| JSON Schemas in `specification/schemas/` | Structural constraints |
| Registries in `specification/registry/` | Closed vocabularies |
| Fixtures in `conformance/fixtures/` | Expected outcomes (NFR-010) |

When prose, schemas, registries, and fixtures disagree, the consistency check fails the build.
Every normative rule maps to at least one fixture, and every functional requirement maps to a
rule or an artifact check.

## Reference checker

The TypeScript reference checker (`ot-ref`) is **non-normative** and private. It exists to author
and verify artifacts. Implementations MUST NOT treat its source as the specification. Golden
results come from fixtures and kernel vectors, not from copying the reference checker.
