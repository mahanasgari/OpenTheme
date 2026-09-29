/**
 * The Web adapter benchmark cases (research WR9; SC-W006), shared by the Node runner
 * (bench/node.ts) and the browser page (bench/browser-entry.ts). The caller supplies a document,
 * the theme bytes, and a clock.
 *
 * - apply: build the declaration set for the typical theme and write it to an empty rule, which
 *   is what a scope's first application does.
 * - update: a context change through the scope (text scale), including Core's re-resolution and
 *   the adapter's diff.
 */
import { createCore } from "@opentheme/core";
import { attachTheme, toDeclarations } from "../src/index.js";

export const BUDGETS = { apply: 4, update: 4 } as const;

function median(fn: () => void, runs: number, now: () => number): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = now();
    fn();
    samples.push(now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}

export interface WebBenchResult {
  readonly name: keyof typeof BUDGETS;
  readonly ms: number;
  readonly budget: number;
  readonly declarations: number;
}

export function runWebBench(doc: Document, typicalBytes: string, now: () => number, runs = 41): WebBenchResult[] {
  const id = (JSON.parse(typicalBytes) as { id: string }).id;
  const core = createCore();
  core.registry.admit({ kind: "theme", bytes: typicalBytes, trust: "trusted" });
  const scope = attachTheme({
    core,
    target: doc,
    scope: "bench",
    policy: { preset: "closed", defaultTheme: id },
    sizeClass: "expanded",
    store: false,
  });
  const resolved = scope.controller.current.resolved;
  const count = toDeclarations(resolved).declarations.length;

  const style = doc.createElement("style");
  doc.head.append(style);
  const sheet = style.sheet!;
  const apply = median(
    () => {
      if (sheet.cssRules.length > 0) sheet.deleteRule(0);
      sheet.insertRule(":root {}", 0);
      const target = (sheet.cssRules[0] as CSSStyleRule).style;
      for (const d of toDeclarations(resolved).declarations) target.setProperty(d.name, d.value);
    },
    runs,
    now,
  );
  style.remove();

  let big = false;
  const update = median(
    () => {
      big = !big;
      scope.setTextScale(big ? 1.25 : 1);
    },
    runs,
    now,
  );
  scope.detach();
  return [
    { name: "apply", ms: apply, budget: BUDGETS.apply, declarations: count },
    { name: "update", ms: update, budget: BUDGETS.update, declarations: count },
  ];
}
