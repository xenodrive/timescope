import { initialState, newDomain, newLayer, newSeries, newTrack } from './options.js';
import { examples } from '../examples/catalog.ts';

// Sample-specific settings belong here, not in the editor's defaults.
function chartState(height = 200) {
  const state = initialState();
  state.viewMode = 'fit';
  state.height = `${height}px`;
  state.tracks = [{ ...newTrack('main'), relative: true }];
  state.domains = [newDomain('amplitude')];
  state.series = [{ ...newSeries('signal', 'main', 'amplitude'), color: '#0d9488', layers: [newLayer('link')] }];
  return state;
}

function responseState(scale) {
  const state = chartState();
  state.domains = [{ ...newDomain('response'), scale, axis: 'left', unit: 'ms' }];
  const series = newSeries('response', 'main', 'response');
  series.source = 'response';
  series.color = '#0d9488';
  series.layers = [{ ...newLayer('link'), draw: 'curve' }];
  state.series = [series];
  return state;
}

const definitions = [
  {
    id: 'basic-chart',
    name: 'Basic Chart',
    description: 'A sparse line chart with nine samples.',
    create() {
      const state = chartState();
      state.series[0].source = 'basicChart';
      state.tracks[0].relative = false;
      return state;
    },
  },
  {
    id: 'curve',
    name: 'Curve',
    description: 'Sparse response samples joined by a smooth curve with an automatic linear scale.',
    create() {
      return responseState('linear');
    },
  },
  {
    id: 'ribbon-points',
    name: 'Marks & Links',
    description: 'A min/max ribbon with a line and individual sample markers.',
    create() {
      const state = chartState();
      state.series[0].layers = [
        { ...newLayer('link'), draw: 'area', from: 'min', to: 'max' },
        newLayer('link'),
        { ...newLayer('mark'), size: 4, color: state.series[0].color },
      ];
      return state;
    },
  },
  {
    id: 'log-scale',
    name: 'Log scale',
    description: 'The same curve on a logarithmic scale reveals the small bump near 44 seconds.',
    create() {
      return responseState('log');
    },
  },
  {
    id: 'multiple-tracks',
    name: 'Multiple tracks',
    description: 'A smooth signal and spiking latency on separate tracks with independent linear scales.',
    create() {
      const state = chartState(400);
      state.tracks[0].timeAxis = false;
      state.tracks.push({ ...newTrack('latency'), relative: true });
      state.domains[0].axis = 'left';
      state.domains.push({ ...newDomain('latency'), lower: 0, axis: 'left', unit: 'ms' });
      const series = newSeries('latency', 'latency', 'latency');
      series.name = 'Latency';
      series.source = 'signal';
      series.color = '#d97706';
      series.layers[0] = { ...newLayer('link'), draw: 'curve', color: series.color };
      state.series.push(series);
      return state;
    },
  },
  {
    id: 'multiple-charts',
    name: 'Multiple charts',
    description:
      'Wide-ranging signals share an automatic left scale; a changing activity curve uses an independent linear right axis. Zoom and pan to explore quiet, impact, and positive/negative sections.',
    create() {
      const state = chartState(320);
      state.range = [0, 500];
      state.domains = [
        { ...newDomain('sharedAmplitude'), axis: 'left' },
        { ...newDomain('activity'), axis: 'right' },
      ];
      state.series = ['value', 'comparison'].map((field, index) => {
        const series = newSeries(field, 'main', 'sharedAmplitude');
        series.name = index === 0 ? 'Signal · shared scale' : 'Comparison · shared scale';
        series.source = 'autoRange';
        series.field = field;
        series.color = index === 0 ? '#0284c7' : '#d97706';
        series.layers[0] = { ...newLayer('link'), from: field, color: series.color };
        return series;
      });
      const activity = newSeries('activity', 'main', 'activity');
      activity.name = 'Activity · independent scale';
      activity.source = 'autoRange';
      activity.field = 'activity';
      activity.color = '#8b5cf6';
      activity.layers = [
        {
          ...newLayer('link'),
          draw: 'curve-area',
          from: 'activity',
          to: '#zero',
          color: activity.color,
          opacity: 0.12,
          width: 0,
        },
        { ...newLayer('link'), draw: 'curve', from: 'activity', color: activity.color },
      ];
      state.series.push(activity);
      return state;
    },
  },
  {
    id: 'intervals',
    name: 'Intervals',
    description: 'Pipeline intervals with labels anchored at their midpoint.',
    create() {
      const state = chartState(300);
      state.range = [-0.5, 10.5];
      state.domains = [{ ...newDomain('lanes'), lower: 0, upper: 5, shrink: false, axis: 'none' }];
      const series = newSeries('pipeline', 'main', 'lanes');
      series.source = 'tasks';
      series.field = 'lane@middle';
      series.tooltip = false;
      series.layers = [
        {
          ...newLayer('mark'),
          draw: 'bar',
          from: 'lane@start',
          to: 'lane@end',
          size: 30,
          radius: 7,
          opacity: 1,
          width: 0,
          colorField: 'color',
        },
        { ...newLayer('mark'), draw: 'text', from: 'lane@middle', size: 13, textField: 'name', color: '#0f172a' },
      ];
      state.series = [series];
      return state;
    },
  },
  {
    id: 'annotations',
    name: 'Annotations',
    description: 'A signal and its event labels on a shared latency domain.',
    create() {
      const state = chartState(340);
      state.range = [0, 65];
      state.loadMdiFont = true;
      state.domains = [{ ...newDomain('latency'), lower: 0, upper: 110, shrink: false, axis: 'left', unit: 'ms' }];
      const signal = newSeries('signal', 'main', 'latency');
      signal.source = 'signal';
      signal.layers = [{ ...newLayer('link'), color: '#64748b' }];
      const events = newSeries('annotations', 'main', 'latency');
      events.source = 'events';
      events.tooltip = false;
      events.layers = [
        {
          ...newLayer('mark'),
          draw: 'section',
          from: 'value',
          to: 'labelHeight',
          width: 1,
          size: 1,
          colorField: 'color',
          stroke: 'dashed',
        },
        {
          ...newLayer('mark'),
          draw: 'path',
          path: 'M0 -1 C-.55 -1 -1 -.55 -1 0 C-1 .6 0 1.1 0 1.1 S1 .6 1 0 C1 -.55 .55 -1 0 -1 Z',
          size: 8,
          colorField: 'color',
        },
        {
          ...newLayer('mark'),
          draw: 'icon',
          from: 'labelHeight',
          size: 18,
          textField: 'symbol',
          font: { family: 'Material Design Icons' },
          colorField: 'color',
        },
        {
          ...newLayer('mark'),
          draw: 'text',
          from: 'labelHeight',
          size: 12,
          textField: 'label',
          colorField: 'color',
          offsetX: 14,
          textAlign: 'left',
        },
      ];
      state.series = [signal, events];
      return state;
    },
  },
];

// Keep the dropdown in the same order as its gallery cards.
export const presets = examples
  .filter((example) => example.preset)
  .map((example) => definitions.find((preset) => preset.id === example.preset));
