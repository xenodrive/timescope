import type { TimescopeSeriesProviderMeta } from '#src/bridge/protocol';
import { LRUCache } from '#src/core/cache';
import { createChunkList, type TimescopeDataChunkDesc, type TimescopeDataChunkResult } from '#src/core/chunk';
import { Decimal, DecimalSafe, isDecimal, minmax, type NumberLike } from '#src/core/decimal';
import type { Range } from '#src/core/range';
import { parseTimeLike } from '#src/core/time';
import type { TimescopeOptions } from '#src/core/types';
import { createGetter } from '#src/core/utils';
import { getConstraintedZoom } from '#src/core/zoom';
import type { TimescopeDataSource } from '#src/main/TimescopeDataSource';

type TimescopeDataSeriesInput = NonNullable<TimescopeOptions['series']>[string];

export type TimescopeDataSeriesChunkData = {
  time: Record<string, Decimal>;
  value: Record<string, Decimal | null>;
  data?: Record<string, unknown>;
};

export type TimescopeDataSeriesChunkMeta = TimescopeSeriesProviderMeta;

export type TimescopeDataSeriesChunkResult = TimescopeDataChunkResult<
  TimescopeDataSeriesChunkData[],
  TimescopeDataSeriesChunkMeta
>;

function isNumberLike(v: unknown): v is NumberLike {
  if (isDecimal(v)) return true;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return true;
  return false;
}

type DataRangeInput =
  | NumberLike
  | Range<NumberLike | undefined>
  | {
      shrink?: boolean;
      expand?: boolean;
      default?: NumberLike | Range<NumberLike | undefined>;
    };

const DECIMAL_ZERO = Decimal(0);

function parseDataRange(range: DataRangeInput | undefined) {
  if (range == null) {
    return {
      shrink: false,
      expand: false,
      default: [Decimal(0), undefined] as Range<Decimal | undefined>,
    };
  }

  if (Array.isArray(range)) {
    return {
      shrink: false,
      expand: false,
      default: range.map(Decimal) as Range<Decimal | undefined>,
    };
  }

  if (typeof range === 'number' || isNumberLike(range)) {
    return {
      shrink: false,
      expand: false,
      default: [Decimal(0), Decimal(range)] as Range<Decimal | undefined>,
    };
  }

  if (range.default != null && !Array.isArray(range.default)) {
    return {
      shrink: range.shrink ?? false,
      expand: range.expand ?? false,
      default: [Decimal(0), Decimal(range.default)] as Range<Decimal | undefined>,
    };
  }

  return {
    shrink: range.shrink ?? false,
    expand: range.expand ?? false,
    default: (range.default ?? [0, undefined]).map(Decimal) as Range<Decimal | undefined>,
  };
}

function timeInRange(time: Record<string, Decimal>, range: Range<Decimal>) {
  return time._minTime?.le(range[1]) && range[0]?.le(time._maxTime);
}

export class TimescopeDataSeries {
  #options;
  #sources;

  #dataRange;
  #minmaxCache: LRUCache<string, { time: Record<string, Decimal>; value: Record<string, Decimal | null> }[]> =
    new LRUCache({
      maxSize: 256,
    });
  #minmax: null | {
    pmin: Decimal | null | undefined;
    pmax: Decimal | null | undefined;
    nmin: Decimal | null | undefined;
    nmax: Decimal | null | undefined;
    zero: Decimal | null | undefined;
  } = null;

  #color;

  constructor(opts: { sources: Record<string, TimescopeDataSource<unknown>>; options: TimescopeDataSeriesInput }) {
    this.#options = opts.options;
    this.#sources = opts.sources;

    this.#color = opts.options.data.color;

    this.#dataRange = parseDataRange(opts.options.data.range);
  }

  get name() {
    return this.#options.data.name ?? '';
  }

  get digits() {
    return this.#options.data.digits ?? 1;
  }

  get unit() {
    return this.#options.data.unit ?? '';
  }

  get zoomLevels() {
    return this.#sources[this.#options.data.source].zoomLevels;
  }

  get chunkSize() {
    return this.#sources[this.#options.data.source].chunkSize;
  }

  get options() {
    return this.#options;
  }

  async loadChunk(chunk: TimescopeDataChunkDesc): Promise<TimescopeDataSeriesChunkResult> {
    // use the source by name
    const result = await this.#sources[this.#options.data.source].loadChunk(chunk);

    const parsed = (this.#options.data.parser?.(result.data) ?? result.data) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid data from the source after parsed.');
    }

    // parse times and values

    const timeFields = Object.fromEntries(
      (Array.isArray(this.#options.data.time)
        ? this.#options.data.time.map((s) => [s, s])
        : Object.entries(
            typeof this.#options.data.time === 'string' || this.#options.data.time == null
              ? {
                  time: this.#options.data.time ?? 'time',
                }
              : this.#options.data.time,
          )
      ).map(([k, v]) => [k, typeof v === 'function' ? v : createGetter(v)]),
    );

    const valueFields = Object.fromEntries(
      (Array.isArray(this.#options.data.value)
        ? this.#options.data.value.map((s) => [s, s])
        : Object.entries(
            typeof this.#options.data.value === 'string' || this.#options.data.value == null
              ? {
                  value: this.#options.data.value ?? 'value',
                }
              : this.#options.data.value,
          )
      ).map(([k, v]) => [k, typeof v === 'function' ? v : createGetter(v)]),
    );

    const data = parsed.map((elm) => {
      const time = Object.fromEntries(Object.entries(timeFields).map(([k, fn]) => [k, parseTimeLike<never>(fn(elm))]));
      const value = Object.fromEntries(
        Object.entries(valueFields)
          .map(([k, fn]) => [k, DecimalSafe(fn(elm) as NumberLike | null)])
          .filter(([, v]) => v !== undefined),
      );

      const [minTime, maxTime] = minmax(...Object.values(time));
      time._minTime = minTime!;
      time._maxTime = maxTime!;

      return { time, value, data: elm };
    });

    this.#minmaxCache.set(result.id, data);

    return {
      ...result,
      data,
    };
  }

  updateDataRange(range: Range<Decimal>, zoom: number) {
    zoom = getConstraintedZoom(zoom, this.zoomLevels);
    const activeChunks = createChunkList(range, zoom, this.chunkSize);
    const expandU = this.#dataRange.expand || this.#dataRange.default?.[1] === undefined;
    const expandL = this.#dataRange.expand || this.#dataRange.default?.[0] === undefined;
    const shrink = this.#dataRange.shrink;

    let { pmin, pmax, nmin, nmax, zero } = shrink || !this.#minmax ? {} : this.#minmax;

    const classify = (values: (Decimal | undefined | null)[], force: boolean = false) => {
      const [$pmin, $pmax] = Decimal.minmax(...values.filter((v) => v?.isPositive()), pmin, pmax);
      const [$nmin, $nmax] = Decimal.minmax(...values.filter((v) => v?.isNegative()), nmin, nmax);
      const $zero = zero || (values.some((v) => v?.isZero()) && DECIMAL_ZERO) || null;

      return [
        force || expandU ? $pmax : pmax,
        force || expandL ? $pmin : pmin,
        force || expandL ? $zero : zero,
        force || expandL ? $nmax : nmax,
        force || expandU ? $nmin : nmin,
      ];
    };

    [pmax, pmin, zero, nmax, nmin] = classify(this.#dataRange.default, true);

    if (expandU || expandL) {
      for (const { id } of activeChunks) {
        const data = this.#minmaxCache.get(id);
        if (!data) continue;

        for (const d of data) {
          if (!timeInRange(d.time, range)) continue;

          [pmax, pmin, zero, nmax, nmin] = classify(Object.values(d.value));
        }
      }
    }

    if (!pmin && !nmax && !zero && !pmax && !nmin) return;

    this.#minmax = { pmin, pmax, nmin, nmax, zero };
  }

  get color() {
    return this.#color;
  }

  get dataRange() {
    return this.#minmax;
  }
}

export function createDataSeries(opts: {
  sources: Record<string, TimescopeDataSource<unknown>>;
  options: TimescopeDataSeriesInput;
}) {
  return new TimescopeDataSeries(opts);
}
