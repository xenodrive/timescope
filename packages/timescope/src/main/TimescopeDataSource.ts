import { LRUCache } from '#src/core/cache';
import {
  createChunkList,
  type TimescopeDataChunkDesc,
  type TimescopeDataChunkLoader,
  type TimescopeDataChunkLoaderApi,
  type TimescopeDataChunkResult,
} from '#src/core/chunk';
import config from '#src/core/config';
import { Decimal } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { getConstraintedZoom } from '#src/core/zoom';
import { TimescopeDataChunk } from '#src/main/TimescopeDataChunk';

/**
 * Shared options for data sources.
 */
type TimescopeDataSourceCommonOptions = {
  /** Available zoom levels used to quantize resolution. */
  zoomLevels?: number[];
  /** Number of samples per chunk for tiled loading. */
  chunkSize?: number;
};

/**
 * Creates a data source from one of the following inputs:
 * - `loader`: async function that loads chunk data on demand
 * - `data`: static in-memory data
 * - `url`: fetch JSON from a URL
 */
export type TimescopeDataSourceOptions<V> = TimescopeDataSourceCommonOptions &
  ({ loader: TimescopeDataChunkLoader<V> } | { data: V } | { url: string });

function unwrapFetchResponse<T>(loader: TimescopeDataChunkLoader<any>): TimescopeDataChunkLoader<T> {
  return async (chunk: TimescopeDataChunkDesc, api: TimescopeDataChunkLoaderApi) => {
    const result = await loader(chunk, api);
    if (result instanceof Response) return (await result.json()) as T | undefined;
    return result as T | undefined;
  };
}

export class TimescopeDataSource<V> extends TimescopeObservable {
  #chunks = new LRUCache<string, TimescopeDataChunk<V>>({
    maxSize: 1000,
  });

  zoomLevels?: number[];
  chunkSize!: number;

  loader!: TimescopeDataChunkLoader<V>;

  constructor(opts: TimescopeDataSourceOptions<V>) {
    super();

    this.chunkSize = opts.chunkSize || config.defaultChunkSize;
    this.zoomLevels = opts.zoomLevels;

    if ('loader' in opts) {
      this.loader = unwrapFetchResponse(opts.loader);
    } else if ('data' in opts) {
      this.zoomLevels = [0];
      this.chunkSize = 0;
      this.loader = async () => opts.data;
    } else if ('url' in opts) {
      if (!opts.url.match(/{[a-zA-Z]+}/)) {
        this.zoomLevels = [0];
        this.chunkSize = 0;
        this.loader = unwrapFetchResponse(() => fetch(opts.url));
      } else {
        this.loader = unwrapFetchResponse(async (chunk) => {
          const url = opts.url.replace(/{[a-zA-Z]+}/g, (m) => {
            const key = m.substring(1, m.length - 1);
            switch (key) {
              case 'z':
              case 'zoom':
                return chunk.zoom.toString();

              case 'r':
              case 'resolution':
                return chunk.resolution.rescale().toString();

              case 's':
              case 'start':
                return chunk.range[0]!.rescale().toString();

              case 'e':
              case 'end':
                return chunk.range[1]!.rescale().toString();

              default:
                console.warn('Unknown template string is found in the URL: ' + m);
                return m;
            }
          });

          return await fetch(url);
        });
      }
    } else {
      throw new Error('No source');
    }
  }

  async loadChunk({ id, seq, range, resolution, zoom }: TimescopeDataChunkDesc): Promise<TimescopeDataChunkResult<V>> {
    const chunk = this.#allocChunk(id, seq, range, resolution, zoom);

    const data = (await chunk.load()) ?? undefined;

    return { id, seq, expires: chunk.expires, range, resolution, zoom, data };
  }

  #allocChunk(id: string, seq: bigint, range: TimescopeRange<Decimal | undefined>, resolution: Decimal, zoom: number) {
    let chunk = this.#chunks.get(id);
    if (!chunk) {
      chunk = new TimescopeDataChunk({ id, seq, loader: this.loader, range, resolution, zoom });
      this.#chunks.set(id, chunk);
    }

    return chunk;
  }

  async loadData(range: TimescopeRange<Decimal | undefined>, zoom: number) {
    zoom = getConstraintedZoom(zoom, this.zoomLevels);
    const chunks = createChunkList(range, zoom, this.chunkSize);

    return await Promise.all(chunks.map((chunk) => this.loadChunk(chunk)));
  }

  async expireChunks(range?: TimescopeRange<Decimal | undefined>) {
    for (const chunk of this.#chunks.values()) {
      if (
        !range ||
        !chunk.range[1] ||
        chunk.range[1].gt(range[0]!) ||
        !chunk.range[0] ||
        chunk.range[0].lt(range[1]!)
      ) {
        chunk.invalidate();
      }
    }

    this.changed();
  }
}

export function createDataSource(value: unknown) {
  if (typeof value === 'string') {
    return new TimescopeDataSource({ url: value });
  }
  if (typeof value === 'function') {
    return new TimescopeDataSource({ loader: value as any });
  }
  if (value instanceof TimescopeDataSource) return value;
  if (typeof value === 'object' && value && ['url', 'loader', 'data'].some((x) => x in value)) {
    return new TimescopeDataSource(value as TimescopeDataSourceOptions<unknown>);
  }
  return new TimescopeDataSource({ data: value });
}
