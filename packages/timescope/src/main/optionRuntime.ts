import { mergeOptions } from '#src/core/options';
import type { TimescopeOptions, TimescopeSeriesInput, TimescopeUpdateOptions } from '#src/main/options';

const dictionaries = ['sources', 'series', 'tracks', 'domains'] as const;

export function mergeTimescopeOptions(dst: TimescopeOptions, src: TimescopeUpdateOptions) {
  for (const key of dictionaries) {
    const entries = src[key];
    if (entries === undefined) continue;
    const current = { ...(dst[key] ?? {}) } as Record<string, unknown>;
    for (const [name, value] of Object.entries(entries)) {
      if (value === null) delete current[name];
      else if (value === undefined) continue;
      else if (key === 'sources') current[name] = value;
      else if (current[name] && typeof current[name] === 'object' && !Array.isArray(current[name]))
        current[name] = mergeOptions({ ...current[name] }, value as object);
      else current[name] = value;
    }
    (dst as Record<string, unknown>)[key] = current;
  }
  const rest = { ...src } as Record<string, unknown>;
  for (const key of dictionaries) delete rest[key];
  mergeOptions(dst, rest);
  return dst;
}

export function validateTimescopeOptions(opts: TimescopeOptions<any, any, string>) {
  const tracks = opts.tracks ?? { default: {} };
  if (!Object.keys(tracks).length) throw new Error('Timescope requires at least one track');
  for (const [name, series] of Object.entries((opts.series ?? {}) as Record<string, TimescopeSeriesInput>)) {
    if (!Object.hasOwn(opts.sources ?? {}, series.data.source))
      throw new Error(`Unknown data source for series ${name}: ${series.data.source}`);
    if (series.track !== undefined && !Object.hasOwn(tracks, series.track))
      throw new Error(`Unknown track for series ${name}: ${series.track}`);
    if (typeof series.data.domain === 'string' && !Object.hasOwn(opts.domains ?? {}, series.data.domain))
      throw new Error(`Unknown domain for series ${name}: ${series.data.domain}`);
  }
}
