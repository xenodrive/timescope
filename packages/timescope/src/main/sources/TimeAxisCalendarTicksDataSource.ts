import { DEFAULT_CHUNK_SIZE } from '#src/core/chunk';
import { Decimal, pow10 } from '#src/core/decimal';
import { TimescopeObservable, type TimescopeEvent } from '#src/core/event';
import type { TimescopeRange } from '#src/core/range';
import {
  scaleTimeUnit,
  type CalendarLevel,
  type TimescopeTimeAxisOptions,
  type TimeAxisTick,
} from '#src/main/timeAxis';
import type { TimescopeDataSourceInvalidation, TimescopeDataSourceQuery } from '#src/main/TimescopeDataSource';
import { Calendar } from '@kikuchan/calendar';

type TickOps = {
  align(time: Decimal): Decimal;
  next(time: Decimal): Decimal | null;
};

function createSecondTickOps(step: Decimal, timeZone: string): TickOps {
  return {
    align: (time) => Calendar.fromEpoch(time).zone(timeZone).alignToSecond(step).epoch(),
    next: (time) => time.add(step),
  };
}

function createMinuteTickOps(step: Decimal, timeZone: string): TickOps {
  return createSecondTickOps(step.mul(60), timeZone);
}

function createHourTickOps(step: Decimal, timeZone: string): TickOps {
  return createSecondTickOps(step.mul(3600), timeZone);
}

function createDayTickOps(step: bigint | bigint[], timeZone: string): TickOps {
  return {
    align: (time) => Calendar.fromEpoch(time).zone(timeZone).alignToDay(step).epoch(),
    next: (time) => Calendar.fromEpoch(time).zone(timeZone).nextDay(step).epoch(),
  };
}

function createMonthTickOps(step: bigint | bigint[], timeZone: string): TickOps {
  return {
    align: (time) => Calendar.fromEpoch(time).zone(timeZone).alignToMonth(step).epoch(),
    next: (time) => Calendar.fromEpoch(time).zone(timeZone).nextMonth(step).epoch(),
  };
}

function createYearTickOps(step: bigint, timeZone: string): TickOps {
  return {
    align: (time) => Calendar.fromEpoch(time).zone(timeZone).alignToYear(step, { era: true }).epoch(),
    next: (time) => Calendar.fromEpoch(time).zone(timeZone).nextYear(step, { era: true }).epoch(),
  };
}

const definitions = [
  // subseconds
  // : should be generated dynamically

  // seconds
  { ops: createSecondTickOps, stride: 1, step: 1 },
  { ops: createSecondTickOps, stride: 5, step: 5 },
  { ops: createSecondTickOps, stride: 10, step: 10 },
  { ops: createSecondTickOps, stride: 15, step: 15 },
  { ops: createSecondTickOps, stride: 30, step: 30 },

  // minutes
  { ops: createMinuteTickOps, stride: 1, step: 1 },
  { ops: createMinuteTickOps, stride: 5, step: 5 },
  { ops: createMinuteTickOps, stride: 10, step: 10 },
  { ops: createMinuteTickOps, stride: 15, step: 15 },
  { ops: createMinuteTickOps, stride: 30, step: 30 },

  // hours
  { ops: createHourTickOps, stride: 1, step: 1 },
  { ops: createHourTickOps, stride: 3, step: 3 },
  { ops: createHourTickOps, stride: 6, step: 6 },
  { ops: createHourTickOps, stride: 12, step: 12 },

  // days
  { ops: createDayTickOps, stride: 1, step: 1 },
  { ops: createDayTickOps, stride: 10, step: [1, 10, 20] },
  { ops: createMonthTickOps, stride: 1, step: 1 },
  { ops: createMonthTickOps, stride: 3, step: 3 },

  // year
  // : should be generated dynamically
];

const SECONDS_PER_DAY_DECIMAL = Decimal(86400);
const AVERAGE_SECONDS_PER_MONTH = Decimal('2629800'); // 30.4375 days
const AVERAGE_SECONDS_PER_YEAR = Decimal('31557600'); // 365.25 days

type DefinitionLevel = Exclude<CalendarLevel, 'subsecond' | 'year'>;

type DefinitionEntry = (typeof definitions)[number];

type Candidate = {
  level: CalendarLevel;
  stride: bigint;
  duration: Decimal;
  digits: number;
  create: (timeZone: string) => TickOps;
  source?: DefinitionEntry;
  subsecondMetadata?: { exponent: bigint; factor: bigint };
  yearStride?: bigint;
};

const MIN_MAJOR_TICK_PIXELS = Decimal(60);
const MIN_MINOR_TICK_PIXELS = Decimal(20);

const SUBSECOND_FACTORS = [1n, 5n] as const;
const YEAR_FACTORS = [1n, 5n] as const;
const LEVEL_SEQUENCE: readonly CalendarLevel[] = [
  'subsecond',
  'second',
  'minute',
  'hour',
  'day',
  'month',
  'year',
] as const;

function inferDefinitionLevel(entry: DefinitionEntry): DefinitionLevel {
  switch (entry.ops) {
    case createSecondTickOps:
      return 'second';
    case createMinuteTickOps:
      return 'minute';
    case createHourTickOps:
      return 'hour';
    case createDayTickOps:
      return 'day';
    case createMonthTickOps:
      return 'month';
    default:
      throw new Error('Unknown calendar definition');
  }
}

function instantiateDefinitionTickOps(entry: DefinitionEntry, timeZone: string): TickOps {
  const { ops, step } = entry;
  if (ops === createSecondTickOps || ops === createMinuteTickOps || ops === createHourTickOps) {
    return ops(Decimal(step as number | string | bigint), timeZone);
  }
  if (ops === createDayTickOps || ops === createMonthTickOps) {
    const normalized = Array.isArray(step)
      ? (step as (number | bigint)[]).map((value) => BigInt(value))
      : BigInt(step as number | bigint);
    return ops(normalized, timeZone);
  }
  throw new Error('Unsupported definition');
}

function approximateDefinitionDuration(entry: DefinitionEntry): Decimal {
  const stride = Decimal(BigInt(entry.stride));
  switch (inferDefinitionLevel(entry)) {
    case 'second':
      return Decimal(entry.step as number | string | bigint);
    case 'minute':
      return Decimal(entry.step as number | string | bigint).mul(60);
    case 'hour':
      return Decimal(entry.step as number | string | bigint).mul(3600);
    case 'day':
      return stride.mul(SECONDS_PER_DAY_DECIMAL);
    case 'month':
      return stride.mul(AVERAGE_SECONDS_PER_MONTH);
    default:
      return Decimal(0);
  }
}

const definitionCandidates = definitions
  .map((entry) => {
    const level = inferDefinitionLevel(entry);
    const strideBigInt = BigInt(entry.stride);
    const duration = approximateDefinitionDuration(entry);
    return {
      level,
      stride: strideBigInt,
      duration,
      digits: 0,
      create: (timeZone: string) => instantiateDefinitionTickOps(entry, timeZone),
      source: entry,
    } satisfies Candidate;
  })
  .sort((a, b) => {
    if (a.duration.lt(b.duration)) return -1;
    if (a.duration.gt(b.duration)) return 1;
    return 0;
  });

const definitionCandidatesByLevel = definitionCandidates.reduce((map, candidate) => {
  const list = map.get(candidate.level as DefinitionLevel);
  if (list) {
    list.push(candidate);
  } else {
    map.set(candidate.level as DefinitionLevel, [candidate]);
  }
  return map;
}, new Map<DefinitionLevel, Candidate[]>());

function subsecondDecimals(step: Decimal): number {
  if (step.digits <= 0) return 0;
  let digits = step.digits;
  const maxSafe = Number.MAX_SAFE_INTEGER;
  if (digits > maxSafe) digits = maxSafe;
  return digits;
}

function createSubsecondCandidate(step: Decimal, exponent: bigint, factor: bigint): Candidate {
  return {
    level: 'subsecond',
    stride: 1n,
    duration: step,
    digits: subsecondDecimals(step),
    create: (timeZone) => createSecondTickOps(step, timeZone),
    subsecondMetadata: { exponent, factor },
  };
}

function pickSubsecond(threshold: Decimal, maxDuration: Decimal | null, allowFallback: boolean): Candidate | null {
  const upperLimit = maxDuration && maxDuration.lt(Decimal(1)) ? maxDuration : Decimal(1);
  const thresholdLessThanOne = threshold.lt(Decimal(1));
  if (!thresholdLessThanOne && !allowFallback) return null;

  const effectiveThreshold = thresholdLessThanOne ? threshold : Decimal(1);

  let exponent: bigint;
  if (effectiveThreshold.isPositive()) {
    exponent = effectiveThreshold.order();
    if (exponent >= 0n) exponent = -1n;
  } else {
    exponent = -1n;
  }

  let fallback: { step: Decimal; exponent: bigint; factor: bigint } | null = null;

  for (let current = exponent; current < 0n; current += 1n) {
    const base = pow10(current);
    for (const factor of SUBSECOND_FACTORS) {
      const step = base.mul(Decimal(factor));
      if (!step.lt(upperLimit)) continue;
      if (effectiveThreshold.isZero() || !step.lt(effectiveThreshold)) {
        return createSubsecondCandidate(step, current, factor);
      }
      if (!fallback || fallback.step.lt(step)) {
        fallback = { step, exponent: current, factor };
      }
    }
  }

  if (allowFallback && fallback) {
    return createSubsecondCandidate(fallback.step, fallback.exponent, fallback.factor);
  }

  return null;
}

function pickDefinitionMajor(threshold: Decimal): Candidate | null {
  const effectiveThreshold = threshold.isPositive() ? threshold : Decimal(0);
  for (const candidate of definitionCandidates) {
    if (effectiveThreshold.isZero() || !candidate.duration.lt(effectiveThreshold)) {
      return candidate;
    }
  }
  return null;
}

function pickDefinitionForLevel(
  level: DefinitionLevel,
  threshold: Decimal,
  maxDuration: Decimal | null,
  allowFallback: boolean,
): Candidate | null {
  const candidates = definitionCandidatesByLevel.get(level);
  if (!candidates) return null;

  const effectiveThreshold = threshold.isPositive() ? threshold : Decimal(0);
  let fallback: Candidate | null = null;

  for (const candidate of candidates) {
    if (maxDuration && !candidate.duration.lt(maxDuration)) break;
    if (effectiveThreshold.isZero() || !candidate.duration.lt(effectiveThreshold)) {
      return candidate;
    }
    fallback = candidate;
  }

  if (allowFallback && fallback) return fallback;

  return null;
}

function pow10BigInt(exponent: bigint): bigint {
  if (exponent <= 0n) return 1n;
  let result = 1n;
  let base = 10n;
  let exp = exponent;
  while (exp > 0n) {
    if ((exp & 1n) === 1n) result *= base;
    base *= base;
    exp >>= 1n;
  }
  return result;
}

function createYearCandidate(strideYears: bigint): Candidate {
  const strideDecimal = Decimal(strideYears);
  const duration = strideDecimal.mul(AVERAGE_SECONDS_PER_YEAR);
  return {
    level: 'year',
    stride: strideYears,
    duration,
    digits: 0,
    create: (timeZone) => createYearTickOps(strideYears, timeZone),
    yearStride: strideYears,
  };
}

function pickYear(threshold: Decimal): Candidate {
  const effectiveThreshold = threshold.isPositive() ? threshold : Decimal(0);
  if (effectiveThreshold.isZero()) {
    return createYearCandidate(1n);
  }

  let exponent = effectiveThreshold.order() - AVERAGE_SECONDS_PER_YEAR.order();
  if (effectiveThreshold.lt(AVERAGE_SECONDS_PER_YEAR.shift10(exponent))) exponent--;
  if (exponent < 0n) exponent = 0n;

  for (let current = exponent; ; current += 1n) {
    const multiplier = pow10BigInt(current);
    for (const factor of YEAR_FACTORS) {
      const stride = multiplier * factor;
      const candidate = createYearCandidate(stride);
      if (!candidate.duration.lt(effectiveThreshold)) {
        return candidate;
      }
    }
  }
}

function candidateLevelIndex(level: CalendarLevel): number {
  return LEVEL_SEQUENCE.indexOf(level);
}

function selectMinorCandidate(major: Candidate, threshold: Decimal): Candidate | null {
  const majorIndex = candidateLevelIndex(major.level);
  if (majorIndex <= 0) return null;
  const targetLevel = LEVEL_SEQUENCE[majorIndex - 1];
  const limit = major.duration;

  if (major.level === 'year') {
    const divisors = [5n, 4n, 2n];
    for (const divisor of divisors) {
      if (major.stride % divisor !== 0n) continue;
      const stride = major.stride / divisor;
      if (stride <= 0n) continue;
      const candidate = createYearCandidate(stride);
      if (candidate.duration.lt(threshold)) continue;
      if (!candidate.duration.lt(major.duration)) continue;
      return candidate;
    }
    const smaller = pickYear(threshold);
    if (smaller.duration.lt(major.duration)) return smaller;
    return null;
  }

  if (major.level === 'subsecond') {
    const minor = pickSubsecond(threshold, major.duration, true);
    if (minor && minor.duration.lt(major.duration)) return minor;
    return null;
  }

  const level = major.level as DefinitionLevel;
  const candidates = definitionCandidatesByLevel.get(level) ?? [];

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const candidate = candidates[i];
    if (!candidate.duration.lt(major.duration)) continue;
    if (candidate.duration.lt(threshold)) continue;
    return candidate;
  }

  if (targetLevel === 'subsecond') {
    const fallback = pickSubsecond(threshold, limit, true);
    if (fallback && fallback.duration.lt(major.duration)) return fallback;
    return null;
  }

  if (targetLevel === 'year') return null;

  return pickDefinitionForLevel(targetLevel as DefinitionLevel, threshold, limit, true);
}

type CalendarContext = {
  timeZone: string;
  level: CalendarLevel;
  digits: number;
  stride: bigint;
  major: TickOps;
  minor: TickOps | null;
};

function forgeCalendarContext(resolution: Decimal, timeZone: string): CalendarContext | null {
  if (!resolution) return null;
  if (!resolution.isPositive()) return null;

  const majorThreshold = resolution.mul(MIN_MAJOR_TICK_PIXELS);
  const minorThreshold = resolution.mul(MIN_MINOR_TICK_PIXELS);

  let majorCandidate = pickSubsecond(majorThreshold, null, false);
  if (!majorCandidate) {
    majorCandidate = pickDefinitionMajor(majorThreshold);
  }
  if (!majorCandidate) {
    majorCandidate = pickYear(majorThreshold);
  }
  if (!majorCandidate) return null;

  const minorCandidate = selectMinorCandidate(majorCandidate, minorThreshold);

  return {
    level: majorCandidate.level,
    timeZone,
    major: majorCandidate.create(timeZone),
    minor: minorCandidate ? minorCandidate.create(timeZone) : null,
    digits: majorCandidate.digits,
    stride: majorCandidate.stride,
  };
}

function advanceTick(ops: TickOps | null, current: Decimal, end: Decimal): Decimal | null {
  if (!ops) return null;
  const next = ops.next(current);
  if (!next || next.le(current)) return null;
  if (next.ge(end)) return null;
  return next;
}

function* createCalendarTicks(
  range: TimescopeRange<Decimal | undefined>,
  resolution: Decimal,
  options: TimescopeTimeAxisOptions,
): Generator<TimeAxisTick> {
  if (!range[0] || !range[1]) return;

  const unit = options.timeUnit ?? 's';

  const start = scaleTimeUnit(range[0], unit, 's');
  const end = scaleTimeUnit(range[1], unit, 's');
  if (end.le(start)) return;
  resolution = scaleTimeUnit(resolution, unit, 's');

  const context: CalendarContext | null = forgeCalendarContext(resolution, options.timeZone ?? 'local');
  if (!context) return;

  let majorTime: Decimal | null = context.major.align(start);
  let minorTime: Decimal | null = context.minor?.align(start) ?? null;

  while (majorTime || minorTime) {
    const shouldEmitMajor = majorTime != null && (minorTime == null || majorTime.le(minorTime));
    if (shouldEmitMajor && majorTime) {
      if (start.le(majorTime)) {
        const time = scaleTimeUnit(majorTime, 's', unit);
        yield {
          time: { time, _minTime: time, _maxTime: time },
          major: true,
          tick: true,
          format: {
            time,
            unit,
            level: context.level,
            digits: context.digits,
            stride: context.stride,
            timeZone: context.timeZone,
          },
        };
      }

      if (minorTime && minorTime.eq(majorTime)) {
        minorTime = advanceTick(context.minor, minorTime, end);
      }
      majorTime = advanceTick(context.major, majorTime, end);
      continue;
    }

    if (minorTime) {
      if (start.le(minorTime)) {
        const time = scaleTimeUnit(minorTime, 's', unit);
        yield { time: { time, _minTime: time, _maxTime: time }, major: false, tick: true };
      }
      minorTime = advanceTick(context.minor, minorTime, end);
    }
  }
}

export class TimeAxisCalendarTicksDataSource extends TimescopeObservable<
  TimescopeEvent<'invalidate', TimescopeDataSourceInvalidation>
> {
  readonly chunkSize = DEFAULT_CHUNK_SIZE;
  readonly chunkOrigin = Decimal(0);
  readonly options: TimescopeTimeAxisOptions;
  constructor(options: TimescopeTimeAxisOptions) {
    super();
    this.options = options;
  }
  async query({ range, resolution }: TimescopeDataSourceQuery) {
    return [...createCalendarTicks(range, resolution, this.options)];
  }
}
