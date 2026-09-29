/**
 * The Browser Preference Store (data-model §5; research WR6; FR-W020 to FR-W023): Core's
 * PreferenceStore over per-origin key-value storage. The bytes are never interpreted here; Core
 * parses and validates them. Every storage exception becomes a rejection, which Core reports.
 */
import type { PreferenceStore } from "@opentheme/core";
import { OpenThemeWebError } from "./errors.js";

export interface BrowserStore extends PreferenceStore {
  /** The stored bytes or null, synchronously, for the first resolution; throws on a storage failure. */
  readInitial(scope: string): string | null;
}

export interface BrowserStoreOptions {
  /** Default: `localStorage`. */
  readonly storage?: Storage;
  /** Default: `opentheme:`. */
  readonly prefix?: string;
}

export function createBrowserStore(options: BrowserStoreOptions = {}): BrowserStore {
  const prefix = options.prefix ?? "opentheme:";
  if (typeof prefix !== "string") throw new OpenThemeWebError("invalid-argument", "web.createBrowserStore", "prefix must be a string.");
  // Reading `localStorage` itself can throw (disabled storage, sandboxed frames), so it is deferred.
  const storage = (): Storage => options.storage ?? globalThis.localStorage;
  const key = (scope: string) => prefix + scope;
  return Object.freeze({
    readInitial: (scope: string) => storage().getItem(key(scope)),
    read: async (scope: string) => storage().getItem(key(scope)),
    write: async (scope: string, bytes: string) => storage().setItem(key(scope), bytes),
    clear: async (scope: string) => storage().removeItem(key(scope)),
  });
}
