import { DEFAULT_CHUNK_SIZE } from '#src/core/chunk';
import { Decimal, pow10 } from '#src/core/decimal';
import { TimescopeObservable, type TimescopeEvent } from '#src/core/event';
import type { TimeAxisTick, TimescopeTimeAxisOptions } from '#src/main/timeAxis';
import type { TimescopeDataSourceInvalidation, TimescopeDataSourceQuery } from '#src/main/TimescopeDataSource';

export class TimeAxisLinearTicksDataSource extends TimescopeObservable<
  TimescopeEvent<'invalidate', TimescopeDataSourceInvalidation>
> {
  readonly chunkSize = DEFAULT_CHUNK_SIZE;
  readonly chunkOrigin = Decimal(0);
  constructor(readonly options: TimescopeTimeAxisOptions) {
    super();
  }
  async query({ range, resolution }: TimescopeDataSourceQuery): Promise<TimeAxisTick[]> {
    if (!range[0] || !range[1] || resolution.le(0)) return [];
    const effectiveResolution = resolution.mul(DEFAULT_CHUNK_SIZE);
    let exp = effectiveResolution.order();
    if (effectiveResolution.shift10(-exp).pow(2).ge(10)) exp++;
    const baseStep = pow10(exp);
    const threshold = resolution.mul(20);
    let step = baseStep;
    let divisor = 1n;
    for (const candidate of [10n, 5n, 1n]) {
      const candidateStep = baseStep.divExact(candidate);
      if (!candidateStep.lt(threshold)) {
        step = candidateStep;
        divisor = candidate;
        break;
      }
    }
    if (step.isZero()) return [];
    const digits = Math.max(0, -Number(step.order()));
    const ticks: TimeAxisTick[] = [];
    let index = range[0].divFloor(step);
    for (let guard = 0; guard < 1_000_000; guard++, index = index.add(1)) {
      const time = step.mul(index);
      if (time.ge(range[1])) break;
      if (time.lt(range[0])) continue;
      const major = index.mod(divisor).isZero();
      ticks.push({
        time: { time, _minTime: time, _maxTime: time },
        major,
        tick: true,
        format: major
          ? { time, unit: this.options.timeUnit ?? 's', level: 'relative', digits, stride: undefined }
          : undefined,
      });
    }
    return ticks;
  }
}
