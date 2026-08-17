import type { TimescopeOptions } from '#src/core/types';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import type { TimescopeDataSource } from '#src/main/TimescopeDataSource';
import type { TimescopeDomain } from '#src/main/TimescopeDomain';

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

  get chunkOffset() {
    return this.#source.chunkOffset;
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
