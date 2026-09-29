/**
 * Server rendering (contracts/css-output.md "Stylesheet shape"; FR-W006, FR-W030): the same rule
 * text a scope applies, optionally as the complete `<style data-opentheme-scope>` element.
 */
import type { ResolvedTheme } from "@opentheme/core";
import { toDeclarations, type Declaration } from "./declarations.js";
import { NONCE, OpenThemeWebError, SCOPE_ID } from "./errors.js";

export interface StylesheetOptions {
  /** The scope id; required for `element` and for an element scope. */
  readonly scope?: string;
  /** A document scope (`:root`); defaults to true when `scope` is omitted. */
  readonly root?: boolean;
  readonly nonce?: string;
  readonly element?: boolean;
}

export function selectorFor(scope: string | undefined, root: boolean): string {
  return root ? ":root" : `[data-opentheme-scope="${scope}"]`;
}

export function ruleText(selector: string, declarations: readonly Declaration[]): string {
  return `${selector} { ${declarations.map((d) => `${d.name}: ${d.value};`).join(" ")} }`;
}

export function toStylesheet(resolved: ResolvedTheme, options: StylesheetOptions = {}): string {
  const op = "web.toStylesheet";
  const { scope, nonce, element = false } = options;
  const root = options.root ?? scope === undefined;
  if (scope !== undefined && !SCOPE_ID.test(scope)) throw new OpenThemeWebError("invalid-argument", op, "scope must match [a-z][a-z0-9-]*.");
  if (scope === undefined && (element || !root)) throw new OpenThemeWebError("invalid-argument", op, "This output needs a scope id.");
  if (nonce !== undefined && !NONCE.test(nonce)) throw new OpenThemeWebError("invalid-argument", op, "nonce must be base64 or base64url.");
  const rule = ruleText(selectorFor(scope, root), toDeclarations(resolved).declarations);
  if (!element) return rule;
  return `<style data-opentheme-scope="${scope}"${nonce === undefined ? "" : ` nonce="${nonce}"`}>${rule}</style>`;
}
