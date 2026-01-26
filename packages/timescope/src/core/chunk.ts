import config from '#src/core/config';
import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { zoomFor } from '#src/core/zoom';

/**
 * Chunk descriptor with optional payload.
 */
export type TimescopeChunk<T = never> = {
  /** Chunk id string. */
  id: string;
  /** Sequence number (monotonic along time). */
  seq: bigint;
  /** Expiration timestamp (ms). */
  expires?: number;

  /** Time range covered by this chunk. */
  range: TimescopeRange<Decimal | undefined>;
  /** Resolution in milliseconds per sample. */
  resolution: Decimal;
  /** Zoom level. */
  zoom: number;
  /** Iterator for time points. */
  [Symbol.iterator]: () => Generator<Decimal>;
} & ([T] extends [never] ? unknown : { data?: T });

export type TimescopeChunkLoaderContext = { expiresAt: (t: number) => void; expiresIn: (t: number) => void };

/**
 * Loader function that receives a chunk descriptor and returns its payload.
 */
export type TimescopeChunkLoader<T> = (
  chunk: TimescopeChunk,
  api: TimescopeChunkLoaderContext,
) => Promise<T | undefined>;

export function createChunkIterator(range: TimescopeRange<Decimal | undefined>, resolution: Decimal) {
  return function* () {
    if (!range[0] || !range[1] || resolution.le(0)) return;
    for (let t = range[0]; t.le(range[1]); t = t.add(resolution)) {
      yield t;
    }
  };
}

export type TimescopeChunkInit<T = never> = Omit<TimescopeChunk<T>, typeof Symbol.iterator> & { data?: T };

export function createChunk<T = never>(chunk: TimescopeChunkInit<T>): TimescopeChunk<T> {
  return {
    ...chunk,
    [Symbol.iterator]: createChunkIterator(chunk.range, chunk.resolution),
  };
}

export function createChunkList(
  range: TimescopeRange<Decimal | undefined>,
  resolution?: Decimal,
  chunkSize: number = config.defaultChunkSize,
  chunkOffset?: Decimal,
): TimescopeChunk[] {
  const chunkDuration = resolution?.mul(chunkSize);
  if (!range[0] || !range[1] || !resolution || !chunkDuration || chunkDuration.le(0)) {
    const seq = 0n;
    const id = `static`;
    return [
      createChunk({
        id,
        seq,
        expires: Infinity,
        range: [undefined, undefined],
        resolution: Decimal(0),
        zoom: 0,
      }),
    ];
  }

  const zoom = zoomFor(resolution);
  const results: TimescopeChunk[] = [];
  const limit = range[1]!.add(chunkDuration);
  let seq = range[0]!
    .sub(chunkOffset ?? 0)
    .div(chunkDuration)
    .floor()
    .add(chunkOffset ?? 0)
    .integer();

  const end = limit
    .sub(chunkOffset ?? 0)
    .div(chunkDuration)
    .floor()
    .add(chunkOffset ?? 0)
    .integer();

  let chunkT = chunkDuration.mul(seq);
  for (; seq <= end; seq++) {
    const nextT = chunkT.add(chunkDuration);
    const chunkRange = [chunkT, nextT] as TimescopeRange<Decimal | undefined>;
    chunkT = nextT;
    const id = `r${resolution}:seq${seq}`;
    results.push(
      createChunk({
        id,
        seq,
        expires: Infinity,
        range: chunkRange,
        resolution,
        zoom,
      }),
    );
  }

  return results;
}
