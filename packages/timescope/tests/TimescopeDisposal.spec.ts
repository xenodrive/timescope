import { Timescope } from '#src/main/Timescope';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/renderer/worker.ts?worker&inline', () => ({ default: class {} }));

afterEach(() => vi.useRealTimers());

describe('Timescope lifetime', () => {
  it('preserves state animations on unmount and cancels both time and zoom on dispose', async () => {
    vi.useFakeTimers();
    const timescope = new Timescope({ time: 0, zoom: 0 });
    const changing = vi.fn();
    timescope.on('timeanimating', changing);
    timescope.on('zoomanimating', changing);
    try {
      timescope.setTime(10, { animation: 'linear', duration: 1000 });
      timescope.setZoom(3, { animation: 'linear', duration: 1000 });
      await vi.advanceTimersByTimeAsync(20);
      expect(changing).toHaveBeenCalled();
      timescope.unmount();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      timescope.dispose();
      expect(vi.getTimerCount()).toBe(0);
      const calls = changing.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(changing).toHaveBeenCalledTimes(calls);
      timescope.dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      timescope.dispose();
    }
  });
});
