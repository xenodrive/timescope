import { TimescopeState } from '#src/core/TimescopeState';
import { describe, expect, it, vi } from 'vitest';

describe('TimescopeState targets', () => {
  it('resolves a time target without changing the committable', () => {
    const state = new TimescopeState({ time: 0 });
    const changing = vi.fn();
    state.time.on('valuechanging', changing);

    const target = state.resolveTimeTarget(10, { animation: 'linear', duration: 200 });

    expect(target?.value?.number()).toBe(10);
    expect(state.time.current!.number()).toBe(0);
    expect(state.time.candidate!.number()).toBe(0);
    expect(state.time.animating).toBe(false);
    expect(changing).not.toHaveBeenCalled();

    state.setTime(target!.value, target!.animation);
    expect(state.time.animating).toBe(true);
  });

  it('resolves a zoom target independently of later changes', () => {
    const state = new TimescopeState({ zoom: 0 });
    const target = state.resolveZoomTarget(10, false);
    state.setZoom(20, false);

    state.setZoom(target!.value, target!.animation);
    expect(state.zoom.current!.number()).toBe(10);
    expect(state.zoom.committing!.number()).toBe(10);
  });

  it('rejects invalid targets without changing state', () => {
    const state = new TimescopeState({ time: 0, zoom: 0 });

    expect(state.resolveTimeTarget(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(state.resolveZoomTarget(Number.NaN)).toBeUndefined();
    expect(state.time.current!.number()).toBe(0);
    expect(state.zoom.current!.number()).toBe(0);
  });
});
