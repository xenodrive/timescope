import type { TimescopeDataChunkWire, TimescopeSeriesProviderMeta } from '#src/bridge/protocol';
import type { TimescopeDataChunkDesc } from '#src/core/chunk';
import type { TimescopeDataSeries, TimescopeDataSeriesChunkResult } from '#src/main/TimescopeDataSeries';
import { TimescopeDataProvider } from '#src/main/providers/TimescopeDataProvider';

export type TimescopeSeriesProviderOptions = {
  series: TimescopeDataSeries;
  zoomLevels: number[] | undefined;
};

export class TimescopeSeriesProvider<
  T,
  M extends TimescopeSeriesProviderMeta,
  O extends TimescopeSeriesProviderOptions,
> extends TimescopeDataProvider<T[], M, O> {
  constructor(options: O) {
    super(options);
  }

  async loadChunk(chunk: TimescopeDataChunkDesc): Promise<TimescopeDataChunkWire<T[]>> {
    const raw = await this.options.series.loadChunk(chunk);
    return await this.transform(raw);
  }

  async transform(chunk: TimescopeDataSeriesChunkResult): Promise<TimescopeDataChunkWire<T[]>> {
    return chunk as TimescopeDataChunkWire<T[]>;
  }
}
