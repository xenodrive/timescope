import config from '#src/core/config';
import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { resolutionFor } from '#src/core/zoom';

/**
 * Minimal descriptor for a data chunk (no payload).
 */
export type TimescopeDataChunkDesc = {
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
};

export type TimescopeDataChunkResult<T, M = never> = TimescopeDataChunkDesc & {
  data?: T;
  meta?: M & { revision: number };
};

export type TimescopeDataChunkLoaderApi = { expiresAt: (t: number) => void; expiresIn: (t: number) => void };

/**
 * Loader function that receives a chunk descriptor and returns its payload.
 */
export type TimescopeDataChunkLoader<T> = (
  chunk: TimescopeDataChunkDesc,
  api: TimescopeDataChunkLoaderApi,
) => Promise<T | undefined>;

export function createChunkList(
  range: TimescopeRange<Decimal | undefined>,
  zoom: number,
  chunkSize: number = config.defaultChunkSize,
): TimescopeDataChunkDesc[] {
  const resolution = resolutionFor(zoom);
  const chunkDuration = resolution.mul(chunkSize);

  if (!range[0] || !range[1] || !chunkDuration.isPositive()) {
    const seq = 0n;
    const id = `z${zoom}`;
    return [{ id, seq, expires: Infinity, range, resolution, zoom }];
  }

  const results: TimescopeDataChunkDesc[] = [];
  const limit = range[1]!.add(chunkDuration);
  for (let t = range[0]!; t.le(limit); t = t.add(chunkDuration)) {
    const seq = t.div(chunkDuration).floor().integer();
    const chunkRange = [chunkDuration.mul(seq), chunkDuration.mul(seq + 1n)] as TimescopeRange<Decimal | undefined>;
    const id = `z${zoom}:seq${seq}`;
    results.push({ id, seq, expires: Infinity, range: chunkRange, resolution, zoom });
  }

  return results;
}
