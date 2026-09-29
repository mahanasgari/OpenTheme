/**
 * Node 25 and later define a global `localStorage` that is undefined unless Node is given a storage
 * file, and it shadows the DOM environment's. Tests need a working Storage, so install an
 * in-memory one when the global is not usable. Browsers are unaffected.
 */
class MemoryStorage implements Storage {
  #data = new Map<string, string>();
  get length(): number {
    return this.#data.size;
  }
  clear(): void {
    this.#data.clear();
  }
  getItem(key: string): string | null {
    return this.#data.get(String(key)) ?? null;
  }
  key(index: number): string | null {
    return [...this.#data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#data.delete(String(key));
  }
  setItem(key: string, value: string): void {
    this.#data.set(String(key), String(value));
  }
}

let usable = false;
try {
  usable = typeof globalThis.localStorage?.getItem === "function";
} catch {
  usable = false;
}
if (!usable) {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true, writable: true });
}
