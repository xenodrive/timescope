import { Timescope } from 'timescope';
import { vibrationSamples } from './vibration-data.js';

export function mountDecimation(target) {
  // #region example
  const sampleRate = 4096;
  const timescope = new Timescope({
    target,
    time: 6,
    zoom: 6,
    sources: { recording: { type: 'point-aggregate', data: vibrationSamples() } },
    series: {
      vibration: {
        tooltip: { round: 3 },
        data: {
          source: 'recording',
          domain: { range: [-1.2, 1.8], axis: true },
          instantaneous: { resolution: 1 / sampleRate },
        },
        // #region envelope-chart
        chart: {
          links: [
            { draw: 'area', using: ['value#min', 'value#max'], style: { fillColor: '#8b5cf6', fillOpacity: 0.4 } },
            { draw: 'line', using: 'value#avg', style: { lineColor: '#6d28d9', lineWidth: 1.5 } },
          ],
          marks: ({ resolution }) =>
            resolution.le(1 / 4096)
              ? [{ draw: 'circle', using: 'value#avg', style: { size: 5, lineColor: '#6d28d9', fillColor: '#ede9fe' } }]
              : [],
        },
        // #endregion envelope-chart
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });
  timescope.fitTo([0, 12], { animation: false });
  // #endregion example
  return () => timescope.dispose();
}
