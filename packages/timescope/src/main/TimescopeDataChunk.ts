import type { TimescopeDataChunkDesc, TimescopeDataChunkLoader } from '#src/core/chunk';
import type { Decimal } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { Range } from '#src/core/range';

type TimescopeDataChunkOptions<T> = {
  id: string;
  seq: bigint;
  range: Range<Decimal | undefined>;
  resolution: Decimal;
  zoom: number;

  loader: TimescopeDataChunkLoader<T>;
};

export class TimescopeDataChunk<T> extends TimescopeObservable implements TimescopeDataChunkDesc {
  #state: 'initial' | 'loading' | 'loaded' | 'error' = 'initial';

  #range: Range<Decimal | undefined>;
  #resolution: Decimal;
  #zoom: number;

  #loader: TimescopeDataChunkLoader<T>;

  #data: Promise<T | null> | undefined;
  #id;

  #seq;

  get id() {
    return this.#id;
  }

  get seq() {
    return this.#seq;
  }

  get range() {
    return this.#range;
  }

  get resolution() {
    return this.#resolution;
  }

  get zoom() {
    return this.#zoom;
  }

  get state() {
    return this.#state;
  }

  get expired() {
    return (this.#state !== 'loaded' && this.#state !== 'error') || this.#expires <= Date.now();
  }

  #expires = 0;
  get expires() {
    return this.#expires;
  }

  setExpires(expires: number) {
    this.#expires = expires;
  }

  invalidate() {
    this.#expires = 0;
  }

  constructor(opts: TimescopeDataChunkOptions<T>) {
    super();

    this.#id = opts.id;
    this.#seq = opts.seq;
    this.#range = opts.range;
    this.#resolution = opts.resolution;
    this.#zoom = opts.zoom;

    this.#loader = opts.loader;
  }

  reload() {
    return this.load(true);
  }

  async load(force = false) {
    if (this.#data && (this.#state === 'loading' || (!force && !this.expired))) {
      return await this.#data;
    }

    this.#state = 'loading';
    this.#expires = Infinity;

    try {
      const chunk: TimescopeDataChunkDesc = {
        id: this.#id,
        seq: this.#seq,
        expires: Infinity,
        range: this.#range.map((r) => r?.clone()) as Range<Decimal | undefined>,
        zoom: this.#zoom,
        resolution: this.#resolution.clone(),
      };
      const api = {
        expiresAt: (t: number) => (chunk.expires = t),
        expiresIn: (t: number) => (chunk.expires = t + Date.now()),
      };
      this.#data = this.#loader(chunk, api).then((data) => {
        this.#state = 'loaded';
        this.#expires = chunk.expires ?? Infinity;
        this.changed();
        if (!data) return null;
        return data;
      });
      return await this.#data;
    } catch (e) {
      console.error(e);
      this.#state = 'error';
      this.changed();
      return null;
    }
  }
}
