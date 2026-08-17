import type { TimescopeYAxisData } from '#src/bridge/protocol';
import { Decimal } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { TimescopeDataLoaderBase } from '#src/main/TimescopeDataLoader';
import type { TimescopeDomain } from '#src/main/TimescopeDomain';

export type TimescopeYAxisDataOptions = {
  domain: TimescopeDomain;
};

export class TimescopeYAxis extends TimescopeDataLoaderBase<TimescopeYAxisData, TimescopeYAxisDataOptions> {
  static isEnabled(domain: TimescopeDomain) {
    return Boolean(domain.axis);
  }

  constructor(options: TimescopeYAxisDataOptions) {
    super(options);
    this.onDispose(options.domain.on('change', () => this.changed()));
  }

  async loadData(range: TimescopeRange<Decimal>, resolution: Decimal): Promise<TimescopeYAxisData> {
    const domain = this.options.domain;
    const { projection, wire } = domain.createProjection();
    const options = domain.axis;
    const configured = typeof options === 'object' ? options : undefined;
    const values: Decimal[] = [];

    if (domain.dataRange && projection.mode !== 'empty') {
      const [lower, upper] = domain.dataRange;
      if (lower.eq(upper)) {
        values.push(lower);
      } else if (domain.scale === 'log') {
        const origin = lower.log(10);
        const span = upper.log(10).sub(origin);
        for (let i = 0; i <= 4; i++) values.push(Decimal(10).pow(origin.add(span.mul(i / 4))));
      } else {
        const step = upper.sub(lower).div(4);
        for (let i = 0; i <= 4; i++) values.push(lower.add(step.mul(i)));
        if (lower.lt(0) && upper.gt(0)) values.push(Decimal(0));
      }
    }

    const ticks = [...new Map(values.map((value) => [value.toString(), value])).values()]
      .toSorted((a, b) => a.cmp(b))
      .map((value) => ({
        value: projection.normalize(value),
        text: value.toFixed(domain.digits),
        zero: value.isZero(),
      }))
      .filter((tick) => Number.isFinite(tick.value));

    return {
      data: {
        id: domain.uid,
        side: options === 'right' || configured?.side === 'right' ? 'right' : 'left',
        label: configured?.label ?? domain.name,
        unit: domain.unit || undefined,
        color: configured?.color,
        ticks,
      },
      meta: {
        time: range[0],
        resolution,
        projection: wire,
      },
    };
  }
}
