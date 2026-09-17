import type { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { zoomFor } from '#src/core/zoom';
import {
  normalizeDataRows,
  type TimescopeDataRow,
  type TimescopeDataRowInput,
  type TimescopeMappings,
} from '#src/main/TimescopeData';

/** Acquisition conditions, independent of output chunk boundaries and identities. */
export type TimescopeLoadRequest = {
  range: TimescopeRange<Decimal>;
  resolution: Decimal;
};
export type TimescopeRangeLoader<T = unknown> = (request: TimescopeLoadRequest) => T | Promise<T>;
export type TimescopeSnapshotLoader<T = unknown> = () => T | Promise<T>;
export type TimescopeDataDecoder = (
  payload: any,
) => readonly TimescopeDataRowInput[] | Promise<readonly TimescopeDataRowInput[]>;
export type TimescopeDataTransform =
  | { decoder: TimescopeDataDecoder; mappings?: never }
  | { decoder?: never; mappings: TimescopeMappings }
  | { decoder?: never; mappings?: never };
export type TimescopeSnapshotAcquisition =
  | { data: unknown; url?: never; loader?: never }
  | { url: string; data?: never; loader?: never }
  | { loader: TimescopeSnapshotLoader | TimescopeDataLoader<false>; chunked: false; data?: never; url?: never };
export type TimescopeDataAcquisition =
  | TimescopeSnapshotAcquisition
  | { loader: TimescopeRangeLoader | TimescopeDataLoader; chunked?: true; data?: never; url?: never };
export type TimescopeDataLoaderOptions = TimescopeDataAcquisition & TimescopeDataTransform;

function resolveUrl(url: string, request: TimescopeLoadRequest) {
  return url.replace(/{[a-zA-Z]+}/g, (match) => {
    switch (match.slice(1, -1)) {
      case 'z':
      case 'zoom':
        return String(zoomFor(request.resolution));
      case 'r':
      case 'resolution':
        return request.resolution.rescale().toString();
      case 's':
      case 'start':
        return request.range[0].rescale().toString();
      case 'e':
      case 'end':
        return request.range[1].rescale().toString();
      default:
        throw new Error(`Unknown URL template: ${match}`);
    }
  });
}

/** Acquisition and normalization only. Sources own caching and invalidation. */
export class TimescopeDataLoader<Ranged extends boolean = boolean> {
  readonly ranged: Ranged;
  #options: TimescopeDataLoaderOptions;

  constructor(options: TimescopeDataLoaderOptions) {
    if (['data', 'url', 'loader'].filter((key) => key in options).length !== 1)
      throw new Error('A loader must specify exactly one of data, url, or loader');
    if ('decoder' in options && 'mappings' in options) throw new Error('A decoder cannot be combined with mappings');
    if ('url' in options && typeof options.url !== 'string') throw new Error('A loader URL must be a string');
    if ('loader' in options && typeof options.loader !== 'function' && !(options.loader instanceof TimescopeDataLoader))
      throw new Error('A loader must be a function or DataLoader');
    if (options.loader instanceof TimescopeDataLoader && (options.decoder || options.mappings))
      throw new Error('Configure transforms on the supplied DataLoader');
    this.#options = options;
    this.ranged = (
      options.loader instanceof TimescopeDataLoader
        ? options.loader.ranged
        : typeof options.url === 'string'
          ? /{[a-zA-Z]+}/.test(options.url)
          : typeof options.loader === 'function' && options.chunked !== false
    ) as Ranged;
  }

  async load(
    ...args: Ranged extends false
      ? []
      : Ranged extends true
        ? [request: TimescopeLoadRequest]
        : [request?: TimescopeLoadRequest]
  ): Promise<readonly TimescopeDataRow[]> {
    const request = args[0];
    if (this.ranged !== (request !== undefined))
      throw new Error(this.ranged ? 'A range request is required' : 'Snapshot loads do not accept a range');
    if (request && (request.range[1].lt(request.range[0]) || request.resolution.le(0)))
      throw new RangeError('Load range must be ordered and resolution must be positive');
    const options = this.#options;
    if (options.loader instanceof TimescopeDataLoader)
      return request ? options.loader.load(request) : options.loader.load();
    let payload: unknown;
    if ('data' in options) payload = await options.data;
    else if ('url' in options) payload = await fetch(request ? resolveUrl(options.url!, request) : options.url!);
    else
      payload = await (request
        ? (options.loader as TimescopeRangeLoader)(request)
        : (options.loader as TimescopeSnapshotLoader)());
    if (options.decoder) return Object.freeze(normalizeDataRows(await options.decoder(payload)));
    if (payload instanceof Response) payload = await payload.json();
    return Object.freeze(normalizeDataRows(payload, options.mappings));
  }
}

type IsRanged<S> = S extends { loader: TimescopeDataLoader<infer R> }
  ? R
  : S extends { data: unknown } | { chunked: false }
    ? false
    : S extends { url: infer U extends string }
      ? string extends U
        ? boolean
        : U extends `${string}{${string}}${string}`
          ? true
          : false
      : true;
export function createDataLoader<const S extends TimescopeDataLoaderOptions>(
  options: S,
): TimescopeDataLoader<IsRanged<S>> {
  return new TimescopeDataLoader(options);
}
