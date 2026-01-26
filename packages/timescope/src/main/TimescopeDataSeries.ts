import { createChunkList, type TimescopeChunk } from '#src/core/chunk';
import { Decimal, DecimalSafe, type NumberLike } from '#src/core/decimal';
import { TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import { parseTimeLike } from '#src/core/time';
import type { FieldDefLike, TimescopeOptions } from '#src/core/types';
import { createGetter } from '#src/core/utils';
import { getConstraintedResolution } from '#src/core/zoom';
import type { TimescopeDomain } from '#src/main/TimescopeDomain';
import type { TimescopeDataSource } from '#src/main/TimescopeDataSource';
import { bisectLeft, bisectRight } from '#src/worker/bisect';

type TimescopeDataSeriesInput = NonNullable<TimescopeOptions['series']>[string];

export type TimescopeSeriesPoint = {
  time: Record<string, Decimal>;
  value: Record<string, Decimal | null>;
  data: Record<string, unknown>;
};

const DECIMAL_ZERO = Decimal(0);

function minRangeValue(current: Decimal | undefined, candidate: Decimal | undefined): Decimal | undefined {
  if (candidate === undefined) return current;
  if (current === undefined) return candidate;
  return candidate.lt(current) ? candidate : current;
}

function maxRangeValue(current: Decimal | undefined, candidate: Decimal | undefined): Decimal | undefined {
  if (candidate === undefined) return current;
  if (current === undefined) return candidate;
  return current.gt(candidate) ? current : candidate;
}

function overlaps(a: TimescopeRange<Decimal | undefined>, b: TimescopeRange<Decimal | undefined>): boolean {
  if (!a[0] || !a[1] || !b[0] || !b[1]) return false;
  return a[0].lt(b[1]) && b[0].lt(a[1]);
}

function shouldKeep(data: TimescopeSeriesPoint[], idx: number, window: [Decimal, Decimal]): boolean {
  const prev = data[idx - 1];
  const curr = data[idx];
  const next = data[idx + 1];

  if (overlaps([prev?.time._maxTime, curr?.time._minTime], window)) return true;
  if (overlaps([curr?.time._minTime, curr?.time._maxTime], window)) return true;
  if (overlaps([curr?.time._maxTime, next?.time._minTime], window)) return true;

  return false;
}
function timeInRange(time: Record<string, Decimal>, range: TimescopeRange<Decimal | undefined>) {
  return range[0] && range[1] && time._minTime?.le(range[1]) && range[0]?.le(time._maxTime);
}

function parseKeyFields(data: FieldDefLike<unknown> | undefined, field: 'time' | 'value') {
  return Object.fromEntries(
    (Array.isArray(data)
      ? data.map((s) => [s, s])
      : Object.entries(
          typeof data === 'string' || data == null
            ? {
                [field]: data ?? field,
              }
            : data,
        )
    ).map(([k, v]) => [k, typeof v === 'function' ? v : createGetter(v)]),
  );
}

export class TimescopeDataSeries extends TimescopeObservable {
  #options;
  #sources;
  #domain;

  #chunksInView: Record<string, TimescopeChunk<TimescopeSeriesPoint[]> & { _loading?: boolean }> = {};

  #color;

  constructor(opts: {
    sources: Record<string, TimescopeDataSource<unknown>>;
    options: TimescopeDataSeriesInput;
    domain: TimescopeDomain;
  }) {
    super();
    this.#options = opts.options;
    this.#sources = opts.sources;
    this.#domain = opts.domain;

    this.#color = opts.options.data.color;
    this.#domain.addSeries(this);
  }

  get name() {
    return this.#options.data.name ?? '';
  }

  get resolutions() {
    return this.#sources[this.#options.data.source].resolutions;
  }

  get chunkSize() {
    return this.#sources[this.#options.data.source].chunkSize;
  }

  get chunkOffset() {
    return this.#sources[this.#options.data.source].chunkOffset;
  }

  get options() {
    return this.#options;
  }

  get domain() {
    return this.#domain;
  }

  async #loadChunk(chunk: TimescopeChunk): Promise<TimescopeChunk<TimescopeSeriesPoint[]>> {
    // use the source by name
    const result = await this.#sources[this.#options.data.source].loadChunk(chunk);

    const parsed = (this.#options.data.parser?.(result.data) ?? result.data) as Record<string, unknown>[];

    if (!Array.isArray(parsed)) {
      throw new Error('Unsupported type of data from the source. It should be an array after parsed.');
    }

    // parse times and values
    const timeFields = parseKeyFields(this.#options.data.time, 'time');
    const valueFields = parseKeyFields(this.#options.data.value, 'value');

    const data: TimescopeSeriesPoint[] = parsed.map((elm) => {
      const time = Object.fromEntries(Object.entries(timeFields).map(([k, fn]) => [k, parseTimeLike<never>(fn(elm))]));
      const value = Object.fromEntries(
        Object.entries(valueFields)
          .map(([k, fn]) => [k, DecimalSafe(fn(elm) as NumberLike | null)])
          .filter(([, v]) => v !== undefined),
      );

      const [minTime, maxTime] = Decimal.minmax(...Object.values(time));
      time._minTime = minTime!;
      time._maxTime = maxTime!;

      return { time, value, data: elm };
    });

    return {
      ...result,
      data,
    };
  }

  #purgeChunks: Record<string, TimescopeChunk<TimescopeSeriesPoint[]>> = {};

  #data: TimescopeSeriesPoint[] = [];

  get data() {
    return this.#data;
  }

  #mergeData(chunk: TimescopeChunk, data: TimescopeSeriesPoint[] | undefined) {
    if (!data) return;

    const l = bisectLeft(this.#data, chunk.range[0]!, (v) => v.time._minTime);
    const r = bisectRight(this.#data, chunk.range[1]!, (v) => v.time._minTime);
    this.#data = [...this.data.slice(0, l), ...data, ...this.data.slice(r)];
  }

  #purgeData() {
    const activeChunks = Object.values(this.#chunksInView);
    const orig = this.#data;

    const [min, max] = activeChunks.reduce(
      (acc, chunk) => {
        const start = chunk.range[0];
        const end = chunk.range[1];
        return [minRangeValue(acc[0], start), maxRangeValue(acc[1], end)] as [Decimal | undefined, Decimal | undefined];
      },
      [undefined, undefined] as [Decimal | undefined, Decimal | undefined],
    );

    if (!min || !max) return orig;
    const win = [min, max] as [Decimal, Decimal];

    return orig.filter((_, idx) => shouldKeep(orig, idx, win));
  }

  updateView(range: TimescopeRange<Decimal>, resolution: Decimal, purge: boolean) {
    resolution = getConstraintedResolution(resolution, this.resolutions);

    const purgeChunks = { ...this.#chunksInView };
    const chunks = createChunkList(range, resolution, this.chunkSize, this.chunkOffset).map((chunk) => {
      delete purgeChunks[chunk.id];
      delete this.#purgeChunks[chunk.id];
      return this.#chunksInView[chunk.id] ?? chunk;
    });
    Object.values(purgeChunks).forEach((chunk) => {
      this.#purgeChunks[chunk.id] = chunk;
      delete this.#chunksInView[chunk.id];
    });

    const t = Date.now();

    this.#viewRange = range;
    chunks.forEach((chunk) => {
      if (chunk._loading) return;
      if (this.#chunksInView[chunk.id] && t <= chunk.expires!) return;
      this.#chunksInView[chunk.id] = chunk;
      chunk.expires = Infinity;

      chunk._loading = true;
      this.#loadChunk(chunk)
        .then((result) => {
          chunk.expires = result?.expires ?? chunk.expires;
          if (this.#chunksInView[chunk.id]) {
            this.#chunksInView[chunk.id].data = result.data;
            this.#mergeData(chunk, result.data);
            this.changed();
          }
        })
        .finally(() => {
          chunk._loading = false;
        });
    });

    if (purge) {
      this.#data = this.#purgeData();
      this.changed();
    }
  }

  #viewRange: TimescopeRange<Decimal> | null = null;

  get color() {
    return this.#color;
  }

  get viewRange() {
    return this.#viewRange;
  }

  computeMinMax(range: TimescopeRange<Decimal>) {
    const activeChunks = Object.values(this.#chunksInView);
    let pmin: Decimal | null | undefined;
    let pmax: Decimal | null | undefined;
    let nmin: Decimal | null | undefined;
    let nmax: Decimal | null | undefined;
    let zero: Decimal | null | undefined;

    const classify = (values: (Decimal | undefined | null)[]) => {
      const [$pmin, $pmax] = Decimal.minmax(...values.filter((v) => v?.isPositive()), pmin, pmax);
      const [$nmin, $nmax] = Decimal.minmax(...values.filter((v) => v?.isNegative()), nmin, nmax);
      const $zero = zero || (values.some((v) => v?.isZero()) && DECIMAL_ZERO) || null;

      pmin = $pmin;
      pmax = $pmax;
      nmin = $nmin;
      nmax = $nmax;
      zero = $zero;
    };

    for (const { data } of activeChunks) {
      if (!data) continue;
      for (const d of data) {
        if (!timeInRange(d.time, range)) continue;
        classify(Object.values(d.value));
      }
    }

    if (!pmin && !nmax && !zero && !pmax && !nmin) return null;
    return { pmin, pmax, nmin, nmax, zero };
  }
}

export function createDataSeries(opts: {
  sources: Record<string, TimescopeDataSource<unknown>>;
  options: TimescopeDataSeriesInput;
  domain: TimescopeDomain;
}) {
  return new TimescopeDataSeries(opts);
}
