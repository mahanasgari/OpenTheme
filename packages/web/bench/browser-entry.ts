/**
 * Browser page for the Web adapter (T034): the apply and context-change update medians in a real
 * browser, and a computed-style check that the custom properties reach the page (the DOM test
 * environment cannot check computed style). Data is embedded by bench/browser.ts.
 */
import { createCore } from "@opentheme/core";
import { attachTheme, toDeclarations } from "../src/index.js";
import { runWebBench } from "./cases.js";

const data = JSON.parse(document.getElementById("data")!.textContent!) as { typical: string; aurora: string };
const out = document.getElementById("out")!;
const log = (line: string) => {
  out.textContent += `${line}\n`;
};

setTimeout(() => {
  const core = createCore();
  core.registry.admit({ kind: "theme", bytes: data.aurora, trust: "trusted" });
  const scope = attachTheme({
    core,
    target: document,
    scope: "check",
    policy: { preset: "closed", defaultTheme: "org.opentheme.aurora" },
    sizeClass: "medium",
    store: false,
  });
  const computed = getComputedStyle(document.documentElement);
  const declarations = toDeclarations(scope.controller.current.resolved).declarations;
  const wrong = declarations.filter((d) => computed.getPropertyValue(d.name).trim() !== d.value);
  scope.detach();
  const gone = computed.getPropertyValue("--ot-color_text_primary") === "";
  const pass = wrong.length === 0 && gone;
  log(`computed style: ${pass ? "PASS" : "FAIL"} (${declarations.length} properties, ${wrong.length} differ, removed on detach: ${gone})`);
  for (const d of wrong.slice(0, 10)) log(`  differs: ${d.name}: ${computed.getPropertyValue(d.name)} != ${d.value}`);
  let over = false;
  for (const r of runWebBench(document, data.typical, () => performance.now())) {
    over ||= r.ms > r.budget;
    log(`bench: ${r.name} median=${r.ms.toFixed(2)}ms budget=${r.budget}ms ${r.ms <= r.budget ? "ok" : "OVER"}`);
  }
  log("done");
  document.title = pass && !over ? "OpenTheme Web: PASS" : "OpenTheme Web: FAIL";
}, 0);
