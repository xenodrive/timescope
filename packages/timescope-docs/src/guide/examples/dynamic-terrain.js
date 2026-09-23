import { createDataSource, Timescope } from 'timescope';

function hash(index, octave) {
  let value = Math.imul(index | 0, 374761393) ^ Math.imul(octave + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (((value ^ (value >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

function terrain(time, resolution) {
  let height = 0;
  for (let octave = 0; octave < 18; octave++) {
    const wavelength = 2048 / 2 ** octave;
    // Remove fine detail before it aliases into a different shape.
    const weight = Math.max(0, Math.min(1, wavelength / resolution / 4 - 1));
    if (!weight) break;
    const position = time / wavelength;
    const index = Math.floor(position);
    const fraction = position - index;
    const blend = fraction * fraction * (3 - 2 * fraction);
    height += (hash(index, octave) * (1 - blend) + hash(index + 1, octave) * blend) * 90 * 0.57 ** octave * weight;
  }
  return height;
}

export function createTerrainDemo(target, { latency = 450, time = 512, zoom = -1, onProgress = () => {} } = {}) {
  let alive = true;
  let pending = 0;
  let sequence = 0;
  const timers = new Map();
  let publishFrame = 0;

  function publish() {
    // Batch UI notifications only. Completing a load never invalidates a source.
    if (publishFrame || !alive) return;
    publishFrame = requestAnimationFrame(() => {
      publishFrame = 0;
      if (!alive) return;
      onProgress({ pending, total: sequence });
    });
  }

  function delayed(loader) {
    return async (request) => {
      if (!alive) return [];
      sequence++;
      pending++;
      publish();
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, latency);
        timers.set(timer, resolve);
      });
      pending--;
      if (!alive) return [];
      publish();
      return loader(request);
    };
  }

  // Each loader returns its own data. Timescope owns caching and the selection
  // of chunks for the current view; no request-history source is needed.
  const chunks = createDataSource({
    loader: delayed(({ range: [start, end], resolution }) => [
      {
        times: { start, middle: start.add(end).div(2), end },
        values: { level: 0.5 },
        data: { label: `${resolution.number().toPrecision(2)} s/px` },
      },
    ]),
  });

  const source = createDataSource({
    loader: delayed(({ range: [start, end], resolution }) => {
      const rows = [];
      // Align samples globally; include one neighbor on either side.
      for (
        let t = start.div(resolution).floor().sub(1).mul(resolution);
        t.le(end.add(resolution));
        t = t.add(resolution)
      ) {
        rows.push({ time: t, value: terrain(t.number(), resolution.number()) });
      }
      return rows;
    }),
  });

  const options = {
    target,
    style: { height: '350px' },
    time,
    zoom,
    zoomRange: [-6, 12],
    sources: { terrain: source, chunks },
    series: {
      terrain: {
        // Fixed vertical scale: loading new chunks never rescales the landscape.
        data: { source: 'terrain', domain: { range: [-220, 220], axis: 'left' }, color: '#0d9488' },
        chart: 'lines:filled',
        tooltip: false,
        track: 'terrain',
      },
      chunks: {
        data: { source: 'chunks', domain: { range: [0, 1] } },
        chart: {
          marks: [
            {
              draw: 'bar',
              using: ['level@start', 'level@end'],
              style: {
                size: 22,
                radius: 3,
                lineWidth: 1,
                lineColor: '#ffffff',
                fillColor: '#5eead4',
              },
            },
            {
              draw: 'text',
              using: 'level@middle',
              style: { size: 10, text: ({ data }) => data.label, textColor: '#134e4a' },
            },
          ],
        },
        tooltip: false,
        track: 'chunks',
      },
    },
    tracks: {
      terrain: { height: 280, timeAxis: false },
      chunks: { height: 70, timeAxis: { relative: true } },
    },
  };
  const timescope = new Timescope(options);
  return {
    timescope,
    setLatency(value) {
      latency = value;
    },
    reload() {
      source.invalidate();
      chunks.invalidate();
    },
    cleanup() {
      alive = false;
      cancelAnimationFrame(publishFrame);
      for (const [timer, resolve] of timers) {
        clearTimeout(timer);
        resolve();
      }
      timers.clear();
      timescope.dispose();
      source.dispose?.();
      chunks.dispose?.();
    },
  };
}
