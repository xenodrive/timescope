import type { TimescopeDataChunkWire } from '#src/bridge/protocol';
import {
  addSeconds,
  alignToDay,
  alignToMonth,
  alignToSecond,
  alignToYear,
  dayOfWeek,
  epochSecondsToLocalDateTime,
  nextDay,
  nextMonth,
  nextYear,
} from '#src/core/calendar';
import type { TimescopeDataChunkDesc } from '#src/core/chunk';
import config from '#src/core/config';
import { Decimal } from '#src/core/decimal';
import type { Range } from '#src/core/range';
import { type TimeUnit } from '#src/core/time';
import type {
  CalendarLevel,
  TimeFormatFuncOptions,
  TimeFormatLabeler,
  TimeFormatLabelerOptions,
  TimescopeTimeAxisOptions,
} from '#src/core/types';
import { TimescopeDataProvider } from '#src/main/providers/TimescopeDataProvider';
import { normalizeOptions } from '#src/worker/utils';

const UNIT_EXPONENTS: Record<TimeUnit, bigint> = { s: 0n, ms: 3n, us: 6n, ns: 9n } as const;

export type TickLabel = {
  /** Tick time at the label position. */
  time: { time: Decimal };
  /** Human-readable label text. Omit to render no label. */
  text?: string;
  /** Whether to render a tick mark. */
  tick?: boolean;
  /** Whether this tick is a major tick. */
  major?: boolean;
};

function defaultTimeFormatRelative({
  time,
  digits,
  labeler,
}: TimeFormatFuncOptions & { labeler?: TimeFormatLabeler }): string {
  const lopts: TimeFormatLabelerOptions = {
    year: 0n,
    quarter: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    subseconds: time.sub(time.integer()),
    week: 0,

    second: time.integer(),
    digits,
    time,
  };
  if (digits > 0) {
    const parts = time.toFixed(digits).split('.');
    return labeler?.seconds?.(lopts) ?? parts[0] + '.' + toSmallDigits(parts[1]);
  }
  return labeler?.seconds?.(lopts) ?? time.toString();
}

export function scaleTimeUnit(v: Decimal, from: TimeUnit, to: TimeUnit): Decimal {
  if (from === to) return v;

  const fromExponent = UNIT_EXPONENTS[from] ?? 0n;
  const toExponent = UNIT_EXPONENTS[to] ?? 0n;
  const shift = toExponent - fromExponent;

  return v.shift10(shift);
}

function* createLinearTicks(range: Range<Decimal | undefined>, resolution: Decimal, options: TimescopeTimeAxisOptions) {
  if (!range[0] || !range[1]) return;

  const timeFormat = typeof options.timeFormat === 'function' ? options.timeFormat : undefined;
  const timeLabeler = typeof options.timeFormat !== 'function' ? options.timeFormat : {};

  const chunkSize = Decimal(config.defaultChunkSize);
  const effectiveResolution = resolution.mul(chunkSize);
  const exp = effectiveResolution.log(10).round().integer();
  const baseStep = Decimal(10).pow(exp, -exp);
  const resolutionThreshold = resolution.mul(Decimal(20));

  const divisors: readonly bigint[] = [10n, 5n, 1n];

  let step = baseStep;
  let divisor = 1n;
  for (const candidate of divisors) {
    const candidateStep = baseStep.div(Decimal(candidate));
    if (!candidateStep.lt(resolutionThreshold)) {
      step = candidateStep;
      divisor = candidate;
      break;
    }
  }

  if (step.isZero()) return;

  const divisorDecimal = Decimal(divisor);
  const one = Decimal(1n);
  let index = range[0]!.div(step).floor().sub(one);

  const digits = Math.max(0, -step.log(10).floor().number());

  for (let guard = 0; guard < 1_000_000; guard += 1) {
    index = index.add(one);
    const current = step.mul(index);
    if (current.ge(range[1]!)) break;
    if (current.lt(range[0]!)) continue;

    const major = index.mod(divisorDecimal).isZero();
    const opts: TimeFormatFuncOptions = {
      time: current,
      unit: options.timeUnit ?? 's',
      level: 'relative',
      digits,
      stride: undefined,
    };

    yield {
      time: { time: current },
      major,
      tick: true,
      text: major ? (timeFormat?.(opts) ?? defaultTimeFormatRelative({ ...opts, labeler: timeLabeler })) : '',
    };
  }
}

type TickOps = {
  align(time: Decimal): Decimal;
  next(time: Decimal): Decimal | null;
};

function createSecondTickOps(step: Decimal): TickOps {
  return {
    align: (time) => alignToSecond(time, step),
    next: (time) => addSeconds(time, step),
  };
}

function createMinuteTickOps(step: Decimal): TickOps {
  step = step.mul(60);
  return {
    align: (time) => alignToSecond(time, step),
    next: (time) => addSeconds(time, step),
  };
}

function createHourTickOps(step: Decimal): TickOps {
  step = step.mul(3600);
  return {
    align: (time) => alignToSecond(time, step),
    next: (time) => addSeconds(time, step),
  };
}

function createDayTickOps(step: bigint | bigint[]): TickOps {
  return {
    align: (time) => alignToDay(time, step),
    next: (time) => nextDay(time, step),
  };
}

function createMonthTickOps(step: bigint | bigint[]): TickOps {
  return {
    align: (time) => alignToMonth(time, step),
    next: (time) => nextMonth(time, step),
  };
}

function createYearTickOps(step: bigint): TickOps {
  return {
    align: (time) => alignToYear(time, step),
    next: (time) => nextYear(time, step),
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
  create: () => TickOps;
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

function instantiateDefinitionTickOps(entry: DefinitionEntry): TickOps {
  const { ops, step } = entry;
  if (ops === createSecondTickOps || ops === createMinuteTickOps || ops === createHourTickOps) {
    return ops(Decimal(step as number | string | bigint));
  }
  if (ops === createDayTickOps || ops === createMonthTickOps) {
    const normalized = Array.isArray(step)
      ? (step as (number | bigint)[]).map((value) => BigInt(value))
      : BigInt(step as number | bigint);
    return ops(normalized);
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
      create: () => instantiateDefinitionTickOps(entry),
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
  if (step.digits <= 0n) return 0;
  let digits = step.digits;
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (digits > maxSafe) digits = maxSafe;
  return Number(digits);
}

function createSubsecondCandidate(step: Decimal, exponent: bigint, factor: bigint): Candidate {
  return {
    level: 'subsecond',
    stride: 1n,
    duration: step,
    digits: subsecondDecimals(step),
    create: () => createSecondTickOps(step),
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
    exponent = effectiveThreshold.log(10).floor().integer();
    if (exponent >= 0n) exponent = -1n;
  } else {
    exponent = -1n;
  }

  let fallback: { step: Decimal; exponent: bigint; factor: bigint } | null = null;

  for (let current = exponent; current < 0n; current += 1n) {
    const base = Decimal(10).pow(current, -current);
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
    create: () => createYearTickOps(strideYears),
    yearStride: strideYears,
  };
}

function pickYear(threshold: Decimal): Candidate {
  const effectiveThreshold = threshold.isPositive() ? threshold : Decimal(0);
  if (effectiveThreshold.isZero()) {
    return createYearCandidate(1n);
  }

  const ratio = effectiveThreshold.div(AVERAGE_SECONDS_PER_YEAR);
  let exponent = ratio.log(10).floor().integer();
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
  level: CalendarLevel;
  digits: number;
  stride: bigint;
  major: TickOps;
  minor: TickOps | null;
};

function forgeCalendarContext(resolution: Decimal): CalendarContext | null {
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
    major: majorCandidate.create(),
    minor: minorCandidate ? minorCandidate.create() : null,
    digits: majorCandidate.digits,
    stride: majorCandidate.stride,
  };
}

function toSmallDigits(s: string) {
  return s.replace(/[0-9]/g, (v) => String.fromCodePoint(v.charCodeAt(0) - 48 + '₀'.charCodeAt(0)));
}

function defaultTimeFormatCalendar(
  opts: TimeFormatFuncOptions & CalendarContext & { labeler?: TimeFormatLabeler },
): string {
  const { time, unit } = opts;
  const context = opts;
  const { year, month, day, hour, minute, second, subseconds } = epochSecondsToLocalDateTime(
    scaleTimeUnit(time, unit, 's'),
  );
  const week = dayOfWeek({ year, month, day });
  const quarter = Math.floor((Number(month) - 1) / 3) + 1;

  const padNumber = (value: number | bigint, length: number) => value.toString().padStart(length, '0');
  const pad2 = (value: number | bigint) => padNumber(value, 2);

  const labeler = opts.labeler ?? {};

  const lopts: TimeFormatLabelerOptions = {
    year,
    quarter,
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second,
    subseconds,
    week,
    digits: context.digits,
    time,
  };

  const formatYearLabel =
    labeler.year ??
    (() => {
      if (year > 0n) return year.toString();
      const bc = (1n - year).toString();
      return ` ${bc} BC`;
    });
  const formatQuarterLabel =
    labeler.quarter ??
    (() => {
      if (quarter === 1) return `${formatYearLabel(lopts)} Q${quarter}`;
      return `Q${quarter}`;
    });
  const formatMonthLabel = labeler.month ?? (() => `${formatYearLabel(lopts)}/${pad2(month)}`);
  const formatDateLabel =
    labeler.date ??
    (() => {
      const weekMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${pad2(month)}/${pad2(day)}(${weekMap[week]})`;
    });
  const formatHourMinuteLabel = labeler?.minutes ?? (() => `${pad2(hour)}:${pad2(minute)}`);

  const digits = context.digits > 0 ? '.' + toSmallDigits(subseconds.toFixed(context.digits).split('.')[1]) : '';
  const formatSecondLabel = labeler.seconds ?? (() => `${pad2(hour)}:${pad2(minute)}:${pad2(second)}${digits}`);

  switch (context.level) {
    case 'subsecond':
    case 'second':
      if (hour === 0n && minute === 0n && second === 0n && subseconds.eq(0)) return formatDateLabel(lopts);
      return formatSecondLabel(lopts);
    case 'minute':
    case 'hour':
      if (hour === 0n && minute === 0n) return formatDateLabel(lopts);
      return formatHourMinuteLabel(lopts);
    case 'day':
      return formatDateLabel(lopts);
    case 'month': {
      if (context.stride === 3n) return formatQuarterLabel(lopts);
      return formatMonthLabel(lopts);
    }
    case 'year':
    default:
      return formatYearLabel(lopts);
  }
}

function advanceTick(ops: TickOps | null, current: Decimal, end: Decimal): Decimal | null {
  if (!ops) return null;
  const next = ops.next(current);
  if (!next || next.le(current)) return null;
  if (next.ge(end)) return null;
  return next;
}

function* createCalendarTicks(
  range: Range<Decimal | undefined>,
  resolution: Decimal,
  options: TimescopeTimeAxisOptions,
): Generator<TickLabel> {
  if (!range[0] || !range[1]) return;

  const unit = options.timeUnit ?? 's';

  const start = scaleTimeUnit(range[0], unit, 's');
  const end = scaleTimeUnit(range[1], unit, 's');
  if (end.le(start)) return;
  resolution = scaleTimeUnit(resolution, unit, 's');

  const context: CalendarContext | null = forgeCalendarContext(resolution);
  if (!context) return;

  const timeFormat = typeof options.timeFormat === 'function' ? options.timeFormat : undefined;

  let majorTime: Decimal | null = context.major.align(start);
  let minorTime: Decimal | null = context.minor?.align(start) ?? null;

  while (majorTime || minorTime) {
    const shouldEmitMajor = majorTime != null && (minorTime == null || majorTime.le(minorTime));
    if (shouldEmitMajor && majorTime) {
      if (start.le(majorTime)) {
        const time = scaleTimeUnit(majorTime, 's', unit);
        yield {
          time: { time },
          major: true,
          tick: true,
          text:
            timeFormat?.({ time, unit, ...context }) ??
            defaultTimeFormatCalendar({
              time,
              unit,
              ...context,
              labeler: typeof options.timeFormat !== 'function' ? options.timeFormat : undefined,
            }),
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
        yield { time: { time }, major: false, tick: true, text: '' };
      }
      minorTime = advanceTick(context.minor, minorTime, end);
    }
  }
}

export type TimescopeTimeAxisProviderOptions = {
  timeAxis: TimescopeTimeAxisOptions;
};

export class TimescopeTimeAxisProvider extends TimescopeDataProvider<
  TickLabel[],
  unknown,
  TimescopeTimeAxisProviderOptions
> {
  constructor(opts: TimescopeTimeAxisProviderOptions) {
    opts = {
      ...opts,
      timeAxis: normalizeOptions(opts.timeAxis, {
        timeUnit: 's',
      })!,
    };
    super(opts);
  }

  async loadChunk(chunk: TimescopeDataChunkDesc): Promise<TimescopeDataChunkWire<TickLabel[]>> {
    const ticks = this.options.timeAxis.relative
      ? createLinearTicks(chunk.range, chunk.resolution, this.options.timeAxis)
      : createCalendarTicks(chunk.range, chunk.resolution, this.options.timeAxis);

    const data = [...ticks].map((tick) => ({
      ...tick,
      time: {
        time: tick.time.time,
        _minTime: tick.time.time,
        _maxTime: tick.time.time,
      },
    }));
    return { ...chunk, data };
  }
}
