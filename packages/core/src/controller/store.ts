/**
 * The Preference Store abstraction (FR-C090, FR-C091). Core ships only an in-memory store; stores
 * backed by platform storage belong to adapters or hosts.
 */
export interface PreferenceStore {
  read(scope: string): Promise<Uint8Array | string | null> | Uint8Array | string | null;
  write(scope: string, bytes: string): Promise<void> | void;
  clear(scope: string): Promise<void> | void;
}

export function createMemoryStore(): PreferenceStore {
  const data = new Map<string, string>();
  return Object.freeze({
    read: (scope: string) => data.get(scope) ?? null,
    write: (scope: string, bytes: string) => {
      data.set(scope, bytes);
    },
    clear: (scope: string) => {
      data.delete(scope);
    },
  });
}
