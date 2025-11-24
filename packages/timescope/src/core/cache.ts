export type LRUCacheOptions = {
  maxSize: number;
};

export class LRUCache<K, V> implements Iterable<[K, V]> {
  #maxSize: number;
  #store: Map<K, V>;

  constructor(options: LRUCacheOptions) {
    const { maxSize } = options;
    if (!(typeof maxSize === 'number' && Number.isFinite(maxSize) && maxSize > 0)) {
      throw new TypeError('`maxSize` must be a number greater than 0');
    }

    this.#maxSize = Math.floor(maxSize);
    this.#store = new Map();
  }

  get size(): number {
    return this.#store.size;
  }

  get maxSize(): number {
    return this.#maxSize;
  }

  get(key: K): V | undefined {
    if (!this.#store.has(key)) return undefined;
    const value = this.#store.get(key) as V;
    this.#store.delete(key);
    this.#store.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    if (this.#store.has(key)) {
      this.#store.delete(key);
    }

    this.#store.set(key, value);

    if (this.#store.size > this.#maxSize) {
      const oldestKey = this.#store.keys().next().value as K | undefined;
      if (oldestKey !== undefined) {
        this.#store.delete(oldestKey);
      }
    }

    return this;
  }

  has(key: K): boolean {
    return this.#store.has(key);
  }

  delete(key: K): boolean {
    return this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }

  *keys(): IterableIterator<K> {
    const entries = Array.from(this.#store.keys());
    for (let i = entries.length - 1; i >= 0; i--) {
      yield entries[i]!;
    }
  }

  *values(): IterableIterator<V> {
    for (const [, value] of this) {
      yield value;
    }
  }

  *entries(): IterableIterator<[K, V]> {
    yield* this[Symbol.iterator]();
  }

  *[Symbol.iterator](): IterableIterator<[K, V]> {
    const entries = Array.from(this.#store.entries());
    for (let i = entries.length - 1; i >= 0; i--) {
      yield entries[i]!;
    }
  }
}
