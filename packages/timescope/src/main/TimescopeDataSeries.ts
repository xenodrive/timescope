import type { Decimal, NumberLike } from '#src/core/decimal';
import type { TimescopeDataResolution } from '#src/core/zoom';
import type { MaybeFn, TimescopeChartLink, TimescopeChartMark, TimescopeChartType, Using1 } from '#src/main/chart';
import type { TimescopeOptions } from '#src/main/options';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import type {
  InferSourceData,
  InferSourceRow,
  InferSourceValueKey,
  InferTimesKey,
  TimescopeDataSource,
} from '#src/main/TimescopeDataSource';
import type { TimescopeDomain, TimescopeDomainOptions } from '#src/main/TimescopeDomain';

export type TimescopeSeriesInput<
  Sources = Record<string, unknown>,
  SourceName extends keyof Sources = keyof Sources,
  Track extends string = string,
  U extends [string, string] = [string, string],
  D = unknown,
> = {
  data: {
    source: SourceName;
    name?: string;
    color?: string;
    domain?: string | TimescopeDomainOptions;
    resolution?: TimescopeDataResolution;
    instantaneous?: false | { using?: Using1<U>; zoom?: number; resolution?: NumberLike };
  };
  chart?:
    | TimescopeChartType
    | {
        marks?: MaybeFn<
          TimescopeChartMark<
            [{ resolution: Decimal; data: D; times: Record<U[0], Decimal>; values: Record<U[1], Decimal | null> }],
            U
          >[],
          [{ resolution: Decimal; data: D; times: Record<U[0], Decimal>; values: Record<U[1], Decimal | null> }]
        >;
        links?: MaybeFn<TimescopeChartLink<[opts: { resolution: Decimal }], U>[], [opts: { resolution: Decimal }]>;
      };
  tooltip?:
    | boolean
    | {
        label?: string;
        format?: (opts: {
          time: Decimal;
          value: Decimal | null;
          name: string | undefined;
          unit: string;
          digits: number;
        }) => string;
      };
  track?: Track;
};

type TimescopeSeriesIdeal<Sources, Series, Track extends string> = {
  [K in keyof Series]: Series[K] extends { data: { source: infer S extends keyof Sources } }
    ? TimescopeSeriesInput<
        Sources,
        S,
        Track,
        [InferTimesKey<InferSourceRow<Sources[S]>>, InferSourceValueKey<Sources[S]>],
        InferSourceData<Sources[S]>
      >
    : TimescopeSeriesInput<Sources, keyof Sources, Track>;
};
export type TimescopeOptionsSeries<Sources, Series, Track extends string> =
  TimescopeSeriesIdeal<Sources, Series, Track> extends Series ? Series : TimescopeSeriesIdeal<Sources, Series, Track>;

type TimescopeDataSeriesInput = NonNullable<TimescopeOptions['series']>[string];

export type TimescopeSeriesPoint = TimescopeDataRow;

export class TimescopeDataSeries {
  #options;
  #domain;
  #source;
  #name;
  #color;

  constructor(opts: {
    sources: Record<string, TimescopeDataSource<any>>;
    options: TimescopeDataSeriesInput;
    domain: TimescopeDomain;
  }) {
    const source = opts.sources[opts.options.data.source];
    if (!source) throw new Error(`Unknown data source: ${opts.options.data.source}`);
    this.#domain = opts.domain;
    this.#options = opts.options;
    this.#source = source;
    this.#name = opts.options.data.name;
    this.#color = opts.options.data.color;
    this.#domain.addSeries(this);
  }

  get options() {
    return this.#options;
  }

  get domain() {
    return this.#domain;
  }

  get name() {
    return this.#name;
  }

  get color() {
    return this.#color;
  }

  get immediate() {
    return this.#source.immediate;
  }

  get source() {
    return this.#source;
  }

  get chunkSize() {
    return this.#source.chunkSize;
  }

  get chunkOrigin() {
    return this.#source.chunkOrigin;
  }

  get resolutions() {
    return this.#source.resolutions;
  }

  dispose() {
    this.#domain.removeSeries(this);
  }
}

export function createDataSeries(opts: {
  sources: Record<string, TimescopeDataSource<any>>;
  options: TimescopeDataSeriesInput;
  domain: TimescopeDomain;
}) {
  return new TimescopeDataSeries(opts);
}
