# Feature Specification: React Bindings

**Feature Branch**: `006-react-bindings`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "React bindings for OpenTheme (`@opentheme/react`): a provider that
attaches a theme scope through the Web adapter, hooks that read the resolved theme and drive
personalization, and a server-rendering component for flash-free first paint. Thin over
`@opentheme/web` and `@opentheme/core`; no theming behavior of its own."

## Overview

Most web applications are built with React. Today a React developer must call the Web adapter by
hand, wire its controller into React state, and handle mounting, unmounting, strict mode, and
server rendering themselves. This feature gives them a provider and a few hooks so that a React app
is themed by OpenTheme in a few lines, re-renders exactly when the theme changes, and paints the
right theme on the first frame. All theming behavior stays in Core and the Web adapter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Theme a React app (Priority: P1)

A developer wraps their app in a provider with a Core instance, a policy, and a scope name; the page
is styled through the adapter's custom properties, and the scope is removed when the provider
unmounts.

**Why this priority**: It is the entry point; without it nothing else is usable.

**Independent Test**: Render the provider with the reference themes; the applied custom
properties equal those the Web adapter applies for the same inputs; unmounting removes them.

**Acceptance Scenarios**:

1. **Given** a provider for the document, **When** it mounts, **Then** the page has the same custom
   properties `attachTheme` would apply, and they are removed when it unmounts.
2. **Given** a provider with an element target, **When** it mounts, **Then** only that element's
   scope is themed.
3. **Given** React strict mode (mount, unmount, mount), **When** the provider mounts, **Then** exactly
   one scope is attached afterwards and no error is raised.
4. **Given** changed provider inputs (policy, size class, text scale), **When** it re-renders,
   **Then** the scope reflects them without being detached.

---

### User Story 2 - Read and change the theme from components (Priority: P1)

A component reads the resolved theme or one value, and calls personalization actions (select a
theme, set or clear a point, preview, accept, cancel, reset); components re-render when the
resolution changes and not otherwise.

**Why this priority**: Personalization UIs (theme pickers, settings) are the main reason to bind to
React rather than only apply CSS.

**Independent Test**: A test component using the hooks re-renders exactly once per published
resolution change and shows Core's values.

**Acceptance Scenarios**:

1. **Given** a component using the theme hook, **When** the user selects another theme through it,
   **Then** the component re-renders with the new resolution.
2. **Given** a component reading one token, **When** an unrelated change leaves the resolution
   identical, **Then** it does not re-render.
3. **Given** a hook used outside a provider, **When** it renders, **Then** it throws a clear error.

---

### User Story 3 - No flash of the wrong theme with server rendering (Priority: P2)

A server-rendered React app emits the theme's style element in its HTML; on the client the provider
adopts it, so the first paint is already themed and nothing is rewritten when inputs match.

**Why this priority**: Flash-free first paint matters for production apps, but apps without
server rendering can ship without it.

**Independent Test**: Render the style component on the server, hydrate with the provider and the
same inputs, and count zero property writes.

**Acceptance Scenarios**:

1. **Given** a resolved theme on the server, **When** the style component renders, **Then** its HTML
   equals the Web adapter's style element for that theme and scope.
2. **Given** that HTML on the client, **When** the provider mounts with the same inputs, **Then** the
   adapter adopts the element and writes no property.

### Edge Cases

- Rendering on the server: the provider attaches nothing and renders its children; hooks return the
  value given for server rendering, or report that none is available.
- Two providers on one page: each owns its own scope; reusing a scope name is the adapter's
  `scope-conflict` error, surfaced as a thrown error.
- Unmounting while a preference write is pending: no error, no update after unmount.
- A provider whose `core` prop changes: the old scope is detached and a new one attached.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-R001**: The package MUST obtain every theming result from `@opentheme/web` and
  `@opentheme/core`; it MUST NOT re-implement selection, validation, resolution, CSS output, or
  context detection.
- **FR-R002**: A provider MUST attach one Web adapter scope when it mounts on the client (before
  paint), detach it when it unmounts, and stay correct under React strict mode.
- **FR-R003**: The provider MUST accept the Web adapter's attach options (scope, policy, size class
  or automatic size class from the window width, text scale, locale, store, initial preferences,
  nonce) and a target (the document, or an element reference).
- **FR-R004**: Changes to size class and text scale MUST be applied to the existing scope; changes
  to the core, target, scope, or store MUST replace the scope; a policy change MUST be passed to
  the existing controller.
- **FR-R005**: Hooks MUST expose the current resolved theme, the outcome, errors and the adapter
  report, the personalization actions of Core's controller, and single values by token or
  component path; components MUST re-render only when the published resolution changes.
- **FR-R006**: Hooks used outside a provider MUST throw an error naming the missing provider.
- **FR-R007**: A style component MUST render the Web adapter's style element for a resolved theme
  (document or element scope, optional nonce) so the client provider adopts it.
- **FR-R008**: Rendering on the server MUST NOT touch browser APIs; hooks MUST return the resolved
  theme supplied for server rendering when one is given.
- **FR-R009**: The package MUST have no runtime dependency besides React (peer), `@opentheme/core`
  (peer), and `@opentheme/web`.
- **FR-R010**: Documentation examples MUST run in continuous integration.

### Key Entities

- **Provider**: owns one scope for its subtree; its value is the scope and the latest resolution.
- **Theme state**: the resolved theme, outcome, errors, and report at a point in time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-R001**: For both reference themes, the properties a provider applies equal the Web adapter's
  for the same inputs (100%).
- **SC-R002**: A component reading the theme re-renders exactly once per published resolution change
  and zero times for changes that leave the resolution identical.
- **SC-R003**: Hydrating a server-rendered page with the same inputs performs zero property writes.
- **SC-R004**: A developer can theme a new React app using only the README in under 5 minutes.
- **SC-R005**: The package adds at most 3 KB gzip on top of React, Core, and the Web adapter.
- **SC-R006**: Every documented example runs successfully in continuous integration.

## Assumptions

- Supported React versions are 18.3 and 19.
- The default size class is `medium`; `"auto"` follows the window width with the adapter's
  `sizeClassForWidth`.
- Server rendering requires the application to resolve the theme on the server with Core and pass
  it to the style component and, optionally, to the provider for hooks.
- Out of scope: React Native, theme picker UI components, CSS-in-JS integrations, and any change to
  Core or the Web adapter.
