/**
 * Internal memoization (FR-C071 to FR-C073). Invisible: a hit returns the same frozen value a miss
 * would compute. Capacity 0 disables the cache. Nothing about the cache reaches any result.
 */
export class Lru<V> {
  readonly #capacity: number;
  readonly #map = new Map<string, V>();

  constructor(capacity: number) {
    this.#capacity = capacity;
  }

  get size(): number {
    return this.#map.size;
  }

  get(key: string): V | undefined {
    const v = this.#map.get(key);
    if (v !== undefined) {
      this.#map.delete(key);
      this.#map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V): void {
    if (this.#capacity === 0) return;
    this.#map.delete(key);
    this.#map.set(key, value);
    while (this.#map.size > this.#capacity) this.#map.delete(this.#map.keys().next().value!);
  }
}
