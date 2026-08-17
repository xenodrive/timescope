import type { TimescopeSeriesTooltipData } from '#src/bridge/protocol';
import type { TimescopeChunk } from '#src/core/chunk';
import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeOptions } from '#src/core/types';
import { parseUsing } from '#src/core/using';
import { unwrapFn } from '#src/core/utils';
import { resolutionFor } from '#src/core/zoom';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import type { TimescopeDataSeries, TimescopeSeriesPoint } from '#src/main/TimescopeDataSeries';
import { releaseViewForDataSource, requestViewForDataSource } from '#src/main/TimescopeDataSource';
import type { TimescopeDataLoadOptions } from '#src/main/TimescopeDataLoader';
import { TimescopeSeriesDataLoader, type TimescopeSeriesDataLoaderOptions } from '#src/main/TimescopeSeriesDataLoader';
import type { TimescopeView } from '#src/main/TimescopeView';

type TimescopeDataSeriesInput = NonNullable<TimescopeOptions['series']>[string];

function parseInstantaneous(instantaneous: TimescopeDataSeriesInput['data']['instantaneous']) {
  if (!instantaneous) {
    return {
      using: 'value',
      zoom: undefined,
      resolution: undefined,
    };
  }

  return {
    using: instantaneous.using ?? 'value',
    zoom: instantaneous.zoom,
    resolution: instantaneous.resolution,
  };
}

function parseTooltip(opts: TimescopeDataSeriesInput['tooltip']) {
  const format = ({
    name,
    unit,
    digits,
    value,
  }: {
    time: Decimal;
    value: Decimal | null;
    name: string | undefined;
    unit: string;
    digits: number;
  }) => {
    if (value == null) return 'No data';
    const items = [];
    if (name) items.push(name);
    items.push(value.toFixed(digits));
    if (unit) items.push(unit);

    return items.join(' ');
  };

  if (typeof opts === 'boolean' || !opts) return { format };
  return {
    ...opts,
    format: opts.format ?? format,
  };
}

export class TimescopeSeriesTooltip<O extends TimescopeSeriesDataLoaderOptions> extends TimescopeSeriesDataLoader<
  TimescopeSeriesTooltipData,
  O
> {
  static isEnabled(series: TimescopeDataSeries) {
    return series.options.tooltip !== false && series.options.data.instantaneous !== false;
  }

  #instantaneous;
  #view: TimescopeView<TimescopeDataRow>;
  #releaseView: () => void;
  #targetWaiters = new Set<AbortController>();
  #tooltip;

  constructor(options: O) {
    super(options);

    this.#instantaneous = parseInstantaneous(options.series.options.data.instantaneous);
    this.#tooltip = parseTooltip(options.series.options.tooltip);
    if (!options.viewContext) throw new Error('Tooltip requires a view context');
    const resolution =
      Decimal(this.#instantaneous.resolution) ??
      (this.#instantaneous.zoom !== undefined ? resolutionFor(this.#instantaneous.zoom) : undefined);
    const request = {
      strategy: 'cursor-with-fallback',
      resolution,
      dataResolution: resolution === undefined ? options.series.options.data?.resolution : undefined,
    } as const;
    if (options.series.source.requestView && options.series.source.releaseView) {
      this.#view = options.series.source.requestView(options.viewContext, request);
      this.#releaseView = () => options.series.source.releaseView!(this.#view);
    } else {
      this.#view = requestViewForDataSource(options.series.source, options.viewContext, request);
      this.#releaseView = () => releaseViewForDataSource(this.#view);
    }
    this.onDispose(this.#view.on('change', () => this.changed()));
    this.onDispose(() => this.#releaseView());
  }

  async loadData(
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
    _xOrigin?: Decimal,
    options: TimescopeDataLoadOptions = {},
  ) {
    return this.#loadViewData(range, resolution, options);
  }

  #loadViewData(range: TimescopeRange<Decimal>, resolution: Decimal, options: TimescopeDataLoadOptions) {
    const center = range[0].add(range[1]).div(2);
    const rows = this.#view.query(range, { includeOutbound: 1, loadMissing: options.loadMissing !== false });
    const selected = this.#selectRow(rows, range, resolution, center);
    if (!selected.row && options.loadMissing === false && this.options.series.immediate) this.#view.loadRetained();
    return this.#transformRows(
      this.options.series,
      selected.row ? [selected.row] : [],
      selected.using,
      range,
      selected.resolution,
    );
  }

  dispose() {
    this.cancelTargetWaiters();
    super.dispose();
  }

  async waitForTarget() {
    const controller = new AbortController();
    this.#targetWaiters.add(controller);
    try {
      await this.#view.waitForTarget(controller.signal);
    } finally {
      this.#targetWaiters.delete(controller);
    }
  }

  cancelTargetWaiters() {
    for (const controller of this.#targetWaiters)
      controller.abort(new DOMException('Target wait aborted', 'AbortError'));
    this.#targetWaiters.clear();
  }

  async transform(
    series: TimescopeDataSeries,
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
  ): Promise<TimescopeSeriesTooltipData> {
    const center = range[0].add(range[1]).div(2);
    const selected = this.#selectRow(this.#view.query(range), range, resolution, center);
    return this.#transformRows(series, selected.row ? [selected.row] : [], selected.using, range, resolution);
  }

  #selectRow(
    rows: readonly TimescopeSeriesPoint[],
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
    time: Decimal,
  ) {
    const using = parseUsing(
      unwrapFn(this.#instantaneous.using, { range, resolution, data: rows } as TimescopeChunk<any>),
    )[0];
    let row: TimescopeSeriesPoint | undefined;
    let rowTime: Decimal | undefined;
    for (const candidate of rows) {
      const candidateTime = candidate.times[using[1]];
      if (!candidateTime || candidateTime.gt(time)) continue;
      if (!rowTime || candidateTime.gt(rowTime)) {
        row = candidate;
        rowTime = candidateTime;
      }
    }
    return { row, using, resolution };
  }

  #transformRows(
    series: TimescopeDataSeries,
    src: readonly TimescopeSeriesPoint[],
    using: readonly [string, string],
    range: TimescopeRange<Decimal>,
    resolution: Decimal,
  ): TimescopeSeriesTooltipData {
    const { name } = series;
    const { unit, digits } = series.domain;

    const format = this.#tooltip.format;

    const { projection, wire: projectionWire } = series.domain.createProjection();

    const data: TimescopeSeriesTooltipData['data'] = {
      t: [],
      y: new Float64Array(src.length),
      text: [],
    };
    for (let i = 0; i < src.length; i++) {
      const time = src[i].times[using[1]];
      const value = src[i].values[using[0]];

      data.t[i] = time;
      data.y[i] = projection.normalize(value);
      data.text[i] = format({ time, value, unit, digits, name });
    }

    return {
      data,
      meta: {
        time: range[0]!,
        resolution,
        color: this.options.series.color ?? '',
        projection: projectionWire,
      },
    };
  }
}
