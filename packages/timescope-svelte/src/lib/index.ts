import type { Timescope as TimescopeCore } from 'timescope';

export { Decimal } from 'timescope';
export { default as Timescope } from './Timescope.svelte';

export type TimescopeAPI = {
  setTime: TimescopeCore['setTime'];
  setZoom: TimescopeCore['setZoom'];
  fitTo: TimescopeCore['fitTo'];
};
