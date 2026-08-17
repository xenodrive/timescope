import { createChunk, type TimescopeChunk, type TimescopeChunkLoaderContext } from '#src/core/chunk';
import { TimescopeEvent, TimescopeObservable, type Un } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { Decimal } from '@kikuchan/decimal';

export type TimescopeChunkStoreInvalidation = {
  range?: TimescopeRange<Decimal | undefined>;
  revision: number;
};

type TimescopeChunkStoreSource<T> = {
  readonly revision: number;
  readonly invalidation?: TimescopeChunkStoreInvalidation;
  query(chunk: TimescopeChunk, context: TimescopeChunkLoaderContext): Promise<readonly T[]>;
  on(type: 'invalidate', listener: (event: TimescopeEvent<'invalidate', TimescopeChunkStoreInvalidation>) => void): Un;
};

export type TimescopeChunkStoreEntry<T> = {
  readonly descriptor: TimescopeChunk;
  state: 'idle' | 'loading' | 'loaded' | 'error';
  payload?: TimescopeChunk<readonly T[]>;
  revision: number;
  expires: number;
  references: number;
  requestId: number;
  result?: Promise<TimescopeChunk<readonly T[]>>;
};

function intersects(a: TimescopeRange<Decimal | undefined>, b?: TimescopeRange<Decimal | undefined>) {
  if (!b) return true;
  return (!a[1] || !b[0] || a[1].ge(b[0])) && (!b[1] || !a[0] || b[1].ge(a[0]));
}

/** Shared acquisition state and LRU for immutable normalized source chunks. */
export class TimescopeChunkStore<T> extends TimescopeObservable<
  | TimescopeEvent<'entrychange', TimescopeChunkStoreEntry<T>>
  | TimescopeEvent<'invalidate', TimescopeChunkStoreInvalidation>
> {
  #entries = new Map<string, TimescopeChunkStoreEntry<T>>();
  #source: TimescopeChunkStoreSource<T>;
  #handledRevision: number;
  #maxSize = 1000;

  constructor(source: TimescopeChunkStoreSource<T>) {
    super();
    this.#source = source;
    this.#handledRevision = source.revision;
    source.on('invalidate', ({ value }) => this.invalidate(value?.range, value?.revision ?? this.#source.revision));
  }

  acquireChunk(chunk: TimescopeChunk) {
    this.#syncInvalidation();
    let entry = this.#entries.get(chunk.id);
    if (!entry) {
      entry = {
        descriptor: chunk,
        state: 'idle',
        revision: this.#source.revision,
        expires: Infinity,
        references: 0,
        requestId: 0,
      };
      this.#entries.set(chunk.id, entry);
    } else {
      this.#touch(entry);
    }
    entry.references++;
    return entry;
  }

  releaseChunk(entry: TimescopeChunkStoreEntry<T>) {
    if (this.#entries.get(entry.descriptor.id) !== entry) return;
    entry.references = Math.max(0, entry.references - 1);
    this.#prune();
  }

  #entryFor(chunk: TimescopeChunk) {
    this.#syncInvalidation();
    return this.#entries.get(chunk.id);
  }

  async loadChunk(chunk: TimescopeChunk) {
    const existing = this.#entryFor(chunk);
    const entry = existing ?? this.acquireChunk(chunk);
    try {
      return await this.loadEntry(entry);
    } finally {
      if (!existing) this.releaseChunk(entry);
    }
  }

  loadEntry(entry: TimescopeChunkStoreEntry<T>) {
    this.#syncInvalidation();
    const current = this.#entries.get(entry.descriptor.id);
    if (current !== entry) throw new Error(`Released chunk entry: ${entry.descriptor.id}`);
    this.#touch(entry);
    if (entry.state === 'loading' && entry.result) return entry.result;
    if (entry.state === 'loaded' && entry.expires > Date.now() && entry.revision === this.#source.revision) {
      return Promise.resolve(entry.payload!);
    }

    let expires = Infinity;
    const context = {
      expiresAt: (time: number) => (expires = time),
      expiresIn: (time: number) => (expires = Date.now() + time),
    };
    const requestId = ++entry.requestId;
    entry.state = 'loading';
    entry.revision = this.#source.revision;
    this.#notify(entry);
    let query: Promise<readonly T[]>;
    try {
      query = this.#source.query(entry.descriptor, context);
    } catch (error) {
      query = Promise.reject(error);
    }
    const result = query
      .then((data) => {
        this.#syncInvalidation();
        if (entry.requestId !== requestId || entry.revision !== this.#source.revision) {
          throw new Error(`Stale source result for chunk ${entry.descriptor.id}`);
        }
        entry.expires = expires;
        entry.payload = Object.freeze(createChunk({ ...entry.descriptor, expires, data: Object.freeze([...data]) }));
        entry.state = 'loaded';
        this.#notify(entry);
        return entry.payload;
      })
      .catch((error) => {
        if (entry.requestId === requestId) {
          entry.state = 'error';
          this.#notify(entry);
        }
        throw error;
      })
      .finally(() => {
        if (entry.requestId === requestId) entry.result = undefined;
        this.#prune();
      });
    entry.result = result;
    return result;
  }

  peekChunk(chunk: TimescopeChunk) {
    const entry = this.#entryFor(chunk);
    if (!entry || entry.state !== 'loaded' || !entry.payload || entry.expires <= Date.now()) return;
    this.#touch(entry);
    return entry.payload;
  }

  invalidate(range: TimescopeRange<Decimal | undefined> | undefined, revision: number) {
    if (revision <= this.#handledRevision) return;
    if (revision > this.#handledRevision + 1) range = undefined;
    this.#handledRevision = revision;
    for (const entry of this.#entries.values()) {
      if (entry.revision >= revision) continue;
      entry.revision = revision;
      if (!intersects(entry.descriptor.range, range)) continue;
      entry.requestId++;
      entry.result = undefined;
      entry.state = 'idle';
      this.#notify(entry);
    }
    this.dispatchEvent(new TimescopeEvent('invalidate', { range, revision }));
  }

  #notify(entry: TimescopeChunkStoreEntry<T>) {
    this.dispatchEvent(new TimescopeEvent('entrychange', entry));
  }

  #touch(entry: TimescopeChunkStoreEntry<T>) {
    this.#entries.delete(entry.descriptor.id);
    this.#entries.set(entry.descriptor.id, entry);
  }

  #prune() {
    if (this.#entries.size <= this.#maxSize) return;
    for (const [id, entry] of this.#entries) {
      if (this.#entries.size <= this.#maxSize) return;
      if (!entry.references && entry.state !== 'loading') this.#entries.delete(id);
    }
  }

  #syncInvalidation() {
    const invalidation = this.#source.invalidation;
    if (invalidation && invalidation.revision > this.#handledRevision) {
      this.invalidate(invalidation.range, invalidation.revision);
    }
  }
}
