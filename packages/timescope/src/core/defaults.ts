/**
 * Effective defaults, grouped by the option they configure. This is not a
 * constructor configuration: domains, series, and tracks still need names.
 * Unspecified chart colors inherit from the series; track heights are automatic.
 * Every group and array is frozen so inspecting defaults cannot change rendering.
 */
export const defaultOptions = Object.freeze({
  time: null,
  zoom: 0,
  wheelSensitivity: 200,
  fit: Object.freeze({ padding: 0 }),
  options: Object.freeze({
    style: undefined,
    font: undefined,
    cursor: true,
    showFps: false,
    sources: undefined,
    series: undefined,
    tracks: undefined,
    domains: undefined,
    selection: true,
  }),
  style: Object.freeze({ width: '100%', height: '36px', background: '#fff' }),
  cursor: Object.freeze({ color: 'white', borderColor: 'red' }),
  domain: Object.freeze({
    scale: 'linear' as const,
    animation: true,
    floatingGap: 20,
    axis: false,
    unit: '',
    digits: 1,
  }),
  domainRange: Object.freeze({
    default: Object.freeze([undefined, undefined] as const),
    expand: false,
    shrink: true,
  }),
  track: Object.freeze({ height: undefined, symmetric: false, timeAxis: true }),
  timeAxis: Object.freeze({ relative: false, timeZone: 'local', timeUnit: 's' as const }),
  series: Object.freeze({
    tooltip: true,
    // An inherited fill is translucent; explicit fillColor is not.
    fillAlpha: 0.25,
    instantaneous: Object.freeze({ using: 'value' }),
    // Assigned cyclically to series without an explicit color.
    colors: Object.freeze(['#080', '#800', '#008', '#880', '#088', '#808']),
  }),
  chartStyle: Object.freeze({
    lineWidth: 1,
    fillOpacity: 1,
    radius: 0,
    offset: Object.freeze([0, 0] as const),
    textAlign: 'center' as const,
  }),
  chartSize: Object.freeze({ mark: 5, text: 14, icon: 16 }),
  chartUsing: Object.freeze({
    point: 'value@time',
    area: Object.freeze(['value@time', '#zero@time'] as const),
    range: Object.freeze(['min', 'max'] as const),
    region: Object.freeze(['#bottom@_minTime', '#top@_maxTime'] as const),
  }),
  source: Object.freeze({ chunkSize: 256, chunkOrigin: 0, immediate: true, cacheSize: 1000 }),
});
