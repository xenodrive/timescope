import { createDefineTimescopeOptions } from 'timescope';
import { markRaw, reactive } from 'vue';

export * from 'timescope';
export { default as Timescope } from './Timescope.vue';

function markSourceRaw<T>(source: T): T {
  if (
    source &&
    typeof source === 'object' &&
    typeof (source as { query?: unknown }).query === 'function' &&
    typeof (source as { invalidate?: unknown }).invalidate === 'function'
  ) {
    markRaw(source);
  }
  return source;
}

function reactiveOptions(options: object) {
  const value = options as { sources?: object };
  if (value.sources) value.sources = reactiveSources(value.sources);
  return reactive(options);
}

function reactiveSources(sources: object) {
  for (const source of Object.values(sources)) markSourceRaw(source);
  return new Proxy(reactive(sources), {
    set(target, key, value) {
      return Reflect.set(target, key, markSourceRaw(value));
    },
  });
}

export const defineTimescopeOptions = createDefineTimescopeOptions(reactiveOptions);
