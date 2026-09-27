/**
 * A consumer written only against `@opentheme/core` exports. It is type-checked, never run, by
 * test/api/surface.test.ts, so any incompatible public API change fails the build.
 */
import {
  createCore,
  createMemoryStore,
  OpenThemeCoreError,
  type AdmissionResult,
  type Core,
  type Diagnostic,
  type OperationalError,
  type PolicyInput,
  type ResolutionRequest,
  type ResolutionResult,
  type SelectableTheme,
  type Snapshot,
  type ThemeController,
} from "@opentheme/core";
import { formatDiagnostic } from "@opentheme/core/templates";

export function example(themeBytes: string): string[] {
  const core: Core = createCore({ untrustedSources: { imported: true }, cache: { results: 8 } });
  const admitted: AdmissionResult = core.registry.admit({ kind: "theme", bytes: themeBytes, trust: "untrusted", source: "imported" });
  const problems: readonly Diagnostic[] = admitted.diagnostics;
  const refusal: OperationalError | null = admitted.error;
  const snapshot: Snapshot = core.registry.snapshot();
  const policy: PolicyInput = { preset: "common-personalization", defaultTheme: "org.opentheme.baseline" };
  const request: ResolutionRequest & { policy: PolicyInput } = {
    policy,
    selection: { id: "org.opentheme.baseline" },
    previous: null,
    preferences: { "std.density": "compact" },
    platform: { colorScheme: "dark", contrast: "standard", forcedColors: false, reducedMotion: true, textScale: 1.25 },
    environment: { sizeClass: "compact", locale: "fa-IR", direction: "rtl" },
  };
  const result: ResolutionResult = core.resolve(snapshot, request);
  const listed: readonly SelectableTheme[] = core.listSelectable(snapshot, policy, "en");
  const controller: ThemeController = core.createController({
    policy,
    context: { platform: request.platform, environment: request.environment },
    store: createMemoryStore(),
  });
  void controller.setValue("std.density", "comfortable").catch((e: unknown) => e instanceof OpenThemeCoreError);
  const messages = problems.map((d) => formatDiagnostic(d)?.message ?? d.code);
  return [String(refusal?.kind), String(result.ok), String(listed.length), controller.exportDocument(), ...messages];
}
