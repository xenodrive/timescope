import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { zoomFor } from '#src/core/zoom';

export const DEFAULT_CHUNK_SIZE = 256;

/**
 * Chunk descriptor with optional payload.
 */
export type TimescopeChunk<T = never> = {
  /** Chunk id string. */
  id: string;
  /** Sequence number (monotonic along time). */
  seq: bigint;

  /** Time range covered by this chunk. */
  range: TimescopeRange<Decimal | undefined>;
  /** Selected source interval in the same time units as `range`. */
  resolution: Decimal;
  /** Zoom level. */
  zoom: number;
  /** Iterator for time points. */
  [Symbol.iterator]: () => Generator<Decimal>;
} & ([T] extends [never] ? unknown : { data?: T });

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
  resolution: Decimal,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkOrigin?: Decimal,
): TimescopeChunk[] {
  if (!range[0] || !range[1]) throw new RangeError('Chunk range must be finite');
  if (resolution.le(0)) throw new RangeError('Chunk resolution must be positive');
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) throw new RangeError('Chunk size must be a positive integer');
  const chunkDuration = resolution.mul(chunkSize);

  const zoom = zoomFor(resolution);
  const results: TimescopeChunk[] = [];
  const offset = chunkOrigin ?? Decimal(0);
  const limit = range[1]!.add(chunkDuration);
  let seq = range[0]!.sub(offset).divFloor(chunkDuration).integer();

  const end = limit.sub(offset).divFloor(chunkDuration).integer();

  let chunkT = offset.add(chunkDuration.mul(seq));
  for (; seq <= end; seq++) {
    const nextT = chunkT.add(chunkDuration);
    const chunkRange = [chunkT, nextT] as TimescopeRange<Decimal | undefined>;
    chunkT = nextT;
    const id = `r${resolution}:seq${seq}`;
    results.push(
      createChunk({
        id,
        seq,
        range: chunkRange,
        resolution,
        zoom,
      }),
    );
  }

  return results;
}
