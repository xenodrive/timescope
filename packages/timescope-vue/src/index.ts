import {
  createDefineTimescopeOptions,
  createDefineTimescopeSeries,
  createDefineTimescopeSources,
  createDefineTimescopeTracks,
} from 'timescope';
import { reactive } from 'vue';

export { Decimal } from 'timescope';
export { default as Timescope } from './Timescope.vue';

export const defineTimescopeOptions = createDefineTimescopeOptions(reactive);
export const defineTimescopeSources = createDefineTimescopeSources(reactive);
export const defineTimescopeTracks = createDefineTimescopeTracks(reactive);
export const defineTimescopeSeries = createDefineTimescopeSeries(reactive);
