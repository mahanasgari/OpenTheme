<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Bump rationale: Initial ratification. All template placeholders replaced with OpenTheme governance.
The template's five principle slots were expanded to the thirteen principles requested.

Principles (template slot → ratified title):
- [PRINCIPLE_1_NAME] → I. Presentation Is Separate from Business Logic (NON-NEGOTIABLE)
- [PRINCIPLE_2_NAME] → II. End-User Personalization Is First-Class
- [PRINCIPLE_3_NAME] → III. Developer-Defined Boundaries
- [PRINCIPLE_4_NAME] → IV. Specification-Driven Themes
- [PRINCIPLE_5_NAME] → V. Framework-Agnostic Core, Thin Adapters
- (new) → VI. Untrusted Themes Are Sandboxed (NON-NEGOTIABLE)
- (new) → VII. AI Acts Only Through the Theme Specification (NON-NEGOTIABLE)
- (new) → VIII. Accessible, Responsive, and Usable by Default
- (new) → IX. Versioned Contracts and Backward Compatibility
- (new) → X. Deterministic and Testable
- (new) → XI. AI-Agent-Friendly Developer Experience
- (new) → XII. Open Core Without Required Cloud Services (NON-NEGOTIABLE)
- (new) → XIII. Extensible by Design, Not by Speculation

Added sections:
- [SECTION_2_NAME] → Product Scope and Architectural Constraints
- [SECTION_3_NAME] → Development Workflow and Quality Gates
- Governance (populated)

Removed sections: none

Dependent templates (read the constitution at runtime; not edited by this command):
- ✅ .specify/templates/plan-template.md — "Constitution Check" gates derive from the
  "Development Workflow and Quality Gates" section; compatible.
- ✅ .specify/templates/spec-template.md — compatible.
- ✅ .specify/templates/checklist-template.md — compatible.
- ⚠ .specify/templates/tasks-template.md — defaults to "Tests are OPTIONAL". Principle X makes
  tests mandatory for core, Theme Specification/schemas, policy enforcement, output targets,
  adapters, migrations, and the untrusted-input pipeline. /speckit-tasks MUST include test tasks
  for those scopes (stated in Quality Gates). Template left unchanged (outside command scope).

Deferred TODOs:
- TODO(LICENSE): Select the OSI-approved license for the open-source core (Principle XII).
- TODO(MAINTAINERS): Define the maintainer group that approves amendments (Governance).
-->

# OpenTheme Constitution

OpenTheme is an open-source, universal theme and personalization infrastructure for applications.
Developers integrate OpenTheme to offer themes; end users choose and personalize their appearance
within developer-defined boundaries. This constitution defines the rules every specification,
plan, task, and contribution MUST satisfy. The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and
MAY are to be interpreted as described in RFC 2119.

## Core Principles

### I. Presentation Is Separate from Business Logic (NON-NEGOTIABLE)

- A theme MUST describe presentation only: design tokens (e.g., color, typography, spacing,
  sizing, radius, border, elevation, motion, opacity, density) and the appearance of
  host-declared components, parts, and variants.
- Themes MUST NOT contain, invoke, or influence business logic, data access, network calls,
  routing, permissions, content, or application behavior. Switching or personalizing a theme
  MUST change how an application looks, never what it does.
- Applying, switching, or personalizing a theme MUST be a runtime data operation and MUST NOT
  require host application code changes beyond the initial integration.
- Host applications MUST consume themes through semantic tokens and component contracts
  (e.g., `color.surface`, `button.primary.background`), never through theme-specific
  identifiers, so any conforming theme can replace any other.
- The Theme Specification vocabulary, core, and official adapters MUST be domain-neutral.
  Domain-specific concepts (e.g., products, carts, orders) MUST NOT appear in them; host
  applications define their own semantic tokens through documented extension mechanisms.

**Rationale**: Strict separation is what allows themes to be swapped, shared, AI-generated, and
sandboxed safely, and it keeps OpenTheme usable by any application in any domain.

### II. End-User Personalization Is First-Class

- Core MUST model personalization natively as a layer over the selected theme. End users MUST be
  able to select among available themes and adjust permitted values without developer code per
  change.
- User preferences MUST be stored as a separate, serializable, versioned document of selections
  and overrides that references a theme, never as a modified copy of the theme, so preferences
  survive theme updates and can be exported, imported, and reset.
- End users MUST always be able to reset to the developer default and SHOULD be able to preview
  changes before applying them.
- Personalization MUST take effect at runtime without an application reload on platforms that
  support live updates.
- Preference persistence MUST go through a pluggable storage interface with at least one local
  (on-device) implementation. Core MUST NOT transmit preferences anywhere on its own.
- Exported or shared themes MUST contain only theme data and explicitly chosen metadata, never
  host application data or unrelated user preferences.
- Future user capabilities (creating, saving, AI-assisted editing, and sharing themes) MUST reuse
  the same Theme Specification, preference model, validation, and policy enforcement. They
  MUST NOT introduce a parallel theme format.

**Rationale**: Personalization is OpenTheme's differentiator. Treating it as an add-on would force
every host to reinvent storage, merging, and enforcement, each inconsistently.

### III. Developer-Defined Boundaries

- Developers MUST be able to declare, in a Customization Policy validated against a published
  schema: which themes are available and which is the default; which tokens and properties end
  users may change; permitted values (ranges, enumerations, palettes, step sizes); locked
  tokens; and whether user-created, imported, shared, or AI-generated themes are allowed.
- Policy MUST be enforced by core at resolution time, not only by UI controls. Every input
  source (UI, API, import, sharing, AI) MUST pass through the same enforcement.
- Values outside policy MUST be rejected or clamped by a documented, deterministic rule and
  reported as a diagnostic. They MUST NOT be silently applied.
- Developer policy is the final authority over user, imported, and AI-generated values. Locked
  tokens MUST always resolve to developer-defined values.
- Defaults MUST be closed: without explicit developer permission, end users can only select among
  developer-registered themes, and token-level customization, importing, and AI features are
  disabled. Enabling common personalization MUST be possible with a single documented setting
  (e.g., a preset policy).
- Developers MUST be able to adopt OpenTheme using only prebuilt themes and configuration,
  without authoring a theme. Developer-authored themes are a later capability and, when added,
  MUST use the same Theme Specification.

**Rationale**: Developers own their product's brand, accessibility, and quality guarantees.
Boundaries enforced in a single place make offering personalization safe.

### IV. Specification-Driven Themes

- Every theme MUST be a declarative data document conforming to the published, versioned,
  machine-readable Theme Specification (schemas plus normative rules). The Theme Specification
  is the single source of truth; core, adapters, tooling, types, documentation, and AI
  integrations MUST derive from it rather than restate it.
- Themes MUST be pure data. They MUST NOT contain executable code, scripts, raw stylesheets,
  selectors, or expressions that target host internals.
- Every theme MUST declare its identity and the Theme Specification version it targets, and MUST
  be validated against that version before use. Invalid themes MUST NOT be partially applied;
  core MUST fall back to the last valid theme or the developer default.
- The Theme Specification MUST support at minimum: primitive and semantic token layers, token
  references (aliases) with cycle detection, modes (at least light, dark, and high-contrast),
  and theme metadata.
- New theming capabilities MUST be specified (schema, normative rules, conformance fixtures)
  before or alongside their implementation. Behavior not described by the specification MUST
  NOT be relied upon by adapters, tooling, or host applications.
- The Theme Specification SHOULD interoperate with widely adopted design-token formats (e.g., the
  W3C Design Tokens Community Group format) through import and export. Divergence MUST be
  justified in the specification.

**Rationale**: A strict specification makes themes portable across frameworks, validatable, safe
to exchange, and generatable by AI.

### V. Framework-Agnostic Core, Thin Adapters

- Core (specification handling, validation, resolution, policy enforcement, preference merging,
  and diagnostics) MUST NOT depend on any UI framework, rendering library, or DOM API.
- Platform-specific output (e.g., CSS custom properties, native style objects) MUST be
  implemented as separate output targets that consume core's resolved token set.
- Framework adapters (e.g., React, Vue, Svelte, Angular, Web Components, React Native) MUST be
  thin: limited to lifecycle, reactivity, context or dependency injection, and server-rendering
  and hydration bindings. Adapters MUST NOT reimplement or alter validation, resolution, or
  policy logic.
- Every adapter and output target MUST pass a shared conformance suite proving it yields the same
  resolved result as core for the same inputs.
- The Theme Specification MUST be language-neutral so implementations in other languages and
  platforms are possible.
- Core, output targets, and adapters MUST be independently versioned packages so a host installs
  only what it uses.

**Rationale**: Behavior defined once in core stays consistent everywhere, and thin adapters make
new frameworks cheap to support and hard to get wrong.

### VI. Untrusted Themes Are Sandboxed (NON-NEGOTIABLE)

- Any theme, preference document, or theme package not bundled by the developer at build time,
  including user-created, imported, shared, marketplace, and AI-generated content, MUST be
  treated as untrusted input.
- Before use, untrusted input MUST pass: schema validation; resource limits (document size,
  token count, reference depth, nesting); reference-cycle detection; value type checking; and
  Customization Policy enforcement.
- Core and output targets MUST emit values only through typed, escaping serializers. Theme values
  MUST NOT be string-concatenated into CSS, markup, or code, and MUST NOT enable injection
  (e.g., `url()` to non-allowlisted origins, `@import`, or escaping the declaration context).
- Applying a theme MUST NOT execute code, access host application data, or make network
  requests. External assets (e.g., fonts, images) MUST be limited to developer-allowlisted
  origins or embedded resources with type and size limits, and are disabled by default for
  untrusted themes.
- Theme application MUST be confined to the host-designated scope (e.g., a root element or
  subtree) and MUST NOT affect content outside it. Previews of untrusted themes MUST NOT modify
  persisted state until the user accepts them.
- Developers MUST be able to mark tokens used by security- or safety-critical UI (e.g., warnings,
  destructive actions, consent and legal text) as protected so no untrusted source can alter
  them.
- Failures MUST fail closed: rejected input is not applied, the prior valid state is preserved,
  and a structured diagnostic is emitted without leaking host data.
- Changes to parsing, validation, serialization, import, or sandboxing code MUST include tests
  with malicious fixtures and MUST receive an explicit security-focused review.

**Rationale**: Sharing, marketplaces, and AI generation turn themes into an attack surface.
Treating every non-bundled theme as hostile is the only safe default.

### VII. AI Acts Only Through the Theme Specification (NON-NEGOTIABLE)

- This principle governs AI capabilities that OpenTheme provides or integrates (creating,
  modifying, explaining, or repairing themes). It does not restrict the coding assistants
  developers use to build their applications (see Principle XI).
- AI capabilities MUST read and produce only Theme Specification documents, user preference
  documents, or structured patch operations against them. AI MUST NOT generate, modify, or
  execute application code, stylesheets, scripts, or UI trees.
- AI output MUST be treated as untrusted input (Principle VI) and MUST pass the same validation
  and policy enforcement (Principle III). No AI-specific bypass may exist.
- AI-proposed changes MUST be previewable and reversible, and MUST be applied or persisted only
  after explicit user acceptance.
- Core MUST NOT depend on any AI provider or model. AI integration MUST be optional, provided
  through a provider-agnostic interface, and disabled unless the developer enables it.
- Data sent to an AI provider MUST be limited to the theme, policy constraints, and user request
  needed for the task. Host application data MUST NOT be included unless the developer
  explicitly supplies it.
- The Theme Specification MUST remain AI-consumable: schemas carry descriptions, constraints, and
  examples, and validation errors are structured so an AI can self-correct.

**Rationale**: Constraining AI to the specification makes its output safe, bounded by developer
policy, reviewable by users, and portable across models and providers.

### VIII. Accessible, Responsive, and Usable by Default

- Official and prebuilt themes MUST meet WCAG 2.2 Level AA contrast requirements for text and
  non-text UI components in every mode they ship, verified by automated checks in CI.
- Core MUST provide contrast validation for token pairs that the Theme Specification declares as
  foreground/background relationships. The default policy MUST prevent personalization and
  untrusted themes from producing pairs below WCAG 2.2 AA. Developers MAY relax this only
  explicitly, and a relaxed policy MUST emit diagnostics.
- Themes MUST honor platform accessibility preferences, including increased contrast, forced
  colors, reduced motion, and text scaling. Explicit end-user choices (e.g., selecting dark
  mode) MAY override system defaults such as color scheme.
- The Theme Specification MUST support responsive and adaptive values (e.g., per-breakpoint or
  density variants) where they affect presentation. Typography MUST remain compatible with user
  text scaling, and directional values MUST use logical (start/end) semantics so themes work in
  right-to-left locales.
- Integrations MUST support resolving the active theme before first paint, including during
  server-side rendering where the platform allows, so users never see a flash of the wrong
  theme.
- Any personalization UI shipped by OpenTheme MUST be fully keyboard-operable, labeled for
  assistive technologies, and localizable (no hard-coded user-facing strings).
- Every feature touching the resolution or rendering path MUST define performance budgets in its
  plan and verify them with benchmarks in CI.

**Rationale**: Personalization must never cost users access. Enforcing accessibility in the
engine protects end users regardless of which theme or preference they choose.

### IX. Versioned Contracts and Backward Compatibility

- Public contracts (the Theme Specification, Customization Policy schema, user preference schema,
  theme package format, core public API, and adapter APIs) MUST each be versioned with Semantic
  Versioning.
- Within a MAJOR version, changes MUST be additive: every previously valid document MUST remain
  valid and MUST resolve to equivalent output, except for documented bug fixes.
- Breaking changes MUST ship as a new MAJOR version with a migration guide and an automated
  migration tool for documents. Core MUST read documents from at least the previous MAJOR version
  of each schema for a published deprecation window.
- Deprecations MUST be announced at least one MINOR release before removal and MUST emit runtime
  diagnostics while in effect.
- Third-party additions MUST live in a designated, namespaced extensions area that core preserves
  but does not interpret. Handling of unknown fields elsewhere MUST be defined by the
  specification and MUST produce diagnostics.
- User preferences MUST degrade gracefully when the underlying theme changes: overrides that
  reference removed or renamed tokens are migrated or skipped with diagnostics, never causing a
  failure.

**Rationale**: Themes and preferences are long-lived user data shared across applications and
versions. Breaking them silently would destroy user trust and ecosystem value.

### X. Deterministic and Testable

- Theme resolution MUST be a pure, deterministic function of explicit inputs: theme(s),
  Customization Policy, user preferences, and environment context (e.g., color scheme, contrast
  preference, viewport class). Identical inputs MUST produce identical resolved output across
  runs, runtimes, and adapters.
- Resolution MUST NOT read hidden global state, clocks, randomness, or the network. Environment
  context MUST be injected so it can be controlled in tests and during server-side rendering.
- Layer precedence and conflict resolution MUST be specified normatively and MUST be identical
  across implementations.
- Diagnostics MUST be structured, with a stable code, a location in the document (e.g., a JSON
  Pointer), and a remediation hint.
- Tests are mandatory for changes to core, the Theme Specification and schemas, policy
  enforcement, output targets, adapters, migrations, and the untrusted-input pipeline. Required
  suites: specification conformance (valid and invalid fixtures), golden-output resolution
  tests, policy enforcement tests, malicious-input tests, adapter conformance tests, migration
  tests, and accessibility checks for official themes.
- Official themes SHOULD also be covered by visual regression tests on reference components.

**Rationale**: A theming engine sits beneath every screen of a host application. Determinism
makes its behavior reproducible, safe to render on servers, cacheable, and verifiable by humans
and AI alike.

### XI. AI-Agent-Friendly Developer Experience

- The default integration MUST require only: installing packages, registering themes and a
  policy (or preset), and connecting one adapter. This quickstart MUST run as an automated test
  in CI.
- Public APIs MUST be fully typed, with types generated from or verified against the published
  schemas, and MUST favor explicit, predictable names and conventions over implicit behavior.
- Every package MUST ship machine-readable documentation for coding agents: JSON Schemas, a typed
  API reference, and an agent-oriented guide (e.g., `llms.txt` or `AGENTS.md`) covering
  integration patterns, constraints, and common mistakes.
- Tooling (validate, lint, preview, migrate, scaffold) MUST run non-interactively and MUST offer
  machine-readable (JSON) output and meaningful exit codes.
- Error messages MUST be actionable: what failed, where, why, and how to fix it, with a link to
  the relevant documentation.
- Documentation examples MUST be runnable and verified in CI. A stale example is a defect.
- Defaults MUST be secure (Principles III and VI) and MUST let the quickstart work without
  additional configuration.

**Rationale**: Many integrators will work through AI coding agents. Unambiguous contracts, typed
APIs, and machine-readable documentation make the correct integration the easiest one for
humans and agents alike.

### XII. Open Core Without Required Cloud Services (NON-NEGOTIABLE)

- All core capabilities (loading, validating, resolving, and applying themes; personalization
  and policy enforcement; local persistence; and file-based import and export) MUST work fully
  offline and self-hosted, with no OpenTheme-operated service, account, API key, or network
  connection.
- Hosted services (e.g., sync, sharing hubs, marketplaces, hosted AI) MUST be optional and
  integrated through documented, open interfaces that developers and third parties can
  implement or self-host.
- Capabilities required by the core product vision (theme selection, bounded personalization,
  validation, security, import and export) MUST NOT be moved behind a proprietary or hosted
  service.
- The open-source core MUST NOT collect telemetry by default. Any telemetry MUST be opt-in by the
  developer and documented so developers can disclose it to their end users.
- The open-source core MUST be distributed under an OSI-approved license.
  TODO(LICENSE): license not yet selected.

**Rationale**: Infrastructure that applications depend on for every screen must not create
lock-in, availability risk, or privacy exposure.

### XIII. Extensible by Design, Not by Speculation

- Future marketplace, sharing, designer-ecosystem, and AI capabilities MUST be enabled through
  stable, documented extension points (e.g., theme sources and registries, storage providers,
  AI providers, output targets, validation and lint rules, and namespaced specification
  extensions), not by forking or patching core.
- The theme package format MUST define, from its first version, the metadata an ecosystem needs:
  stable identifier, name, version, targeted specification version, author, license, provenance
  (e.g., bundled, user-created, imported, AI-generated), and an integrity hash. Author, license,
  and integrity fields MUST be mandatory for any exported or published theme, and the format
  MUST NOT preclude signatures.
- Extensions MUST NOT bypass validation, sanitization, or policy enforcement (Principles III and
  VI), and MUST NOT gain access to host application data through OpenTheme.
- An extension point MUST be added only when a concrete consumer (an official package, the
  reference implementation, or an approved specification) needs it. Otherwise, designs MUST
  only avoid precluding it. Speculative abstractions MUST be justified in the plan's Complexity
  Tracking table.

**Rationale**: The ecosystem vision needs stable seams early, but premature infrastructure slows
the foundation. Extension points grow from real needs.

## Product Scope and Architectural Constraints

**Terminology** (normative across all specifications and plans):

- **Theme Specification**: The versioned, machine-readable contract (schemas plus normative rules)
  defining what a theme can express.
- **Theme**: A declarative document conforming to the Theme Specification.
- **Customization Policy**: The developer's declarative definition of available themes and
  personalization boundaries.
- **User Preferences**: An end user's versioned, serializable selections and overrides, applied
  within the Customization Policy.
- **Core**: The framework-agnostic engine that validates, resolves, and enforces.
- **Output target**: A module that converts resolved tokens into a platform representation
  (e.g., CSS custom properties).
- **Adapter**: A thin framework binding over core and output targets.
- **Host application**: Any application that integrates OpenTheme.
- **Trusted source**: Content bundled by the developer at build time. All other content is
  untrusted.

**Product boundaries**:

- OpenTheme is application- and domain-agnostic. Requirements MUST be expressed in presentation
  terms that apply to any category of application.
- OpenTheme is independent of any single consumer. Nisha is intended to become a real-world
  consumer and reference implementation; it MUST integrate only through public APIs and
  extension points and MUST NOT own, fork, or impose domain-specific requirements on core, the
  Theme Specification, or official adapters. Consumer-specific needs MUST be generalized into
  domain-neutral capabilities or remain in the consumer's own code.
- Resolution authority, from lowest to highest: Theme Specification defaults, the selected
  theme, user preferences permitted by policy, developer policy (clamps, locks, protected
  tokens), and platform accessibility preferences (Principle VIII). The Theme Specification
  defines the exact algorithm and MUST preserve this ordering of authority.

**Capability staging**:

- Foundation: the Theme Specification, core engine, prebuilt themes, Customization Policy,
  end-user theme selection and personalization, local persistence, and at least one output
  target and one framework adapter.
- Later: developer-authored theme tooling, user-created themes, import/export and sharing,
  AI-assisted creation and modification, marketplace, and designer ecosystem.
- A later-stage capability MUST NOT be built before the foundation capabilities it depends on
  are released, and foundation designs MUST NOT preclude later-stage capabilities.

**Dependencies and budgets**:

- Every runtime dependency of core MUST be justified in the plan that introduces it, actively
  maintained, and license-compatible with the core license.
- Size budgets for core, output targets, and adapters MUST be defined and enforced in CI.

## Development Workflow and Quality Gates

- Work follows the Spec Kit flow: `/speckit-specify`, `/speckit-clarify` (when ambiguity exists),
  `/speckit-plan`, `/speckit-tasks`, then `/speckit-implement`. Specifications describe
  user-visible outcomes in domain-neutral terms.
- Every plan MUST complete the Constitution Check below before research and again after design.
  Any failed gate MUST be resolved or recorded in the plan's Complexity Tracking table with a
  justification. Gates for NON-NEGOTIABLE principles (I, VI, VII, XII) admit no exceptions.

**Constitution Check gates**:

1. Separation (I): Business logic, domain vocabulary, and behavior stay out of themes, core, and
   official adapters.
2. Personalization (II): User appearance changes are modeled as preference overrides in the
   shared layer, not as theme forks or host-specific code.
3. Boundaries (III): Every new input path passes through core policy enforcement with closed
   defaults.
4. Specification (IV): Every new theme capability is defined in the Theme Specification (schema,
   rules, fixtures) before or alongside implementation.
5. Agnostic core (V): Core has no framework or DOM dependencies; adapters contain only bindings.
6. Security (VI): All non-bundled input is treated as untrusted, validated, resource-limited,
   safely serialized, scoped, and fail-closed.
7. AI (VII): AI acts only on specification documents or patches, with preview, consent, and no
   bypass.
8. Accessibility (VIII): Contrast, accessibility preferences, text scaling, right-to-left
   support, responsive behavior, first-paint correctness, and performance budgets are addressed.
9. Compatibility (IX): Contract changes are versioned, additive within a MAJOR version, and
   accompanied by migrations when breaking.
10. Determinism (X): Resolution is pure with injected context, and the mandatory test suites are
    planned.
11. Developer experience (XI): Types, agent-readable documentation, actionable errors, and
    runnable examples are updated.
12. No required cloud (XII): Everything works offline and self-hosted without an OpenTheme
    service.
13. Extensibility (XIII): New extension points have a concrete consumer and preserve enforcement.

**Contract changes**:

- A change to any public contract (Principle IX) MUST include, in the same change: schema
  updates, normative documentation, conformance fixtures, a version bump, and a changelog entry.
  Breaking changes MUST also include a migration guide and migration tool.

**Review and CI gates**:

- Every pull request MUST pass formatting and linting, type checks, the applicable mandatory test
  suites (Principle X), adapter conformance, accessibility checks for official themes,
  documentation example verification, and size budgets.
- Pull requests touching the untrusted-input pipeline (Principle VI) or AI integration
  (Principle VII) MUST record an explicit security-focused review in the pull request.
- Task lists generated by `/speckit-tasks` MUST include test tasks for every scope in which
  Principle X makes tests mandatory, regardless of template defaults.

## Governance

- This constitution supersedes all other project practices, guides, and conventions. When a
  specification, plan, task list, document, or review guideline conflicts with it, the
  constitution prevails until amended.
- Amendments MUST be proposed as a change to `.specify/memory/constitution.md` that includes the
  rationale, a Sync Impact Report, the version bump, and any required updates to dependent
  templates and guidance. Amendments take effect when approved by the project maintainers.
  TODO(MAINTAINERS): maintainer group not yet defined.
- Versioning policy: MAJOR for removing or redefining a principle or weakening a NON-NEGOTIABLE
  rule; MINOR for adding a principle or section or materially expanding guidance; PATCH for
  clarifications and wording changes that do not alter meaning.
- Exceptions: deviations from principles not marked NON-NEGOTIABLE require a justification in the
  plan's Complexity Tracking table, a named owner, and a tracked remediation. Principles I, VI,
  VII, and XII can change only by amendment.
- Compliance: every plan's Constitution Check and every pull request review MUST verify
  compliance. Maintainers MUST review this constitution at each MAJOR release of the Theme
  Specification and at least once every 12 months, producing amendments or remediation tasks.
- Runtime guidance files (e.g., `README.md`, `CONTRIBUTING.md`, `AGENTS.md`), when created, MUST
  remain consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
