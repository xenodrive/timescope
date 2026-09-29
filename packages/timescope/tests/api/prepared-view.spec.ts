import { Timescope } from '#src/index.node';
import { Canvas } from 'skia-canvas';
import { describe, expect, it, vi } from 'vitest';

describe('prepared views', () => {
  it('does not intercept ordinary setters until fetch begins', async () => {
    const timescope = new Timescope({ time: 5 });
    try {
      const view = timescope.prepareView();
      expect(view.setTime(12, false)).toBe(true);
      timescope.setTime(7, false);
      expect(timescope.time?.number()).toBe(7);
      expect(view.signal.aborted).toBe(false);
      view.abort();
      await expect(view.fetch()).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      timescope.dispose();
    }
  });

  it('waits for an unsized mount before fetching its target view', async () => {
    const timescope = new Timescope({ target: new Canvas(0, 0), fonts: [], time: 0 });
    try {
      const view = timescope.prepareView();
      view.setTime(4, false);
      const fetched = view.fetch();
      expect(timescope.time?.number()).toBe(0);
      expect(await timescope.resize(80, 30)).toBe(true);
      await fetched;
      expect(timescope.time?.number()).toBe(4);
    } finally {
      timescope.dispose();
    }
  });

  it('waits for target data before activating the prepared time', async () => {
    let release!: () => void;
    const loading = new Promise<void>((resolve) => (release = resolve));
    const loader = vi.fn(async () => {
      await loading;
      return [
        { time: 0, value: 1 },
        { time: 20, value: 2 },
      ];
    });
    const timescope = new Timescope({
      target: new Canvas(80, 30),
      fonts: [],
      time: 0,
      sources: { measure: { loader, chunked: false } },
      series: { measure: { data: { source: 'measure' }, chart: { marks: [] } } },
      tracks: { default: { timeAxis: false } },
    });
    try {
      const view = timescope.prepareView();
      view.setTime(10, false);
      await timescope.nextFrame();
      expect(timescope.time?.number()).toBe(0);
      const fetched = view.fetch();
      await vi.waitFor(() => expect(loader).toHaveBeenCalled());
      expect(timescope.time?.number()).toBe(0);
      release();
      await fetched;
      expect(timescope.time?.number()).toBe(10);
      await timescope.nextFrame();
    } finally {
      release();
      timescope.dispose();
    }
  });

  it('aborts an active fetch when the current view changes', async () => {
    let release!: () => void;
    const loading = new Promise<void>((resolve) => (release = resolve));
    const loader = vi.fn(async () => {
      await loading;
      return [{ time: 0, value: 1 }];
    });
    const timescope = new Timescope({
      target: new Canvas(80, 30),
      fonts: [],
      time: 0,
      sources: { measure: { loader, chunked: false } },
      series: { measure: { data: { source: 'measure' }, chart: { marks: [] } } },
      tracks: { default: { timeAxis: false } },
    });
    try {
      const view = timescope.prepareView();
      view.setTime(10, false);
      const fetched = view.fetch();
      await vi.waitFor(() => expect(loader).toHaveBeenCalled());
      timescope.setTime(15, false);
      await expect(fetched).rejects.toMatchObject({ name: 'AbortError' });
      release();
      expect(timescope.time?.number()).toBe(15);
    } finally {
      release();
      timescope.dispose();
    }
  });
});
