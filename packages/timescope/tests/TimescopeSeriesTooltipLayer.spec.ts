import { tooltipXPlacement } from '#src/renderer/layers/TimescopeSeriesTooltipLayer';
import { describe, expect, it } from 'vitest';

describe('series tooltip placement', () => {
  it('sticks offscreen tooltips to either edge and preserves onscreen placement', () => {
    expect(tooltipXPlacement(-1, 10, 110, -1)).toEqual({ x: 10, sideX: 1, sticky: true });
    expect(tooltipXPlacement(120, 10, 110, 1)).toEqual({ x: 110, sideX: -1, sticky: true });
    expect(tooltipXPlacement(60, 10, 110, -1)).toEqual({ x: 60, sideX: -1, sticky: false });
  });
});
