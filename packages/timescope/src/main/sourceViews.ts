import { TimescopeChunkStore } from '#src/main/TimescopeChunkStore';
import type { TimescopeDataRow } from '#src/main/TimescopeData';
import type { TimescopeDataSource } from '#src/main/TimescopeDataSource';
import {
  TimescopeView,
  timescopeViewRequestKey,
  type TimescopeViewRegistry,
  type TimescopeViewRequest,
} from '#src/main/TimescopeView';

const stores = new WeakMap<object, TimescopeChunkStore<TimescopeDataRow>>();
export function chunkStoreForDataSource(source: TimescopeDataSource<any>) {
  let store = stores.get(source);
  if (!store) {
    store = new TimescopeChunkStore(source, source.cacheSize);
    stores.set(source, store);
  }
  return store;
}
type InternedView = { view: TimescopeView<TimescopeDataRow>; references: number; release: () => void };
const viewsBySource = new WeakMap<object, WeakMap<TimescopeViewRegistry, Map<string, InternedView>>>();
const internedViews = new WeakMap<TimescopeView<TimescopeDataRow>, InternedView>();
export function requestViewForDataSource(
  source: TimescopeDataSource<any>,
  context: TimescopeViewRegistry,
  request: TimescopeViewRequest,
) {
  let byContext = viewsBySource.get(source);
  if (!byContext) viewsBySource.set(source, (byContext = new WeakMap()));
  let views = byContext.get(context);
  if (!views) byContext.set(context, (views = new Map()));
  const key = timescopeViewRequestKey(request);
  let entry = views.get(key);
  if (!entry) {
    const view = new TimescopeView(
      chunkStoreForDataSource(source),
      context,
      {
        chunkSize: source.chunkSize,
        chunkOrigin: source.chunkOrigin,
        resolutions: source.resolutions,
      },
      request,
    );
    entry = { view, references: 0, release: () => views.delete(key) };
    views.set(key, entry);
    internedViews.set(view, entry);
  }
  entry.references++;
  return entry.view;
}
export function releaseViewForDataSource(view: TimescopeView<TimescopeDataRow>) {
  const entry = internedViews.get(view);
  if (!entry || --entry.references > 0) return;
  entry.release();
  internedViews.delete(view);
  view.dispose();
}
