import { Decimal } from '#src/core/decimal';
import { Timescope } from '#src/main/Timescope';
import { TimescopeSelectionLayer } from '#src/renderer/layers/TimescopeSelectionLayer';
import { describe, expect, it } from 'vitest';

describe('Timescope configuration contract', () => {
  it('consumes initial state without retaining it as configurable options', () => {
    const scope = new Timescope({
      time: 10,
      zoom: 2,
      fonts: [],
      wheelSensitivity: 100,
      selection: { color: 'red', range: [1, 3] },
      tracks: { default: {} },
    });
    expect(scope.options).toEqual({ style: undefined, selection: { color: 'red' }, tracks: { default: {} } });
    expect(scope.selectionRange?.map(String)).toEqual(['1', '3']);
    scope.setSelectionRange([4, 6]);
    expect(scope.options.selection).toEqual({ color: 'red' });
    scope.setOptions({ tracks: { default: {} } });
    expect(scope.selectionRange?.map(String)).toEqual(['4', '6']);
    scope.updateOptions({ selection: false });
    expect(scope.selectionRange).toBeNull();
    scope.updateOptions({ selection: { color: 'blue' } });
    scope.setSelectionRange([7, 8]);
    expect(scope.selectionRange?.map(String)).toEqual(['7', '8']);
    scope.dispose();
  });

  it('rejects empty tracks and invalid references before mutating options', () => {
    expect(() => new Timescope({ tracks: {} })).toThrow('at least one track');
    const scope = new Timescope({
      sources: { a: [{ time: 0, value: 1 }] },
      series: { a: { data: { source: 'a' } } },
    });
    expect(() => scope.setOptions({ tracks: {} })).toThrow('at least one track');
    expect(() => scope.updateOptions({ tracks: { default: null } })).toThrow('at least one track');
    expect(() => scope.updateOptions({ sources: { a: null } })).toThrow('Unknown data source');
    expect(scope.options.sources).toHaveProperty('a');
    expect(scope.options.tracks).toBeUndefined();
    scope.updateOptions({ series: { a: null }, sources: { a: null } });
    expect(scope.options.sources).toEqual({});
    expect(scope.options.series).toEqual({});
    scope.dispose();
  });

  it('replaces configuration shapes during partial updates', () => {
    const scope = new Timescope({ domains: { a: { range: [0, 1] } } });
    scope.updateOptions({ domains: { a: { range: { expand: true } } } });
    expect(scope.options.domains?.a.range).toEqual({ expand: true });
    scope.dispose();
  });

  it('keeps the rendered selection independent of configuration replacements', async () => {
    const layer = new TimescopeSelectionLayer();
    const ranges: unknown[] = [];
    layer.on('renderer:event', (event) => ranges.push((event.value as { range: unknown }).range));
    const range: [Decimal, Decimal] = [Decimal(1)!, Decimal(3)!];
    layer.updateOptions({ selectionRange: range });
    layer.updateOptions({ selectionReset: true, selection: { color: 'red' } });
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(ranges.at(-1)).toEqual(range);
    layer.updateOptions({ selection: false });
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(ranges.at(-1)).toBeNull();
    layer.dispose();
  });
});
