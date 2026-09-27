/** Resolution fixtures as determinism cases (Node only: reads the fixture files). */
import type { DeterminismCase } from "../../bench/determinism.js";
import { bytesOf, fixtures } from "../fixtures.js";

export function resolutionCases(): DeterminismCase[] {
  return fixtures("resolution")
    .filter((f) => f.kind === "resolve")
    .map((f) => {
      const input = f.input as Record<string, unknown> & { themes?: { trust?: string; document: unknown }[] };
      const themes: { trust: "trusted" | "untrusted"; bytes: string }[] = (input.themes ?? []).map((t) => ({
        trust: t.trust === "trusted" ? "trusted" : "untrusted",
        bytes: bytesOf(t.document),
      }));
      if (input.theme) themes.push({ trust: "trusted", bytes: bytesOf(input.theme) });
      return {
        id: f.id,
        host: input.host ? bytesOf(input.host) : null,
        themes,
        request: {
          policy: input.policy ?? {},
          selection: input.selection,
          previous: input.previous ?? null,
          preferences: input.preferences ?? {},
          platform: input.platform,
          environment: input.environment,
        },
      };
    });
}
