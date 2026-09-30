import { Decimal, precisionForSpan } from '#src/core/decimal';
import type { TimescopeRange } from '#src/core/range';
import { TimescopeLayerDataBase } from '#src/main/layers/TimescopeLayerData';
import type { TimescopeDomain } from '#src/main/TimescopeDomain';
import type { TimescopeYAxisData } from '#src/renderer/types';

export type TimescopeYAxisDataOptions = {
  domain: TimescopeDomain;
};

export class TimescopeYAxis extends TimescopeLayerDataBase<TimescopeYAxisData, TimescopeYAxisDataOptions> {
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
        // Quarter-interval logarithmic ticks are successive geometric means.
        // Retain the endpoints exactly and enough digits to distinguish a narrow range.
        const precision = precisionForSpan(upper, upper.sub(lower));
        const middle = lower.mul(upper).sqrt(precision);
        values.push(lower, lower.mul(middle).sqrt(precision), middle, middle.mul(upper).sqrt(precision), upper);
      } else {
        const step = upper.sub(lower).divExact(4);
        if (lower.le(0) && upper.ge(0)) {
          // At most four steps fit on either side of zero; compare exact values
          // rather than rounding a division to find the first visible tick.
          for (let i = -4; i <= 4; i++) {
            const value = step.mul(i);
            if (value.ge(lower) && value.le(upper)) values.push(value);
          }
        } else {
          for (let i = 0; i <= 4; i++) values.push(lower.add(step.mul(i)));
        }
      }
    }

    const ticks = values
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
        font: configured?.font,
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
