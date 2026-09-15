import { Timescope } from '#src/main/Timescope';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/renderer/worker.ts?worker&inline', () => ({ default: class {} }));

afterEach(() => vi.useRealTimers());

describe('Timescope lifetime', () => {
  it('stops time and zoom animation events after disposal', async () => {
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
      timescope.dispose();
      const calls = changing.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(changing).toHaveBeenCalledTimes(calls);
      timescope.dispose();
    } finally {
      timescope.dispose();
    }
  });
});
