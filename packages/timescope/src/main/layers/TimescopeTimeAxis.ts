import type { Decimal } from '#src/core/decimal';
import { defaultOptions } from '#src/core/defaults';
import { normalizeOptions } from '#src/core/options';
import type { TimescopeRange } from '#src/core/range';
import { formatTick } from '#src/main/layers/timeAxisFormat';
import { TimescopeLayerDataBase } from '#src/main/layers/TimescopeLayerData';
import { TimeAxisCalendarTicksDataSource } from '#src/main/sources/TimeAxisCalendarTicksDataSource';
import { TimeAxisLinearTicksDataSource } from '#src/main/sources/TimeAxisLinearTicksDataSource';
import type { TimeAxisTick, TimescopeTimeAxisOptions, TickLabel } from '#src/main/timeAxis';
import { TimescopeChunkStore } from '#src/main/TimescopeChunkStore';
import { TimescopeView, type TimescopeViewRegistry } from '#src/main/TimescopeView';
import type { TimescopeTimeAxisData } from '#src/renderer/types';
export type {
  CalendarLevel,
  TimeFormatFuncOptions,
  TimeFormatFunc,
  TimeFormatLabelerOptions,
  TimeFormatLabeler,
  TimescopeTimeAxisOptions,
  TickLabel,
} from '#src/main/timeAxis';
export { scaleTimeUnit } from '#src/main/timeAxis';

export type TimescopeTimeAxisDataOptions = {
  timeAxis?: TimescopeTimeAxisOptions | boolean;
  viewContext?: TimescopeViewRegistry;
};
export class TimescopeTimeAxis extends TimescopeLayerDataBase<
  { data: TickLabel[] },
  { timeAxis: TimescopeTimeAxisOptions }
> {
  static isEnabled(options: TimescopeTimeAxisOptions | boolean | undefined) {
    return (options ?? defaultOptions.track.timeAxis) !== false;
  }
  #view: TimescopeView<TimeAxisTick>;
  constructor(opts: TimescopeTimeAxisDataOptions) {
    super({ timeAxis: normalizeOptions(opts.timeAxis, { timeUnit: defaultOptions.timeAxis.timeUnit })! });
    if (!opts.viewContext) throw new Error('Time axis requires a view context');
    const source =
      (this.options.timeAxis.relative ?? defaultOptions.timeAxis.relative)
        ? new TimeAxisLinearTicksDataSource(this.options.timeAxis)
        : new TimeAxisCalendarTicksDataSource(this.options.timeAxis);
    const store = new TimescopeChunkStore<TimeAxisTick>(source);
    this.#view = new TimescopeView(store, opts.viewContext, source, { strategy: 'candidate-with-current' });
    this.onDispose(this.#view.on('change', () => this.changed()));
    this.onDispose(() => {
      this.#view.dispose();
      store.dispose();
    });
  }
  async loadData(range: TimescopeRange<Decimal>, resolution: Decimal): Promise<TimescopeTimeAxisData> {
    return {
      data: this.#view.query(range, { includeOutbound: 8 }).map((tick) => formatTick(tick, this.options.timeAxis)),
      meta: { time: range[0], resolution },
    };
  }
  async waitForTarget() {
    await this.#view.waitForTarget();
  }
  cancelTargetWaiters() {
    this.#view.cancelTargetWaiters();
  }
}
