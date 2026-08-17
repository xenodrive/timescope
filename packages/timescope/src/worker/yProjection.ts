import type {
  TimescopeSeriesChartData,
  TimescopeSeriesTooltipData,
  TimescopeYAxisData,
  TimescopeYProjectionWire,
} from '#src/bridge/protocol';

export type TimescopeProjectionData = TimescopeSeriesChartData | TimescopeSeriesTooltipData | TimescopeYAxisData;

export function asProjectionData(data: unknown): TimescopeProjectionData | undefined {
  if (!data || typeof data !== 'object' || !('meta' in data) || !('data' in data)) return;
  const projection = (data as TimescopeProjectionData).meta?.projection;
  return projection ? (data as TimescopeProjectionData) : undefined;
}

export function compareYProjection(a: TimescopeYProjectionWire, b: TimescopeYProjectionWire) {
  if (a.domainEpoch !== b.domainEpoch) return a.domainEpoch - b.domainEpoch;
  return a.revision - b.revision;
}

export function createYProjectionRebase(from: TimescopeYProjectionWire, to: TimescopeYProjectionWire) {
  if (from.domainId !== to.domainId || from.domainEpoch !== to.domainEpoch) return null;
  if (!from.toAnchor || !to.toAnchor || to.toAnchor.scale === 0) return null;
  const scale = from.toAnchor.scale / to.toAnchor.scale;
  const offset = (from.toAnchor.offset - to.toAnchor.offset) / to.toAnchor.scale;
  if (!Number.isFinite(scale) || !Number.isFinite(offset)) return null;
  return { scale, offset };
}

export function rebaseYProjectionData(data: TimescopeProjectionData, target: TimescopeYProjectionWire) {
  const source = data.meta.projection;
  if (source.domainEpoch === target.domainEpoch && source.revision === target.revision) return false;

  const rebase = createYProjectionRebase(source, target);
  const collapsed =
    target.mode === 'constant' ? (target.floating < 0 ? -0.5 : 0.5) : target.mode === 'zero-only' ? 0 : null;
  if ('y' in data.data) {
    const values = data.data.y as Float64Array;
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) continue;
      values[i] = rebase ? values[i] * rebase.scale + rebase.offset : (collapsed ?? NaN);
    }
  }

  if ('marks' in data.data) {
    for (const marks of data.data.marks) {
      for (const mark of marks) {
        for (const key of ['y1', 'y2'] as const) {
          const value = mark.point[key];
          if (typeof value !== 'number' || !Number.isFinite(value)) continue;
          mark.point[key] = rebase ? value * rebase.scale + rebase.offset : (collapsed ?? NaN);
        }
      }
    }
  }

  if ('ticks' in data.data) {
    data.data.ticks = rebase
      ? data.data.ticks.map((tick) => ({
          ...tick,
          value: tick.value * rebase.scale + rebase.offset,
        }))
      : [];
  }
  data.meta.projection = target;
  return true;
}
