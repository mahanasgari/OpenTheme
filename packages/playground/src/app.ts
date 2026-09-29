/**
 * The OpenTheme playground: one page themed by @opentheme/web. The controls call the scope's
 * controller; the preview and the page itself use only `--ot-` and `--otc-` custom properties;
 * the inspector lists every property the adapter wrote.
 */
import { createCore, type ResolvedTheme } from "@opentheme/core";
import { attachTheme, sizeClassForWidth, toDeclarations, type WebScope } from "@opentheme/web";

export interface PlaygroundData {
  readonly themes: readonly { readonly id: string; readonly name: string; readonly bytes: string }[];
}

const SCOPE = "playground";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v !== undefined) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

function select(id: string, label: string, options: readonly [string, string][]): [HTMLLabelElement, HTMLSelectElement] {
  const s = el("select", { id });
  for (const [value, text] of options) s.append(el("option", { value }, text));
  return [el("label", { for: id }, label), s];
}

function range(id: string, label: string, min: number, max: number, step: number): [HTMLLabelElement, HTMLInputElement] {
  const input = el("input", { id, type: "range", min: String(min), max: String(max), step: String(step) });
  return [el("label", { for: id }, label), input];
}

const hex = (n: number) => n.toString(16).padStart(2, "0");

export interface Playground {
  readonly scope: WebScope;
  dispose(): void;
}

export function mountPlayground(root: HTMLElement, data: PlaygroundData): Playground {
  const core = createCore();
  for (const t of data.themes) core.registry.admit({ kind: "theme", bytes: t.bytes, trust: "trusted" });
  const defaultTheme = data.themes[0]!.id;

  // --- Controls -----------------------------------------------------------------------------
  const [themeLabel, theme] = select("theme", "Theme", data.themes.map((t) => [t.id, t.name]));
  const [schemeLabel, scheme] = select("scheme", "Color scheme", [["", "Follow system"], ["light", "Light"], ["dark", "Dark"]]);
  const [contrastLabel, contrast] = select("contrast", "Contrast", [["", "Follow system"], ["standard", "Standard"], ["high", "High"]]);
  const [densityLabel, density] = select("density", "Density", [["compact", "Compact"], ["standard", "Standard"], ["comfortable", "Comfortable"]]);
  const [motionLabel, motion] = select("motion", "Motion", [["", "Follow system"], ["standard", "Standard"], ["reduced", "Reduced"]]);
  const [textLabel, textSize] = range("text-size", "Text size", 1, 2, 0.05);
  const [roundLabel, roundness] = range("roundness", "Corner roundness", 0, 2, 0.05);
  const accent = el("input", { id: "accent", type: "color" });
  const accentReset = el("button", { type: "button", class: "button secondary", id: "accent-reset" }, "Theme accent");
  const reset = el("button", { type: "button", class: "button secondary", id: "reset" }, "Reset all");
  const status = el("p", { class: "caption", id: "status", role: "status" });

  const controls = el(
    "form",
    { class: "controls", "aria-label": "Theme settings" },
    el("h2", {}, "Settings"),
    themeLabel,
    theme,
    schemeLabel,
    scheme,
    contrastLabel,
    contrast,
    textLabel,
    textSize,
    densityLabel,
    density,
    roundLabel,
    roundness,
    motionLabel,
    motion,
    el("label", { for: "accent" }, "Accent"),
    el("div", { class: "row" }, accent, accentReset),
    el("div", { class: "row" }, reset),
    status,
  );

  // --- Preview (standard components styled with --otc- properties) --------------------------
  const tabs = ["Overview", "Activity", "Settings"].map((t, i) =>
    el("button", { type: "button", role: "tab", class: "tab", "aria-selected": String(i === 0) }, t),
  );
  for (const t of tabs) {
    t.addEventListener("click", () => {
      for (const u of tabs) u.setAttribute("aria-selected", String(u === t));
    });
  }
  const preview = el(
    "section",
    { class: "preview", "aria-label": "Preview" },
    el("nav", { class: "navbar" }, el("strong", {}, "Acme Notes"), el("span", { class: "caption" }, "Signed in")),
    el("div", { class: "tabs", role: "tablist" }, ...tabs),
    el(
      "article",
      { class: "card" },
      el("h3", { class: "card-title" }, "Weekly summary"),
      el("p", { class: "card-body" }, "Twelve notes were added this week. Three need your review before Friday."),
      el(
        "div",
        { class: "row" },
        el("button", { type: "button", class: "button primary" }, "Review notes"),
        el("button", { type: "button", class: "button secondary" }, "Later"),
      ),
    ),
    el(
      "div",
      { class: "field" },
      el("label", { for: "search" }, "Search"),
      el("input", { id: "search", class: "input", type: "text", placeholder: "Find a note" }),
    ),
    el(
      "div",
      { class: "row" },
      el("label", { class: "check" }, el("input", { type: "checkbox", checked: "" }), "Email me a digest"),
      el("span", { class: "badge success" }, "Synced"),
      el("span", { class: "badge danger" }, "2 conflicts"),
    ),
  );

  // --- Inspector -------------------------------------------------------------------------------
  const filter = el("input", { id: "filter", class: "input", type: "search", placeholder: "Filter, for example color_action" });
  const count = el("span", { class: "caption", id: "count" });
  const rows = el("tbody");
  const inspector = el(
    "section",
    { class: "inspector", "aria-label": "Custom properties" },
    el("div", { class: "row spread" }, el("h2", {}, "Custom properties"), count),
    el("label", { for: "filter", class: "visually-hidden" }, "Filter properties"),
    filter,
    el(
      "div",
      { class: "table-wrap" },
      el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Property"), el("th", {}, "Value"))), rows),
    ),
  );

  root.append(
    el(
      "header",
      { class: "masthead" },
      el("h1", {}, "OpenTheme playground"),
      el(
        "p",
        { class: "lede" },
        "This page is themed by ",
        el("code", {}, "@opentheme/web"),
        ". Pick a theme and personalize it: every color, size, and font below comes from the resolved theme.",
      ),
    ),
    el("main", { class: "layout" }, controls, preview, inspector),
  );

  // --- Scope ---------------------------------------------------------------------------------
  const scope = attachTheme({
    core,
    target: document,
    scope: SCOPE,
    policy: { preset: "common-personalization", defaultTheme },
    sizeClass: sizeClassForWidth(window.innerWidth),
  });
  const onResize = () => scope.setSizeClass(sizeClassForWidth(window.innerWidth));
  window.addEventListener("resize", onResize);

  const values = () => {
    const doc = JSON.parse(scope.controller.exportDocument()) as { values?: Record<string, unknown> };
    return doc.values ?? {};
  };

  const renderInspector = (resolved: ResolvedTheme) => {
    const q = filter.value.trim().toLowerCase();
    const all = toDeclarations(resolved).declarations;
    const shown = q ? all.filter((d) => d.name.includes(q) || d.value.toLowerCase().includes(q)) : all;
    const frag = document.createDocumentFragment();
    for (const d of shown.slice(0, 400)) {
      const swatch = /^rgb\(|^[A-Z]/.test(d.value) ? el("span", { class: "swatch", style: `background: var(${d.name})` }) : "";
      frag.append(el("tr", {}, el("td", {}, el("code", {}, d.name)), el("td", {}, swatch, el("code", {}, d.value))));
    }
    rows.replaceChildren(frag);
    count.textContent = shown.length > 400 ? `${shown.length} of ${all.length}, first 400 shown` : `${shown.length} of ${all.length}`;
  };

  const render = (resolved: ResolvedTheme) => {
    const applied = resolved.applied as { id: string; fallback: string };
    const ctx = resolved.context as Record<string, unknown>;
    const v = values();
    theme.value = applied.id;
    scheme.value = typeof v["std.color-scheme"] === "string" ? (v["std.color-scheme"] as string) : "";
    contrast.value = typeof v["std.contrast"] === "string" ? (v["std.contrast"] as string) : "";
    motion.value = typeof v["std.motion"] === "string" ? (v["std.motion"] as string) : "";
    density.value = typeof v["std.density"] === "string" ? (v["std.density"] as string) : "standard";
    textSize.value = String(typeof v["std.text-size"] === "number" ? v["std.text-size"] : 1);
    roundness.value = String(typeof v["std.corner-roundness"] === "number" ? v["std.corner-roundness"] : 1);
    const a = v["std.accent"] as { components?: number[] } | undefined;
    if (a?.components) accent.value = `#${a.components.map((c) => hex(Math.round(c * 255))).join("")}`;
    // Core may clamp or reject a preference (for example an accent that misses the contrast floor).
    const prefs = (resolved.preferences ?? {}) as Record<string, { status?: string }>;
    const notes = Object.entries(prefs)
      .filter(([, p]) => p.status === "rejected" || p.status === "clamped")
      .map(([id, p]) => `${id.replace(/^std\./, "")} ${p.status}`);
    status.textContent = [
      `${ctx.colorScheme} · ${ctx.contrast} contrast · ${ctx.sizeClass} · text ×${ctx.textScale}`,
      `${scope.report.set} set, ${scope.report.removed} removed`,
      ...notes,
    ].join(" · ");
    renderInspector(resolved);
  };

  const apply = (point: string, value: unknown) => {
    const run = value === "" || value === undefined ? scope.controller.clearValue(point) : scope.controller.setValue(point, value);
    void run.then(() => render(scope.controller.current.resolved));
  };

  theme.addEventListener("change", () => void scope.controller.select({ id: theme.value }));
  scheme.addEventListener("change", () => apply("std.color-scheme", scheme.value));
  contrast.addEventListener("change", () => apply("std.contrast", contrast.value));
  motion.addEventListener("change", () => apply("std.motion", motion.value));
  density.addEventListener("change", () => apply("std.density", density.value === "standard" ? "" : density.value));
  textSize.addEventListener("input", () => apply("std.text-size", Number(textSize.value) === 1 ? "" : Number(textSize.value)));
  roundness.addEventListener("input", () => apply("std.corner-roundness", Number(roundness.value) === 1 ? "" : Number(roundness.value)));
  accent.addEventListener("input", () => {
    const m = /^#(..)(..)(..)$/.exec(accent.value);
    if (m) apply("std.accent", { colorSpace: "srgb", components: [m[1], m[2], m[3]].map((h) => Number.parseInt(h!, 16) / 255) });
  });
  accentReset.addEventListener("click", () => apply("std.accent", ""));
  reset.addEventListener("click", () => void scope.controller.reset().then(() => render(scope.controller.current.resolved)));
  filter.addEventListener("input", () => renderInspector(scope.controller.current.resolved));

  const unsubscribe = scope.controller.subscribe((r) => render(r.resolved));
  render(scope.controller.current.resolved);

  return {
    scope,
    dispose() {
      unsubscribe();
      window.removeEventListener("resize", onResize);
      scope.detach();
      root.replaceChildren();
    },
  };
}
