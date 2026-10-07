/**
 * OpenThemeStyle (T013; research RR4; FR-R007): the Web adapter's server-rendered style element, so
 * the client provider adopts it. The text comes from the adapter's grammar-checked serializers,
 * which never produce `<`, so it cannot close the element.
 */
import type { ResolvedTheme } from "@opentheme/core";
import { toStylesheet } from "@opentheme/web";

export interface OpenThemeStyleProps {
  resolved: ResolvedTheme;
  /** `[a-z][a-z0-9-]*`; the provider on the client must use the same id. */
  scope: string;
  /** Default true (a document scope); pass `false` for an element scope. */
  root?: boolean;
  nonce?: string;
}

export function OpenThemeStyle({ resolved, scope, root = true, nonce }: OpenThemeStyleProps) {
  const css = toStylesheet(resolved, { scope, root, ...(nonce !== undefined ? { nonce } : {}) });
  return <style data-opentheme-scope={scope} nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />;
}
