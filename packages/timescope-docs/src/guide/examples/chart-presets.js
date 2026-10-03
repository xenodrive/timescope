import { Timescope } from 'timescope';

export const initialPreset = 'bars:filled';
export const chartPresets = [
  'bars',
  'bars:filled',
  'lines',
  'lines:filled',
  'curves',
  'curves:filled',
  'points',
  'linespoints',
  'linespoints:filled',
  'curvespoints',
  'curvespoints:filled',
  'steps-start',
  'steps-start:filled',
  'steps',
  'steps:filled',
  'steps-end',
  'steps-end:filled',
  'stepspoints-start',
  'stepspoints-start:filled',
  'stepspoints',
  'stepspoints:filled',
  'stepspoints-end',
  'stepspoints-end:filled',
  'impulses',
  'impulsespoints',
];

export function createChartPresets(target) {
  const samples = [12, 24, 18, 42, 35, 48, 20, 32, 26].map((value, index) => ({
    time: index * 7.5,
    value,
  }));
  const timescope = new Timescope({
    target,
    fit: { range: [0, 60], padding: 12 },
    sources: { samples },
    series: {
      signal: {
        data: { source: 'samples', color: '#0d9488', domain: { range: [0, 50], shrink: false } },
        chart: initialPreset,
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });

  // #region select-preset
  function selectPreset(chart) {
    timescope.updateOptions({
      series: { signal: { chart } },
    });
  }
  // #endregion select-preset

  return { timescope, selectPreset };
}
