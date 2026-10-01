import { Timescope } from 'timescope';

export function createStylingDemo(target) {
  // #region example
  const samples = Array.from({ length: 31 }, (_, i) => ({
    time: i * 2,
    values: { temperature: 20 + 8 * Math.sin(i / 4), humidity: 50 + 15 * Math.cos(i / 5) },
  }));
  const timescope = new Timescope({
    target,
    fit: { range: [0, 60], padding: 28 },
    cursor: { color: '#f59e0b', borderColor: '#b45309' },
    selection: { range: [18, 32], color: '#8b5cf633' },
    font: { family: 'sans-serif' },
    sources: { samples },
    series: {
      temperature: {
        tooltip: { round: 2 },
        data: {
          source: 'samples',
          instantaneous: { using: 'temperature' },
          color: '#0d9488',
          domain: { axis: { side: 'left', label: 'Temperature' }, unit: '°C' },
        },
        chart: {
          links: [{ draw: 'curve', using: 'temperature', style: { lineWidth: 2.5 } }],
          marks: [{ draw: 'circle', using: 'temperature', style: { size: 5, lineWidth: 2, fillOpacity: 0.7 } }],
        },
      },
      humidity: {
        tooltip: { round: 2 },
        data: {
          source: 'samples',
          instantaneous: { using: 'humidity' },
          color: '#8b5cf6',
          domain: { axis: { side: 'right', color: '#8b5cf6', label: 'Humidity' }, unit: '%' },
        },
        chart: {
          links: [{ draw: 'curve', using: 'humidity', style: { lineWidth: 2, lineDashArray: [6, 4] } }],
          marks: [{ draw: 'diamond', using: 'humidity', style: { size: 5, fillColor: '#8b5cf680' } }],
        },
      },
    },
    tracks: {
      default: {
        timeAxis: { relative: true, ticks: { color: '#0d948866' }, axis: { color: '#0d9488' } },
      },
    },
  });

  function cleanup() {
    timescope.dispose();
  }
  // #endregion example
  return cleanup;
}
