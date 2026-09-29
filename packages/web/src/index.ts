/**
 * @opentheme/web — public API (specs/003-web-adapter/contracts/public-api.md).
 * Only the exports listed in the contract are public.
 */
export { toDeclarations, type Declaration, type DeclarationSet, type Omission } from "./declarations.js";
export { toStylesheet, type StylesheetOptions } from "./stylesheet.js";
export { attachTheme, type AdapterReport, type AttachOptions, type SizeClass, type WebScope } from "./scope.js";
export { OpenThemeWebError, type WebErrorKind } from "./errors.js";
