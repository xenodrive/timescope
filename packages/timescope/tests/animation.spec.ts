import { afterEach, describe, expect, it, vi } from 'vitest';

describe('TimescopeAnimation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each([
    { tangent: undefined, expected: 0.875 },
    { tangent: -3, expected: 0.125 },
  ])('evaluates out as a cubic with tangent $tangent', async ({ tangent, expected }) => {
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);

    const { TimescopeAnimation } = await import('#src/core/animation');
    const update = vi.fn();
    new TimescopeAnimation().start({
      origin: () => 0,
      target: () => 1,
      animation: 'out',
      duration: 100,
      tangent,
      update,
    });

    now.mockReturnValue(50);
    frame?.(50);
    expect(update).toHaveBeenCalledWith(expected, expected);
  });
});
