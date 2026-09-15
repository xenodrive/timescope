import { Decimal } from '#src/core/decimal';
import type { TimescopeViewState } from '#src/main/TimescopeView';

export function viewState(
  range: [Decimal, Decimal],
  resolution: Decimal,
  options: Partial<Pick<TimescopeViewState, 'editing' | 'animating' | 'phase'>> & {
    currentRange?: [Decimal, Decimal];
    currentResolution?: Decimal;
  } = {},
): TimescopeViewState {
  const center = range[0].add(range[1]).div(2);
  const currentRange = options.currentRange ?? range;
  const halfSize = range[1].sub(range[0]).div(resolution).number() / 2;
  return {
    current: {
      center: currentRange[0].add(currentRange[1]).div(2),
      resolution: options.currentResolution ?? resolution,
    },
    candidate: { center, resolution },
    cursor: { center },
    axisSize: [halfSize, halfSize],
    editing: options.editing ?? false,
    animating: options.animating ?? false,
    phase: options.phase ?? 'changed',
  };
}
