import type { Decimal } from '#src/core/decimal';
import type { TimescopeDataSourceQuery } from '#src/main/TimescopeDataSource';

export function validateQuery({ range: [start, end], resolution }: TimescopeDataSourceQuery) {
  if (!start || !end || end.lt(start)) throw new RangeError('Query range must be finite and ordered');
  if (resolution.le(0)) throw new RangeError('Query resolution must be positive');
}

/** Include complete intersecting buckets, anchored independently of query boundaries. */
export function aggregateQuery(
  { range: [start, end], resolution }: TimescopeDataSourceQuery,
  origin: Decimal,
): TimescopeDataSourceQuery {
  const first = start.sub(origin).divFloor(resolution);
  const last = end.sub(origin).neg().divFloor(resolution).neg();
  return { range: [origin.add(first.mul(resolution)), origin.add(last.mul(resolution))], resolution };
}
