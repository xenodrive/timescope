import type { TimescopeDataChunkWire, TimescopeLoadMetaOptions } from '#src/bridge/protocol';
import type { TimescopeDataChunkDesc } from '#src/core/chunk';

export interface TimescopeDataProviderLike<T = any, O = any> {
  new (options: O): this;
  loadChunk(chunk: TimescopeDataChunkDesc): Promise<TimescopeDataChunkWire<T>>;
  loadMeta(opts: TimescopeLoadMetaOptions): Promise<object> | undefined;
}

export abstract class TimescopeDataProvider<T = any, M = any, O = any> {
  options: O;

  constructor(options: O) {
    this.options = options;
  }

  abstract loadChunk(chunk: TimescopeDataChunkDesc): Promise<TimescopeDataChunkWire<T>>;

  loadMeta(_opts: TimescopeLoadMetaOptions): Promise<M> | undefined {
    return undefined;
  }
}
