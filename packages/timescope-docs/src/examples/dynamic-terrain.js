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

export function mountTerrain(target) {
  // #region example
  // Each loader returns its own data. Timescope owns caching and the selection
  // of chunks for the current view; no request-history source is needed.
  const chunks = createDataSource({
    loader: ({ range: [start, end], resolution }) => [
      {
        times: { start, middle: start.add(end).div(2), end },
        values: { level: 0.5 },
        data: { label: `${resolution.number().toPrecision(2)} s/px` },
      },
    ],
  });

  // #region terrain-loader
  const delayCheckbox = document.querySelector('#example-simulate-loading-delay');
  const source = createDataSource({
    loader: async ({ range: [start, end], resolution }) => {
      if (delayCheckbox.checked) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
      }
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
    },
  });

  // #endregion terrain-loader

  const options = {
    target,
    time: 512,
    zoom: -1,
    zoomRange: [-6, 12],
    sources: { terrain: source, chunks },
    series: {
      terrain: {
        data: { source: 'terrain', domain: { axis: 'left' }, color: '#0d9488' },
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
  // #endregion example
  return () => timescope.dispose();
}
