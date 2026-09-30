import { defaultOptions as defaults } from 'timescope';
import { datasets } from './datasets.js';

export const mdiStylesheet = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';

export const measurements = datasets.measurements.data;

export function defaultSize(draw) {
  return defaults.chartSize[draw] ?? defaults.chartSize.mark;
}

export function defaultUsing(kind, draw) {
  let using = [defaults.chartUsing.point];
  if (draw.includes('area')) using = defaults.chartUsing.area;
  else if (kind === 'mark' && ['line', 'bar', 'section'].includes(draw)) using = defaults.chartUsing.range;
  else if (kind === 'mark' && draw === 'region') using = defaults.chartUsing.region;
  return using.map((field) => field.replace(/@time$/, ''));
}

export function newTrack(id) {
  return { id, height: defaults.track.height ?? '', timeAxis: defaults.track.timeAxis, ...defaults.timeAxis };
}

export function newDomain(id) {
  return {
    id,
    scale: defaults.domain.scale,
    lower: '',
    upper: '',
    expand: defaults.domainRange.expand,
    shrink: defaults.domainRange.shrink,
    gap: defaults.domain.floatingGap,
    axis: defaults.domain.axis === false ? 'none' : defaults.domain.axis,
    unit: defaults.domain.unit,
    digits: defaults.domain.digits,
  };
}

export function newLayer(kind) {
  return {
    kind,
    draw: kind === 'mark' ? 'circle' : 'line',
    from: '',
    to: '',
    color: '',
    size: '',
    width: defaults.chartStyle.lineWidth,
    opacity: defaults.chartStyle.fillOpacity,
    stroke: 'solid',
    text: '',
    textField: '',
    path: '',
    colorField: '',
    radius: defaults.chartStyle.radius,
    offsetX: defaults.chartStyle.offset[0],
    textAlign: defaults.chartStyle.textAlign,
  };
}

export function newSeries(id, track, domain = '') {
  return {
    id,
    track,
    domain,
    source: 'measurements',
    name: '',
    color: '',
    field: defaults.series.instantaneous.using,
    tooltip: defaults.series.tooltip,
    layers: [],
  };
}

export function initialState() {
  return {
    range: [0, 60],
    viewMode: 'timeZoom',
    fitPadding: defaults.fit.padding,
    time: defaults.time,
    zoom: defaults.zoom,
    ...defaults.style,
    loadMdiFont: false,
    cursorEnabled: defaults.options.cursor,
    cursorColor: defaults.cursor.color,
    cursorBorderColor: defaults.cursor.borderColor,
    data: {},
    sources: [],
    tracks: [newTrack('default')],
    domains: [],
    series: [],
  };
}

export function buildOptions(state) {
  return {
    target: '#timescope',
    ...(state.loadMdiFont ? { fonts: [mdiStylesheet] } : {}),
    ...(state.viewMode === 'fit'
      ? { fit: state.fitPadding ? { range: state.range, padding: state.fitPadding } : state.range }
      : { time: state.time, zoom: state.zoom }),
    style: {
      width: state.width || defaults.style.width,
      height: state.height || defaults.style.height,
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
            ...(series.name ? { name: series.name } : {}),
            ...(series.color ? { color: series.color } : {}),
            ...(series.domain ? { domain: series.domain } : {}),
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
          ...(track.height === '' ? {} : { height: track.height }),
          timeAxis: track.timeAxis
            ? { relative: track.relative, ...(!track.relative ? { timeZone: track.timeZone } : {}) }
            : false,
        },
      ]),
    ),
  };
}

function layerOptions(layer) {
  const color = layer.colorField ? dataAccessor(layer.colorField) : layer.color || undefined;
  const using = defaultUsing(layer.kind, layer.draw);
  const pair = using.length === 2;
  const text = layer.draw === 'text' || layer.draw === 'icon';
  const filled = layer.draw.includes('area') || (layer.kind === 'mark' && !text && layer.draw !== 'section');
  return {
    draw: layer.draw,
    using: pair ? [layer.from || using[0], layer.to || using[1]] : layer.from || using[0],
    style: {
      ...(!text
        ? {
            ...(color ? { lineColor: color } : {}),
            lineWidth: layer.width,
            ...(layer.stroke !== 'solid' ? { lineDashArray: layer.stroke === 'dashed' ? [7, 5] : [2, 4] } : {}),
          }
        : {}),
      ...(layer.kind === 'mark' ? { size: layer.size === '' ? defaultSize(layer.draw) : layer.size } : {}),
      ...(filled ? { ...(color ? { fillColor: color } : {}), fillOpacity: layer.opacity } : {}),
      ...(layer.draw === 'bar' ? { radius: layer.radius } : {}),
      ...(layer.draw === 'text'
        ? {
            text: layer.textField ? dataAccessor(layer.textField) : layer.text,
            ...(color ? { textColor: color } : {}),
            offset: [layer.offsetX, 0],
            textAlign: layer.textAlign,
          }
        : {}),
      ...(layer.draw === 'icon'
        ? {
            icon: layer.textField ? dataAccessor(layer.textField) : layer.text,
            ...(layer.font ? { font: layer.font } : {}),
            ...(color ? { iconColor: color } : {}),
          }
        : {}),
      ...(layer.draw === 'path' ? { path: layer.path } : {}),
    },
  };
}

function sameValue(value, other) {
  return (
    value === other ||
    (Array.isArray(value) &&
      Array.isArray(other) &&
      value.length === other.length &&
      value.every((item, index) => item === other[index]))
  );
}

function withoutDefaults(value, baseline = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => item !== undefined && !sameValue(item, baseline[key])),
  );
}

function setNonempty(object, key, value) {
  if (Object.keys(value).length) object[key] = value;
  else delete object[key];
}

function compactDomain(domain) {
  const result = withoutDefaults(domain, defaults.domain);
  if (domain.range && !Array.isArray(domain.range) && typeof domain.range === 'object') {
    setNonempty(result, 'range', withoutDefaults(domain.range, defaults.domainRange));
  }
  return result;
}

function compactLayer(layer, kind, color) {
  const result = { ...layer };
  const using = defaultUsing(kind, layer.draw);
  const selected = typeof layer.using === 'string' ? [layer.using] : layer.using;
  if (
    Array.isArray(selected) &&
    selected.every((field) => typeof field === 'string') &&
    sameValue(
      selected.map((field) => field.replace(/@time$/, '')),
      using,
    )
  )
    delete result.using;
  if (layer.style) {
    const style = withoutDefaults(layer.style, { ...defaults.chartStyle, size: defaultSize(layer.draw) });
    // Stroke and text inherit the series color unchanged. Fill does not: omitting
    // fillColor adds 25% alpha (and blends marks with the background).
    for (const key of ['lineColor', 'textColor', 'iconColor']) {
      if (color && style[key] === color) delete style[key];
    }
    setNonempty(result, 'style', style);
  }
  return result;
}

function compactTrack(track) {
  const result = withoutDefaults(track, defaults.track);
  if (track.timeAxis && typeof track.timeAxis === 'object')
    setNonempty(result, 'timeAxis', withoutDefaults(track.timeAxis, defaults.timeAxis));
  return result;
}

function compactSeries(series, firstTrack) {
  const result = withoutDefaults(series, { tooltip: defaults.series.tooltip, track: firstTrack });
  result.data = { ...series.data };
  if (series.data.domain && typeof series.data.domain === 'object')
    result.data.domain = compactDomain(series.data.domain);
  if (series.data.instantaneous && typeof series.data.instantaneous === 'object')
    setNonempty(
      result.data,
      'instantaneous',
      withoutDefaults(series.data.instantaneous, defaults.series.instantaneous),
    );
  if (series.chart && typeof series.chart === 'object') {
    const chart = { ...series.chart };
    for (const [key, kind] of [
      ['marks', 'mark'],
      ['links', 'link'],
    ]) {
      if (!Array.isArray(chart[key])) continue;
      if (!chart[key].length) delete chart[key];
      else chart[key] = chart[key].map((layer) => compactLayer(layer, kind, series.data.color));
    }
    setNonempty(result, 'chart', chart);
  }
  return result;
}

// Compact complete configurations, not updateOptions patches. Never touch source
// rows or callbacks. Keep named domains and track layout; a sole unused,
// default-valued track can be implicit.
export function compactOptions(options) {
  const result = withoutDefaults(options, { ...defaults.options, time: defaults.time, zoom: defaults.zoom });
  if (options.style) setNonempty(result, 'style', withoutDefaults(options.style, defaults.style));
  if (options.cursor && typeof options.cursor === 'object')
    setNonempty(result, 'cursor', withoutDefaults(options.cursor, defaults.cursor));
  if (options.domains) {
    setNonempty(
      result,
      'domains',
      Object.fromEntries(Object.entries(options.domains).map(([id, domain]) => [id, compactDomain(domain)])),
    );
  }
  if (options.tracks) {
    result.tracks = Object.fromEntries(Object.entries(options.tracks).map(([id, track]) => [id, compactTrack(track)]));
  }
  const firstTrack = Object.keys(options.tracks ?? { default: {} })[0];
  if (options.series) {
    setNonempty(
      result,
      'series',
      Object.fromEntries(Object.entries(options.series).map(([id, series]) => [id, compactSeries(series, firstTrack)])),
    );
  }
  if (options.sources) setNonempty(result, 'sources', options.sources);
  const tracks = Object.values(result.tracks ?? {});
  if (
    tracks.length === 1 &&
    !Object.keys(tracks[0]).length &&
    Object.values(result.series ?? {}).every((series) => series.track === undefined)
  )
    delete result.tracks;
  return result;
}

export function optionsCode(options, omitDefaults = true) {
  return javascript(omitDefaults ? compactOptions(options) : options, 0, true, options.sources);
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
  if (typeof value === 'string')
    return JSON.stringify(value).replace(
      /[\u{F0000}-\u{FFFFD}]/gu,
      (glyph) => `\\u{${glyph.codePointAt(0).toString(16).toUpperCase()}}`,
    );
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== 'object'))
      return `[${value.map((item) => javascript(item, depth, references, sources)).join(', ')}]`;
    return `[\n${value.map((item) => `${indent}  ${javascript(item, depth + 1, references, sources)},`).join('\n')}\n${indent}]`;
  }
  if (!Object.keys(value).length) return '{}';
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
