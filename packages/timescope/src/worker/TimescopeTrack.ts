import type { TimescopeYAxisData, TimescopeYProjectionWire } from '#src/bridge/protocol';
import { TimescopeAnimatedValue } from '#src/core/animation';
import { TimescopeObservable } from '#src/core/event';
import { asProjectionData, compareYProjection } from '#src/worker/yProjection';
import type { TimescopeRenderingContext } from './types';

type ProjectionState = {
  projection: TimescopeYProjectionWire;
  axis?: TimescopeYAxisData['data'];
  scale: TimescopeAnimatedValue;
  offset: TimescopeAnimatedValue;
  fade: TimescopeAnimatedValue;
};

export type TimescopeTrackOptions = {
  id: string;
  oy: number;
  height?: number;
  symmetric?: boolean;
  labelHeight?: number;
  seriesKeys: string[];
};

function layoutExtent(projection: TimescopeYProjectionWire): [number, number] | null {
  switch (projection.mode) {
    case 'zero-inclusive':
      return projection.extent;
    case 'floating-positive':
      return [0, 1];
    case 'floating-negative':
      return [-1, 0];
    case 'constant':
      return projection.floating < 0 ? [-1, 0] : [0, 1];
    case 'zero-only':
      return [0, 0];
    case 'empty':
      return null;
  }
}

export class TimescopeTrack extends TimescopeObservable {
  id: string;
  height: number;
  symmetric: boolean;
  oy = 0;
  paddingY = [15, 15];
  labelHeight = 0;
  seriesKeys: string[];

  #states = new Map<string, ProjectionState>();
  #zero = new TimescopeAnimatedValue();

  constructor(opts: TimescopeTrackOptions) {
    super();
    this.id = opts.id;
    this.oy = opts.oy ?? 0;
    this.height = opts.height ?? 0;
    this.symmetric = opts.symmetric ?? false;
    this.labelHeight = opts.labelHeight ?? 0;
    const p = Math.max(0, Math.min(this.height - 36, 18));
    this.paddingY = [p, p];
    this.seriesKeys = opts.seriesKeys;
    this.#zero.on('change', () => this.changed());
  }

  get chartHeight() {
    return this.height - this.paddingY[0] - this.paddingY[1] - this.labelHeight;
  }

  get y0() {
    return this.#zero.value ?? this.top + this.chartHeight / 2;
  }

  get bottom() {
    return this.top + this.chartHeight;
  }

  get top() {
    return this.paddingY[0];
  }

  get animating() {
    return (
      this.#zero.animating ||
      [...this.#states.values()].some(
        (state) => state.scale.animating || state.offset.animating || state.fade.animating,
      )
    );
  }

  get axes() {
    return [...this.#states.values()].flatMap((state) => (state.axis ? [state.axis] : []));
  }

  #createState(projection: TimescopeYProjectionWire): ProjectionState {
    const state = {
      projection,
      scale: new TimescopeAnimatedValue(),
      offset: new TimescopeAnimatedValue(),
      fade: new TimescopeAnimatedValue(),
    };
    state.scale.on('change', () => this.changed());
    state.offset.on('change', () => this.changed());
    state.fade.on('change', () => this.changed());
    return state;
  }

  #targetAffine(projection: TimescopeYProjectionWire, min: number, max: number, zero: number) {
    const H = this.chartHeight;
    switch (projection.mode) {
      case 'zero-inclusive': {
        const span = max - min;
        return { scale: -H / span, offset: this.bottom + (H * min) / span, floating: 0 };
      }
      case 'floating-positive':
      case 'constant': {
        if (projection.mode === 'constant' && projection.floating < 0) {
          const gap = Math.min(projection.gap, Math.max(0, this.bottom - zero - 1));
          return { scale: zero + gap - this.bottom, offset: zero + gap, floating: -gap };
        }
        const gap = Math.min(projection.gap, Math.max(0, zero - this.top - 1));
        const nearZero = zero - gap;
        const floating = { scale: this.top - nearZero, offset: nearZero, floating: gap };
        const zeroCoordinate = projection.numericZero;
        if (
          projection.autoscale &&
          zeroCoordinate != null &&
          Number.isFinite(zeroCoordinate) &&
          zeroCoordinate * floating.scale + floating.offset <= zero
        ) {
          const scale = (this.top - zero) / (1 - zeroCoordinate);
          return { scale, offset: zero - scale * zeroCoordinate, floating: 0 };
        }
        return floating;
      }
      case 'floating-negative': {
        const gap = Math.min(projection.gap, Math.max(0, this.bottom - zero - 1));
        const nearZero = zero + gap;
        const floating = { scale: nearZero - this.bottom, offset: nearZero, floating: -gap };
        const zeroCoordinate = projection.numericZero;
        if (
          projection.autoscale &&
          zeroCoordinate != null &&
          Number.isFinite(zeroCoordinate) &&
          zeroCoordinate * floating.scale + floating.offset >= zero
        ) {
          const scale = (this.bottom - zero) / (-1 - zeroCoordinate);
          return { scale, offset: zero - scale * zeroCoordinate, floating: 0 };
        }
        return floating;
      }
      case 'zero-only':
      case 'empty':
        return { scale: 0, offset: zero, floating: 0 };
    }
  }

  adjustScale(
    timescope: TimescopeRenderingContext,
    rebases: Map<string, { scale: number; offset: number } | null> = new Map(),
  ) {
    const seriesPrefixes = this.seriesKeys.map((seriesKey) => `series:${seriesKey}:`);
    const yAxisPrefix = `tracks:${this.id}:domains:`;
    const entries = Object.entries(timescope.dataCaches).flatMap(([key, cache]) => {
      if (!key.startsWith(yAxisPrefix) && !seriesPrefixes.some((prefix) => key.startsWith(prefix))) return [];
      const data = asProjectionData(cache.data);
      return data ? [{ key, data, cacheRevision: cache.revision }] : [];
    });

    const activeByDomain = new Map<string, { projection: TimescopeYProjectionWire; cacheRevision: number }>();
    const axesByDomain = new Map<string, TimescopeYAxisData['data']>();
    for (const { key, data, cacheRevision } of entries) {
      const projection = data.meta.projection;
      if (key.startsWith(yAxisPrefix) && 'ticks' in data.data) axesByDomain.set(projection.domainId, data.data);
      const active = activeByDomain.get(projection.domainId);
      const current = active?.projection;
      const comparison = current ? compareYProjection(projection, current) : 1;
      if (comparison > 0 || (comparison === 0 && cacheRevision > active!.cacheRevision)) {
        activeByDomain.set(projection.domainId, { projection, cacheRevision });
      }
    }

    for (const [domainId, state] of this.#states) {
      const projection = activeByDomain.get(domainId)?.projection;
      if (projection && compareYProjection(state.projection, projection) > 0) {
        activeByDomain.set(domainId, {
          projection: state.projection,
          cacheRevision: Number.POSITIVE_INFINITY,
        });
      }
    }

    let min = 0;
    let max = 0;
    let hasExtent = false;
    for (const { projection } of activeByDomain.values()) {
      const extent = layoutExtent(projection);
      if (!extent) continue;
      min = Math.min(min, extent[0]);
      max = Math.max(max, extent[1]);
      hasExtent = true;
    }
    if (!hasExtent || min === max) [min, max] = [-1, 1];
    if (this.symmetric) {
      const amplitude = Math.max(Math.abs(min), Math.abs(max), 1e-12);
      min = -amplitude;
      max = amplitude;
    }

    const animateUpdates = [...activeByDomain.values()].some(
      ({ projection }) => projection.autoscale && projection.animation,
    );
    const updateAnimation = animateUpdates
      ? { animation: 'linear' as const, duration: 200 }
      : { animation: false as const, duration: 0 };
    const targetZero = this.bottom - this.chartHeight * ((0 - min) / (max - min));
    if (hasExtent) this.#zero.setValue(targetZero, updateAnimation);

    const activeDomains = new Set<string>();
    for (const { projection } of activeByDomain.values()) {
      const domainId = projection.domainId;
      activeDomains.add(domainId);

      const existing = this.#states.get(domainId);
      const reset = rebases.has(domainId) && !rebases.get(domainId);
      const state = !reset && existing ? existing : this.#createState(projection);
      const target = this.#targetAffine(projection, min, max, targetZero);
      const targetFade = target.floating;
      const rebase = rebases.get(domainId);
      const stateAnimation = reset ? { animation: false as const, duration: 0 } : updateAnimation;
      if (rebase && state.scale.value != null && state.offset.value != null) {
        const startScale = state.scale.value / rebase.scale;
        const startOffset = state.offset.value - (state.scale.value * rebase.offset) / rebase.scale;
        state.scale.tween(startScale, target.scale, updateAnimation);
        state.offset.tween(startOffset, target.offset, updateAnimation);
      } else {
        state.scale.setValue(target.scale, stateAnimation);
        state.offset.setValue(target.offset, stateAnimation);
      }
      state.fade.setValue(targetFade, stateAnimation);

      state.projection = projection;
      state.axis = axesByDomain.get(domainId);
      this.#states.set(domainId, state);
    }

    for (const domainId of this.#states.keys()) {
      if (!activeDomains.has(domainId)) this.#states.delete(domainId);
    }
    this.changed();
  }

  yForDomain(domainId: string, value: number | null | undefined) {
    if (value == null || !Number.isFinite(value)) return NaN;
    const state = this.#states.get(domainId);
    if (!state || state.scale.value == null || state.offset.value == null) return NaN;
    return value * state.scale.value + state.offset.value;
  }

  projectionForDomain(domainId: string) {
    return this.#states.get(domainId)?.projection;
  }

  affineForDomain(domainId: string) {
    const state = this.#states.get(domainId);
    if (!state || state.scale.value == null || state.offset.value == null) return;
    return { scale: state.scale.value, offset: state.offset.value };
  }

  fadeForDomain(domainId: string) {
    return this.#states.get(domainId)?.fade.value ?? 0;
  }
}
