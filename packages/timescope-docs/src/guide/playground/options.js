import { datasets } from './datasets.js';

export const measurements = datasets.measurements.data;

export function newTrack(id) {
  return { id, height: 200, timeAxis: true, relative: true, timeZone: 'utc' };
}

export function newDomain(id) {
  return {
    id,
    scale: 'linear',
    lower: '',
    upper: '',
    expand: false,
    shrink: true,
    gap: 24,
    axis: 'left',
    unit: '',
    digits: 2,
  };
}

export function newLayer(kind) {
  return {
    kind,
    draw: kind === 'mark' ? 'circle' : 'line',
    from: 'value',
    to: 'min',
    color: '#0d9488',
    size: 7,
    width: 2,
    opacity: 0.25,
    stroke: 'solid',
    text: 'Sample',
    textField: '',
    colorField: '',
    radius: 0,
    offsetX: 0,
    textAlign: 'center',
  };
}

export function newSeries(id, track, domain) {
  return {
    id,
    track,
    domain,
    source: 'measurements',
    name: id,
    color: '#0d9488',
    field: 'value',
    tooltip: true,
    layers: [newLayer('link')],
  };
}

export function initialState() {
  return {
    range: [0, 60],
    viewMode: 'fit',
    fitPadding: 0,
    time: 30,
    zoom: 4,
    width: '100%',
    height: '',
    background: '#ffffff',
    cursorEnabled: true,
    cursorColor: '#ffffff',
    cursorBorderColor: '#ff0000',
    data: {},
    sources: [],
    tracks: [newTrack('main')],
    domains: [newDomain('amplitude')],
    series: [newSeries('signal', 'main', 'amplitude')],
  };
}

export function buildOptions(state) {
  return {
    target: '#timescope',
    ...(state.viewMode === 'fit'
      ? { fit: state.fitPadding ? { range: state.range, padding: state.fitPadding } : state.range }
      : { time: state.time, zoom: state.zoom }),
    style: {
      width: state.width,
      height: state.height || `${state.tracks.reduce((sum, track) => sum + track.height, 0)}px`,
      background: state.background,
    },
    cursor: state.cursorEnabled ? { color: state.cursorColor, borderColor: state.cursorBorderColor } : false,
    sources: Object.fromEntries(
      [...new Set([...state.series.map((series) => series.source), ...state.sources])].map((name) => [
        name,
        state.data[name] ?? datasets[name]?.data,
      ]),
    ),
    domains: Object.fromEntries(
      state.domains.map((domain) => [
        domain.id,
        {
          scale: domain.scale,
          range: {
            default: [
              domain.lower === '' ? undefined : Number(domain.lower),
              domain.upper === '' ? undefined : Number(domain.upper),
            ],
            expand: domain.expand,
            shrink: domain.shrink,
          },
          floatingGap: domain.gap,
          axis: domain.axis === 'none' ? false : domain.axis,
          ...(domain.unit ? { unit: domain.unit } : {}),
          digits: domain.digits,
        },
      ]),
    ),
    series: Object.fromEntries(
      state.series.map((series) => [
        series.id,
        {
          data: {
            source: series.source,
            name: series.name,
            color: series.color,
            domain: series.domain,
            instantaneous: series.tooltip ? { using: series.field } : false,
          },
          track: series.track,
          chart: {
            marks: series.layers.filter((layer) => layer.kind === 'mark').map(layerOptions),
            links: series.layers.filter((layer) => layer.kind === 'link').map(layerOptions),
          },
          tooltip: series.tooltip,
        },
      ]),
    ),
    tracks: Object.fromEntries(
      state.tracks.map((track) => [
        track.id,
        {
          height: track.height,
          timeAxis: track.timeAxis
            ? { relative: track.relative, ...(!track.relative ? { timeZone: track.timeZone } : {}) }
            : false,
        },
      ]),
    ),
  };
}

function layerOptions(layer) {
  const color = layer.colorField ? dataAccessor(layer.colorField) : layer.color;
  const pair = layer.draw.includes('area') || ['bar', 'section'].includes(layer.draw);
  return {
    draw: layer.draw,
    using: pair ? [layer.from, layer.to] : layer.from,
    style: {
      lineColor: color,
      lineWidth: layer.width,
      ...(layer.stroke !== 'solid' ? { lineDashArray: layer.stroke === 'dashed' ? [7, 5] : [2, 4] } : {}),
      ...(layer.kind === 'mark' ? { size: layer.size } : {}),
      ...(pair || layer.kind === 'mark' ? { fillColor: color, fillOpacity: layer.opacity } : {}),
      ...(layer.draw === 'bar' ? { radius: layer.radius } : {}),
      ...(layer.draw === 'text'
        ? {
            text: layer.textField ? dataAccessor(layer.textField) : layer.text,
            textColor: color,
            offset: [layer.offsetX, 0],
            textAlign: layer.textAlign,
          }
        : {}),
      ...(layer.draw === 'icon'
        ? {
            icon: layer.textField ? dataAccessor(layer.textField) : layer.text,
            iconFontFamily: 'sans-serif',
            iconColor: color,
          }
        : {}),
    },
  };
}

// Serialize JavaScript, preserving undefined bounds instead of turning them into null.
const accessors = {
  color: ({ data }) => data.color,
  name: ({ data }) => data.name,
  label: ({ data }) => data.label,
  symbol: ({ data }) => data.symbol,
};

function dataAccessor(field) {
  return accessors[field];
}

export function javascript(value, depth = 0, references = true, sources = {}) {
  if (references) {
    const source = Object.entries(sources).find(([, rows]) => rows === value);
    if (source) return source[0];
  }
  if (typeof value === 'function') return value.toString();
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== 'object'))
      return `[${value.map((item) => javascript(item, depth, references, sources)).join(', ')}]`;
    return `[\n${value.map((item) => `${indent}  ${javascript(item, depth + 1, references, sources)},`).join('\n')}\n${indent}]`;
  }
  return `{\n${Object.entries(value)
    .map(([key, item]) => {
      if (references && sources[key] === item) return `${indent}  ${key},`;
      const name = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `${indent}  ${name}: ${javascript(item, depth + 1, references, sources)},`;
    })
    .join('\n')}\n${indent}}`;
}

export function rename(state, collection, oldId, newId) {
  state[collection].find((item) => item.id === oldId).id = newId;
  const reference = collection === 'tracks' ? 'track' : collection === 'domains' ? 'domain' : null;
  if (reference) for (const series of state.series) if (series[reference] === oldId) series[reference] = newId;
}

export function remove(state, collection, id, replacement) {
  const reference = collection === 'tracks' ? 'track' : collection === 'domains' ? 'domain' : null;
  if (reference) for (const series of state.series) if (series[reference] === id) series[reference] = replacement;
  state[collection] = state[collection].filter((item) => item.id !== id);
}
