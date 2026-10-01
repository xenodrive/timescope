import { Decimal, isDecimal, type NumberLike } from '#src/core/decimal';
import { defaultOptions } from '#src/core/defaults';
import { TimescopeObservable } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import type { TimescopeFontStyle } from '#src/main/fontStyle';
import type { TimescopeRound } from '#src/main/round';
import type { TimescopeDataSeries } from '#src/main/TimescopeDataSeries';
import {
  computeYProjectionToAnchor,
  createYProjection,
  type YProjection,
  type YProjectionBasis,
} from '#src/main/yProjection';
import type { TimescopeYProjectionWire } from '#src/renderer/types';

export type TimescopeYAxisOptions = {
  side?: 'left' | 'right';
  round?: TimescopeRound;
  label?: string;
  color?: string;
  font?: TimescopeFontStyle;
};
export type TimescopeDomainOptions = {
  scale?: 'linear' | 'log' | 'linear-symmetric';
  animation?: boolean;
  range?:
    | NumberLike
    | TimescopeRange<NumberLike | undefined>
    | { expand?: boolean; shrink?: boolean; default?: NumberLike | TimescopeRange<NumberLike | undefined> };
  expand?: boolean;
  shrink?: boolean;
  unit?: string;
  floatingGap?: number;
  axis?: boolean | 'left' | 'right' | TimescopeYAxisOptions;
};

type DomainRangeInput =
  | NumberLike
  | TimescopeRange<NumberLike | undefined>
  | { expand?: boolean; shrink?: boolean; default?: NumberLike | TimescopeRange<NumberLike | undefined> };

type ParsedDomainRange = {
  expand: boolean;
  shrink: boolean;
  default: TimescopeRange<Decimal | undefined>;
};

type SeriesExtent = {
  extent: TimescopeRange<Decimal> | null;
  positiveExtent: TimescopeRange<Decimal> | null;
};

function sameExtent(a: TimescopeRange<Decimal> | null, b: TimescopeRange<Decimal> | null) {
  return a === null || b === null ? a === b : a[0].eq(b[0]) && a[1].eq(b[1]);
}

function usableAnchorTransform(transform: TimescopeYProjectionWire['toAnchor'], basis: YProjectionBasis) {
  if (!transform) return false;
  if (basis.span.isZero()) return true;
  return (
    transform.scale !== 0 &&
    Number.isFinite(1 / transform.scale) &&
    transform.offset + transform.scale !== transform.offset
  );
}

function isNumberLike(v: unknown): v is NumberLike {
  if (isDecimal(v)) return true;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return true;
  return false;
}

function parseDomainRange(range: DomainRangeInput | undefined, expand?: boolean, shrink?: boolean): ParsedDomainRange {
  const rangeExpand = typeof expand === 'boolean' ? expand : undefined;
  const rangeShrink = typeof shrink === 'boolean' ? shrink : undefined;

  if (range == null) {
    return {
      expand: rangeExpand ?? defaultOptions.domainRange.expand,
      shrink: rangeShrink ?? defaultOptions.domainRange.shrink,
      default: [...defaultOptions.domainRange.default],
    };
  }

  if (Array.isArray(range)) {
    return {
      expand: rangeExpand ?? defaultOptions.domainRange.expand,
      shrink: rangeShrink ?? defaultOptions.domainRange.shrink,
      default: range.map(Decimal) as TimescopeRange<Decimal | undefined>,
    };
  }

  if (typeof range === 'number' || isNumberLike(range)) {
    return {
      expand: rangeExpand ?? defaultOptions.domainRange.expand,
      shrink: rangeShrink ?? defaultOptions.domainRange.shrink,
      default: [Decimal(0), Decimal(range)] as TimescopeRange<Decimal | undefined>,
    };
  }

  const rangeObj = range as {
    expand?: boolean;
    shrink?: boolean;
    default?: NumberLike | TimescopeRange<NumberLike | undefined>;
  };
  const expandValue = rangeExpand ?? rangeObj.expand ?? defaultOptions.domainRange.expand;
  const shrinkValue = rangeShrink ?? rangeObj.shrink ?? defaultOptions.domainRange.shrink;
  if (rangeObj.default != null && !Array.isArray(rangeObj.default)) {
    return {
      expand: expandValue,
      shrink: shrinkValue,
      default: [Decimal(0), Decimal(rangeObj.default)] as TimescopeRange<Decimal | undefined>,
    };
  }

  return {
    expand: expandValue,
    shrink: shrinkValue,
    default: (rangeObj.default ?? defaultOptions.domainRange.default).map(Decimal) as TimescopeRange<
      Decimal | undefined
    >,
  };
}

export class TimescopeDomain extends TimescopeObservable {
  #options: TimescopeDomainOptions;
  #name?: string;
  #range: ParsedDomainRange;
  #series: TimescopeDataSeries[] = [];
  #seriesExtents = new Map<TimescopeDataSeries, SeriesExtent>();
  #extent: TimescopeRange<Decimal> | null = null;
  #projectionAnchor: YProjectionBasis | null = null;
  #projectionEpoch = 0;
  #projectionRevision = 0;
  #projectionFamily: YProjectionBasis['family'];
  #projectionSnapshot!: { projection: YProjection; wire: TimescopeYProjectionWire };

  constructor(options: TimescopeDomainOptions = {}, name?: string) {
    super();
    this.#options = options;
    this.#name = name;
    this.#range = parseDomainRange(options.range as DomainRangeInput | undefined, options.expand, options.shrink);
    this.#projectionFamily = options.scale === 'log' ? 'log' : 'linear';
    this.#updateProjection();
  }

  updateOptions(options: TimescopeDomainOptions, name = this.#name) {
    this.#options = options;
    this.#name = name;
    this.#range = parseDomainRange(options.range as DomainRangeInput | undefined, options.expand, options.shrink);
    this.recompute(true);
  }

  addSeries(series: TimescopeDataSeries) {
    if (this.#series.includes(series)) return;
    this.#series.push(series);
    this.recompute();
  }

  removeSeries(series: TimescopeDataSeries) {
    const index = this.#series.indexOf(series);
    if (index < 0) return;
    this.#series.splice(index, 1);
    this.#seriesExtents.delete(series);
    this.recompute();
  }

  reportExtent(
    series: TimescopeDataSeries,
    extent: TimescopeRange<Decimal> | null,
    positiveExtent: TimescopeRange<Decimal> | null,
  ) {
    if (!this.#series.includes(series)) return;
    const previous = this.#seriesExtents.get(series);
    if (previous && sameExtent(previous.extent, extent) && sameExtent(previous.positiveExtent, positiveExtent)) return;
    this.#seriesExtents.set(series, { extent, positiveExtent });
    this.recompute();
  }

  recompute(forceProjection = false) {
    const { expand, shrink, default: defaultRange } = this.#range;
    const expandLower = expand || defaultRange[0] === undefined;
    const expandUpper = expand || defaultRange[1] === undefined;
    let dataMin: Decimal | undefined;
    let dataMax: Decimal | undefined;

    if (expandLower || expandUpper) {
      for (const series of this.#series) {
        const report = this.#seriesExtents.get(series);
        const extent = this.#options.scale === 'log' ? report?.positiveExtent : report?.extent;
        if (!extent) continue;
        if (!dataMin || extent[0].lt(dataMin)) dataMin = extent[0];
        if (!dataMax || extent[1].gt(dataMax)) dataMax = extent[1];
      }
    }

    const previousExtent =
      this.#extent && (this.#options.scale !== 'log' || this.#extent.every((value) => value.isPositive()))
        ? this.#extent
        : null;
    let lower = defaultRange[0];
    let upper = defaultRange[1];
    if (expandLower && dataMin) lower = !lower || dataMin.lt(lower) ? dataMin : lower;
    if (expandUpper && dataMax) upper = !upper || dataMax.gt(upper) ? dataMax : upper;

    if (!shrink && previousExtent) {
      if (expandLower) lower = !lower || previousExtent[0].lt(lower) ? previousExtent[0] : lower;
      if (expandUpper) upper = !upper || previousExtent[1].gt(upper) ? previousExtent[1] : upper;
    }

    let next: TimescopeRange<Decimal> | null = null;
    if (lower !== undefined && upper !== undefined) {
      if (lower.gt(upper)) {
        if (!expandLower) upper = lower;
        else if (!expandUpper) lower = upper;
        else [lower, upper] = [upper, lower];
      }
      next = [lower, upper];
    }

    const extentChanged =
      this.#extent === null || next === null
        ? this.#extent !== next
        : !this.#extent.every((value, index) => value.eq(next[index]));
    if (!extentChanged && !forceProjection) return;
    this.#extent = next;
    this.#updateProjection();
    this.changed();
  }

  get dataRange() {
    return this.#extent;
  }

  get name() {
    return this.#name;
  }

  get axis() {
    return this.#options.axis ?? defaultOptions.domain.axis;
  }

  get scale() {
    return this.#options.scale ?? defaultOptions.domain.scale;
  }

  get autoscale() {
    return this.#range.expand || this.#range.default.some((value) => value === undefined);
  }

  get animation() {
    return this.#options.animation ?? defaultOptions.domain.animation;
  }

  get unit() {
    return this.#options.unit ?? defaultOptions.domain.unit;
  }

  get floatingGap() {
    return this.#options.floatingGap ?? defaultOptions.domain.floatingGap;
  }

  #updateProjection() {
    const projection = createYProjection(
      this.dataRange,
      this.scale,
      this.floatingGap,
      this.#projectionSnapshot?.projection.basis,
    );
    const basis = projection.basis;
    const family = projection.scale === 'log' ? 'log' : 'linear';

    if (family !== this.#projectionFamily) {
      this.#projectionFamily = family;
      this.#projectionAnchor = null;
      this.#projectionEpoch++;
    }

    if (basis && !this.#projectionAnchor) {
      this.#projectionAnchor = {
        family: basis.family,
        origin: basis.origin,
        span: basis.span.isZero() ? Decimal(1) : basis.span,
      };
      if (this.#projectionEpoch === 0) this.#projectionEpoch = 1;
    }

    let toAnchor = this.#projectionAnchor ? computeYProjectionToAnchor(projection, this.#projectionAnchor) : null;
    if (basis && !usableAnchorTransform(toAnchor, basis)) {
      this.#projectionAnchor = {
        family: basis.family,
        origin: basis.origin,
        span: basis.span.isZero() ? Decimal(1) : basis.span,
      };
      this.#projectionEpoch++;
      toAnchor = computeYProjectionToAnchor(projection, this.#projectionAnchor);
    }

    this.#projectionSnapshot = {
      projection,
      wire: {
        domainId: this.uid,
        domainEpoch: this.#projectionEpoch,
        revision: ++this.#projectionRevision,
        autoscale: this.autoscale,
        animation: this.animation,
        mode: projection.mode,
        extent: projection.extent,
        gap: projection.gap,
        floating: projection.floating,
        numericZero: projection.numericZero,
        toAnchor,
      },
    };
  }

  createProjection() {
    return this.#projectionSnapshot;
  }
}
