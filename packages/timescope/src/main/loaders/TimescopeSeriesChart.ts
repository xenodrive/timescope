import { Decimal, isDecimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import {
  compileLinkGeometry,
  type LinkGeometryCoordinate,
  type LinkGeometryKind,
  type LinkGeometryRole,
  type LinkGeometrySource,
} from '#src/main/loaders/LinkGeometry';
import { parseUsing, unwrapFn } from '#src/main/loaders/options';
import {
  TimescopeSeriesDataLoader,
  type TimescopeSeriesDataLoaderOptions,
} from '#src/main/loaders/TimescopeDataLoader';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import { releaseViewForDataSource, requestViewForDataSource } from '#src/main/TimescopeDataSource';
import type { TimescopeView } from '#src/main/TimescopeView';
import type {
  TimescopeChartLink,
  TimescopeChartMark,
  TimescopeChartType,
  TimescopeProjectedChartMark,
  TimescopeSeriesChartData,
  Using,
} from '#src/renderer/types';

const stylePresetLookup: Partial<
  Record<
    TimescopeChartType,
    {
      marks?: TimescopeChartMark<false>[];
      links?: TimescopeChartLink<false>[];
    }
  >
> = {
  lines: { links: [{ draw: 'line' }] },
  'lines:filled': { links: [{ draw: 'area' }, { draw: 'line' }] },
  curves: { links: [{ draw: 'curve' }] },
  'curves:filled': { links: [{ draw: 'curve-area' }, { draw: 'curve' }] },
  'steps-start': { links: [{ draw: 'step-start' }] },
  'steps-start:filled': { links: [{ draw: 'step-area-start' }, { draw: 'step-start' }] },
  steps: { links: [{ draw: 'step' }] },
  'steps:filled': { links: [{ draw: 'step-area' }, { draw: 'step' }] },
  'steps-end': { links: [{ draw: 'step-end' }] },
  'steps-end:filled': { links: [{ draw: 'step-area-end' }, { draw: 'step-end' }] },
  points: { marks: [{ draw: 'circle' }] },
  linespoints: { links: [{ draw: 'line' }], marks: [{ draw: 'circle' }] },
  'linespoints:filled': { links: [{ draw: 'area' }, { draw: 'line' }], marks: [{ draw: 'circle' }] },
  curvespoints: { links: [{ draw: 'curve' }], marks: [{ draw: 'circle' }] },
  'curvespoints:filled': { links: [{ draw: 'curve-area' }, { draw: 'curve' }], marks: [{ draw: 'circle' }] },
  'stepspoints-start': { links: [{ draw: 'step-start' }], marks: [{ draw: 'circle' }] },
  'stepspoints-start:filled': {
    links: [{ draw: 'step-area-start' }, { draw: 'step-start' }],
    marks: [{ draw: 'circle' }],
  },
  stepspoints: { links: [{ draw: 'step' }], marks: [{ draw: 'circle' }] },
  'stepspoints:filled': { links: [{ draw: 'step-area' }, { draw: 'step' }], marks: [{ draw: 'circle' }] },
  'stepspoints-end': { links: [{ draw: 'step-end' }], marks: [{ draw: 'circle' }] },
  'stepspoints-end:filled': { links: [{ draw: 'step-area-end' }, { draw: 'step-end' }], marks: [{ draw: 'circle' }] },
  impulses: { marks: [{ draw: 'line', using: ['value', '#zero'] }] },
  impulsespoints: { marks: [{ draw: 'line', using: ['value', '#zero'] }, { draw: 'circle' }] },
  bars: { marks: [{ draw: 'bar', using: ['value', '#zero'], style: { fillOpacity: 0 } }] },
  'bars:filled': { marks: [{ draw: 'bar', using: ['value', '#zero'] }] },
};

function stylePreset(k: TimescopeChartType): {
  marks?: TimescopeChartMark<false>[];
  links?: TimescopeChartLink<false>[];
} {
  return stylePresetLookup[k] ?? {};
}

type CompiledResolver<T, A> = {
  dynamic: boolean;
  resolve: (arg: A) => T;
};

function compileResolver<T, A>(value: T): CompiledResolver<T, A> {
  if (typeof value === 'function') {
    return {
      dynamic: true,
      resolve: (arg) => (value as (arg: A) => T)(arg),
    };
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => compileResolver<unknown, A>(item));
    if (!items.some((item) => item.dynamic)) return { dynamic: false, resolve: () => value };
    return {
      dynamic: true,
      resolve: (arg) => items.map((item) => item.resolve(arg)) as T,
    };
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, entry]) => [key, compileResolver<unknown, A>(entry)] as const);
    if (!entries.some(([, entry]) => entry.dynamic)) return { dynamic: false, resolve: () => value };
    return {
      dynamic: true,
      resolve: (arg) => {
        const result: Record<string, unknown> = {};
        for (const [key, entry] of entries) result[key] = entry.resolve(arg);
        return result as T;
      },
    };
  }
  return { dynamic: false, resolve: () => value };
}

function compileChartEntries<T extends { style?: unknown }, A>(
  entries: T[] | ((arg: A) => T[]) | undefined,
  legacyStyleArg: (arg: A) => A,
): (arg: A) => T[] {
  if (!entries) return () => [];
  if (typeof entries === 'function') {
    return (arg) =>
      (entries(arg) ?? []).map((entry) => ({
        ...entry,
        style: unwrapFn(entry.style, legacyStyleArg(arg)) ?? {},
      }));
  }

  const normalized = entries.map((entry) => ({ ...entry, style: entry.style ?? {} }));
  return compileResolver<typeof normalized, A>(normalized).resolve as (arg: A) => T[];
}

const linkResolvers = new WeakMap<object, (opts: { resolution: Decimal }) => TimescopeChartLink<false>[]>();
type ResolvedChartMark = TimescopeChartMark<false> & { using: Using };
const resolvedMarks = new WeakMap<object, ResolvedChartMark>();
const ZERO = Decimal(0);
const ZERO_COORDINATE = { value: ZERO, role: 'zero' as const };
const TOP_COORDINATE = { value: ZERO, role: 'top' as const };
const BOTTOM_COORDINATE = { value: ZERO, role: 'bottom' as const };

export function resolveChartLinks(
  chart: TimescopeDataSeries['options']['chart'],
  resolution: Decimal,
): TimescopeChartLink<false>[] {
  const links = typeof chart === 'string' ? stylePreset(chart).links : chart?.links;
  if (!links) return [];
  let resolver = linkResolvers.get(links as object);
  if (!resolver) {
    const compiled = compileChartEntries(links, () => null as never) as unknown as (opts: {
      resolution: Decimal;
    }) => TimescopeChartLink<false>[];
    linkResolvers.set(links as object, compiled);
    resolver = compiled;
  }
  return resolver({ resolution });
}

function linkUsing(link: TimescopeChartLink<false>): Using {
  return link.using ?? (link.draw.includes('area') ? ['value@time', '#zero@time'] : 'value@time');
}

function markUsing(mark: TimescopeChartMark<false>): Using {
  if (mark.using) return mark.using;
  if (mark.draw === 'line' || mark.draw === 'bar' || mark.draw === 'section') return ['min', 'max'];
  if (mark.draw === 'region') return ['#bottom@_minTime', '#top@_maxTime'];
  return 'value@time';
}

function resolveChartMark(mark: TimescopeChartMark<false>): ResolvedChartMark {
  if (mark.using) return mark as ResolvedChartMark;
  const existing = resolvedMarks.get(mark);
  if (existing) return existing;
  const resolved = { ...mark, using: markUsing(mark) } as ResolvedChartMark;
  resolvedMarks.set(mark, resolved);
  return resolved;
}

function isChartEntryConfigured(value: unknown) {
  return typeof value === 'function' || (Array.isArray(value) && value.length > 0);
}

function createRowProjector(origin: Decimal, resolution: Decimal, fields: ReadonlySet<string>) {
  const project = (time: Decimal): LinkGeometryCoordinate => {
    const value = time.sub(origin).div(resolution);
    return { value, number: value.number() };
  };
  return (row: TimescopeDataRow) => {
    const times: Record<string, LinkGeometryCoordinate> = {};
    for (const name of fields) {
      if (name !== '_minTime' && name !== '_maxTime' && name in row.times) times[name] = project(row.times[name]);
    }
    return {
      min: fields.has('_minTime') ? project(row.range[0]) : undefined,
      max: fields.has('_maxTime') ? project(row.range[1]) : undefined,
      times,
    };
  };
}

function projectedNumber(value: LinkGeometryCoordinate | null | undefined) {
  if (!value) return NaN;
  return isDecimal(value) ? value.number() : 'number' in value ? value.number : value.value.number();
}

function projectedYValue(value: LinkGeometryCoordinate | null | undefined): number | LinkGeometryRole {
  if (value && !isDecimal(value) && 'role' in value) return value.role;
  return projectedNumber(value);
}

function collectFields(entries: readonly { using: Using }[]) {
  const values = new Set<string>();
  const times = new Set<string>();
  for (const entry of entries) {
    for (const [value, time] of parseUsing(entry.using)) {
      if (!value.startsWith('#')) values.add(value);
      if (!time.startsWith('_')) times.add(time);
    }
  }
  return { values, times };
}

function collectExtent(inputs: readonly { row: TimescopeDataRow; using: Using }[]) {
  let min: Decimal | undefined;
  let max: Decimal | undefined;
  let positiveMin: Decimal | undefined;
  let positiveMax: Decimal | undefined;
  for (const { row, using } of inputs) {
    for (const [name] of parseUsing(using)) {
      if (name.startsWith('#')) continue;
      const value = row.values[name];
      if (!value) continue;
      if (!min || value.lt(min)) min = value;
      if (!max || value.gt(max)) max = value;
      if (value.isPositive()) {
        if (!positiveMin || value.lt(positiveMin)) positiveMin = value;
        if (!positiveMax || value.gt(positiveMax)) positiveMax = value;
      }
    }
  }
  return {
    extent: min && max ? ([min, max] as TimescopeRange<Decimal>) : null,
    positiveExtent: positiveMin && positiveMax ? ([positiveMin, positiveMax] as TimescopeRange<Decimal>) : null,
  };
}

function rowIntersectsRange(row: TimescopeDataRow, [start, end]: TimescopeRange<Decimal>) {
  if (row.range[0].eq(row.range[1])) return start.le(row.range[0]) && row.range[0].lt(end);
  return start.lt(row.range[1]) && row.range[0].lt(end);
}

export class TimescopeSeriesChart<O extends TimescopeSeriesDataLoaderOptions> extends TimescopeSeriesDataLoader<
  TimescopeSeriesChartData,
  O
> {
  static isEnabled(series: TimescopeDataSeries) {
    const chart = series.options.chart;
    if (typeof chart === 'string') return true;
    if (!chart) return false;
    return isChartEntryConfigured(chart.marks) || isChartEntryConfigured(chart.links);
  }

  #resolveMarks;
  #view: TimescopeView<TimescopeDataRow>;
  #releaseView: () => void;
  #targetWaiters = new Set<AbortController>();

  constructor(options: O) {
    super(options);

    const style =
      typeof options.series.options.chart === 'string'
        ? stylePreset(options.series.options.chart)
        : (options.series.options.chart ?? {});

    this.#resolveMarks = compileChartEntries(style.marks, (arg) => arg);
    if (!options.viewContext) throw new Error('Chart requires a view context');
    const request = {
      strategy: options.series.immediate ? 'candidate-with-current' : 'settled-only',
      dataResolution: options.series.options.data?.resolution,
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
    xOrigin: Decimal = range[0],
  ) {
    const resolvedLinks = resolveChartLinks(series.options.chart, resolution);
    const visibleStart = range[0].sub(xOrigin).div(resolution);
    const visibleEnd = range[1].sub(xOrigin).div(resolution);
    const links = visibleStart.lt(visibleEnd) ? resolvedLinks : [];
    const rows = this.#view.query(range, { includeOutbound: links.length ? 2 : 0 });
    const marks: ResolvedChartMark[][] = [];
    const markRows: TimescopeDataRow[] = [];
    const markProjectedIndices: number[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!rowIntersectsRange(row, range)) continue;
      const rowMarks = (
        this.#resolveMarks({
          times: row.times,
          values: row.values,
          data: row.data,
          resolution,
        }) as TimescopeChartMark<false>[]
      ).map(resolveChartMark);
      if (!rowMarks.length) continue;
      marks.push(rowMarks);
      markRows.push(row);
      markProjectedIndices.push(index);
    }
    const flatMarks = marks.flat();
    const projectionFields = collectFields([...links.map((link) => ({ using: linkUsing(link) })), ...flatMarks]);
    if (marks.length) {
      projectionFields.times.add('_minTime');
      projectionFields.times.add('_maxTime');
    }
    const extentInputs = links.flatMap((link) => rows.map((row) => ({ row, using: linkUsing(link) })));
    for (let index = 0; index < markRows.length; index++) {
      for (const mark of marks[index]) extentInputs.push({ row: markRows[index], using: mark.using });
    }
    const { extent, positiveExtent } = collectExtent(extentInputs);
    series.domain.reportExtent(series, extent, positiveExtent);
    const { projection, wire: projectionWire } = series.domain.createProjection();
    const projectRow = createRowProjector(xOrigin, resolution, projectionFields.times);
    const projectedXRows = links.length || marks.length ? rows.map(projectRow) : [];
    const projectedY = Object.create(null) as Record<string, (LinkGeometryCoordinate | null | undefined)[]>;
    for (let index = 0; index < rows.length; index++) {
      const values = rows[index].values;
      for (const key of projectionFields.values) {
        if (!(key in values)) continue;
        const column = (projectedY[key] ??= new Array(rows.length));
        const projected = projection.project(values[key]);
        column[index] = projected && { value: projected, number: projected.number() };
      }
    }
    const source: LinkGeometrySource = {
      length: rows.length,
      x: (index, key) => {
        const projected = projectedXRows[index];
        if (key === '_minTime') return projected?.min;
        if (key === '_maxTime') return projected?.max;
        return projected?.times[key];
      },
      y: (index, key) => {
        if (key === '#zero') return ZERO_COORDINATE;
        if (key === '#top') return TOP_COORDINATE;
        if (key === '#bottom') return BOTTOM_COORDINATE;
        return projectedY[key]?.[index];
      },
    };
    const compiledLinks = links.flatMap((link) => {
      const commands = compileLinkGeometry({
        source,
        kind: link.draw as LinkGeometryKind,
        using: linkUsing(link),
        target: {
          xRange: [visibleStart, visibleEnd],
        },
      });
      return commands.length ? [{ commands, draw: link.draw, style: link.style ?? {} }] : [];
    });
    const meta = {
      resolution,
      time: xOrigin,
      color: this.options.series.color ?? '',

      projection: projectionWire,
      linkProjection: projectionWire,
    };

    const projectedMarks: TimescopeProjectedChartMark[][] = [];
    for (let index = 0; index < markRows.length; index++) {
      const projectedIndex = markProjectedIndices[index];
      projectedMarks.push(
        marks[index].map(({ using, ...mark }) => {
          const [[y1, x1], [y2, x2]] = parseUsing(using);
          return {
            ...mark,
            point: {
              x1: projectedNumber(source.x(projectedIndex, x1)),
              y1: projectedYValue(source.y(projectedIndex, y1)),
              x2: projectedNumber(source.x(projectedIndex, x2)),
              y2: projectedYValue(source.y(projectedIndex, y2)),
            },
          } as TimescopeProjectedChartMark;
        }),
      );
    }

    return {
      data: { marks: projectedMarks, links: compiledLinks },
      meta,
    };
  }
}
