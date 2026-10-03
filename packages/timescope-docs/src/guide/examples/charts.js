import { Timescope } from 'timescope';

export function basicChart(target) {
  // #region basic-chart
  const samples = [12, 24, 18, 42, 35, 48, 20, 32, 26].map((value, index) => ({
    time: index * 7.5,
    value,
  }));

  const timescope = new Timescope({
    target,
    fit: [0, 60],
    sources: { samples },
    series: {
      signal: {
        data: { source: 'samples', color: '#0d9488' },
        chart: 'lines',
      },
    },
  });
  // #endregion basic-chart
  return timescope;
}

export function multipleSeries(target) {
  // #region multiple-series
  const timescope = new Timescope({
    target,
    fit: [0, 30],
    sources: {
      indoor: [
        { time: 0, value: 18 },
        { time: 15, value: 21 },
        { time: 30, value: 19 },
      ],
      outdoor: [
        { time: 0, value: 12 },
        { time: 15, value: 16 },
        { time: 30, value: 14 },
      ],
    },
    domains: { temperature: { axis: 'left', unit: '°C' } },
    series: {
      indoor: {
        data: { source: 'indoor', domain: 'temperature', color: '#0d9488' },
        chart: 'linespoints',
      },
      outdoor: {
        data: { source: 'outdoor', domain: 'temperature', color: '#d97706' },
        chart: 'linespoints',
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });
  // #endregion multiple-series
  return timescope;
}

export function multipleTracks(target) {
  // #region multiple-tracks
  const timescope = new Timescope({
    target,
    fit: [0, 30],
    sources: {
      temperature: [
        { time: 0, value: 18 },
        { time: 15, value: 21 },
        { time: 30, value: 19 },
      ],
      latency: [
        { time: 0, value: 8 },
        { time: 15, value: 42 },
        { time: 30, value: 12 },
      ],
    },
    series: {
      temperature: {
        track: 'temperature',
        data: { source: 'temperature', domain: { axis: 'left', unit: '°C' } },
        chart: 'lines',
      },
      latency: {
        track: 'latency',
        data: { source: 'latency', domain: { axis: 'left', unit: 'ms' } },
        chart: 'curves',
      },
    },
    tracks: {
      temperature: { timeAxis: false },
      latency: { timeAxis: { relative: true } },
    },
  });
  // #endregion multiple-tracks
  return timescope;
}

export function logScale(target) {
  // #region log-scale
  const timescope = new Timescope({
    target,
    fit: [0, 60],
    sources: {
      response: Array.from({ length: 16 }, (_, index) => {
        const time = index * 4;
        const decay = 10 ** (4 - time / 12);
        const bump = 1 + 6 * Math.exp(-(((time - 44) / 2.8) ** 2));
        return { time, value: decay * bump };
      }),
    },
    series: {
      response: {
        data: { source: 'response', domain: { scale: 'log', axis: 'left', unit: 'ms' } },
        chart: 'curvespoints',
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });
  // #endregion log-scale
  return timescope;
}

export function decimation(target) {
  // #region decimation
  const sampleRate = 4096;
  const duration = 64;
  const timescope = new Timescope({
    target,
    fit: [0, duration],
    sources: {
      recording: {
        type: 'point-aggregate',
        data: Array.from({ length: sampleRate * duration }, (_, index) => {
          const time = index / sampleRate;
          const wave = Math.sin((2 * Math.PI * time) / 16);
          const detail = ((index % 17) - 8) / 40;
          return { time, value: wave + detail };
        }),
      },
    },
    series: {
      signal: { data: { source: 'recording' }, chart: 'linespoints' },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });
  // #endregion decimation
  return timescope;
}

export function marksAndLinks(target) {
  // #region marks-and-links
  const measurements = Array.from({ length: 121 }, (_, index) => {
    const time = index / 2;
    const value = 30 + 12 * Math.sin(time / 5);
    return { time, values: { value, min: value - 5, max: value + 5 } };
  });

  const timescope = new Timescope({
    target,
    fit: [0, 60],
    sources: { measurements },
    series: {
      signal: {
        data: { source: 'measurements', color: '#0d9488' },
        chart: {
          links: [{ draw: 'area', using: ['min', 'max'] }, { draw: 'line' }],
          marks: [{ draw: 'circle', style: { size: 4, fillColor: '#0d9488' } }],
        },
      },
    },
    tracks: { default: { timeAxis: { relative: true } } },
  });
  // #endregion marks-and-links
  return timescope;
}
