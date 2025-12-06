import { Decimal } from '#src/core/decimal';
const ONE_DECIMAL = Decimal(1n);
const ZERO_DECIMAL = Decimal(0n);
const SECONDS_PER_MINUTE_BIGINT = 60n;
const MINUTES_PER_HOUR_BIGINT = 60n;
const HOURS_PER_DAY_BIGINT = 24n;
const SECONDS_PER_HOUR_BIGINT = SECONDS_PER_MINUTE_BIGINT * MINUTES_PER_HOUR_BIGINT;
const SECONDS_PER_DAY_BIGINT = SECONDS_PER_HOUR_BIGINT * HOURS_PER_DAY_BIGINT;

const DATE_CLAMP_SECONDS = 8640000000000n;

export type LocalDateTime = {
  year: bigint;
  month: bigint;
  day: bigint;
  hour: bigint;
  minute: bigint;
  second: bigint;
  subseconds: Decimal;
};

function floorDiv(a: bigint, b: bigint): bigint {
  let q = a / b;
  const r = a % b;
  if (r !== 0n && r > 0n !== b > 0n) q -= 1n;
  return q;
}

function floorMod(a: bigint, b: bigint): bigint {
  return a - floorDiv(a, b) * b;
}

function toAstronomical(year: bigint): bigint {
  return year > 0n ? year : year + 1n;
}

function fromAstronomical(year: bigint): bigint {
  return year > 0n ? year : year - 1n;
}

function normalizeMonth(year: bigint, month: bigint): { year: bigint; month: bigint; day: bigint } {
  const astroYear = toAstronomical(year);
  const zeroBased = month - 1n;
  const quotient = floorDiv(zeroBased, 12n);
  const normalizedZero = zeroBased - quotient * 12n;
  const normalizedYear = fromAstronomical(astroYear + quotient);
  return { year: normalizedYear, month: normalizedZero + 1n, day: 1n };
}

function normalizeDate(
  year: bigint,
  month: bigint,
  day: bigint,
): {
  year: bigint;
  month: bigint;
  day: bigint;
} {
  const normalizedMonth = normalizeMonth(year, month);
  const absoluteDays = daysFromCivil(normalizedMonth.year, normalizedMonth.month, day);
  return civilFromDays(absoluteDays);
}

function daysFromCivil(year: bigint, month: bigint, day: bigint): bigint {
  let y = toAstronomical(year);
  let m = month;
  const d = day;
  if (m <= 2n) y -= 1n;
  const era = y / 400n - (y < 0n ? 1n : 0n);
  const yoe = y - era * 400n;
  m += m > 2n ? -3n : 9n;
  const doy = (153n * m + 2n) / 5n + d - 1n;
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  return era * 146097n + doe - 719468n;
}

function civilFromDays(days: bigint): { year: bigint; month: bigint; day: bigint } {
  const z = days + 719468n;
  const era = z / 146097n - (z < 0n ? 1n : 0n);
  const doe = z - era * 146097n;
  const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n;
  let y = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);
  const mp = (5n * doy + 2n) / 153n;
  const day = doy - (153n * mp + 2n) / 5n + 1n;
  const monthBig = mp + (mp < 10n ? 3n : -9n);
  if (monthBig <= 2n) y += 1n;
  return { year: fromAstronomical(y), month: monthBig, day };
}

function clampSecondsForDate(seconds: bigint): bigint {
  if (seconds > DATE_CLAMP_SECONDS) return DATE_CLAMP_SECONDS;
  if (seconds < -DATE_CLAMP_SECONDS) return -DATE_CLAMP_SECONDS;
  return seconds;
}

function offsetSecondsFor(seconds: bigint): bigint {
  const clamped = clampSecondsForDate(seconds);
  const offsetMinutes = -BigInt(Math.floor(new Date(Number(clamped) * 1000).getTimezoneOffset()));
  return offsetMinutes * SECONDS_PER_MINUTE_BIGINT;
}

function localOffsetAtSeconds(epochSeconds: bigint): bigint {
  return offsetSecondsFor(epochSeconds);
}

function extendedOffsetForLocal(localSeconds: bigint): bigint {
  return offsetSecondsFor(localSeconds);
}

function localDateTimeToEpochSecondsUnbounded(local: LocalDateTime): Decimal {
  const days = daysFromCivil(local.year, local.month, local.day);
  const secondsOfDay = local.hour * SECONDS_PER_HOUR_BIGINT + local.minute * SECONDS_PER_MINUTE_BIGINT + local.second;
  const localSeconds = days * SECONDS_PER_DAY_BIGINT + secondsOfDay;
  const offsetSeconds = extendedOffsetForLocal(localSeconds);
  const epochSeconds = localSeconds - offsetSeconds;
  return Decimal(epochSeconds).add(local.subseconds);
}

function localDateTimeToEpochSeconds(local: LocalDateTime): Decimal {
  const normalizedDate = normalizeDate(local.year, local.month, local.day);
  const subsecondsNormalized = local.subseconds.modPositive(ONE_DECIMAL);
  const subsecondsAdjustment = local.subseconds.sub(subsecondsNormalized).integer();
  const normalizedSecond = local.second + subsecondsAdjustment;
  const normalized: LocalDateTime = {
    ...local,
    ...normalizedDate,
    second: normalizedSecond,
    subseconds: subsecondsNormalized,
  };
  return localDateTimeToEpochSecondsUnbounded(normalized);
}

export function decimalFromEpochSeconds(seconds: bigint): Decimal {
  return Decimal(seconds);
}

export function decimalToEpochSeconds(value: Decimal): bigint {
  return value.integer();
}

// returns 0: Sunday, ... 6: Saturday
export function dayOfWeek(date: { year: bigint; month: bigint; day: bigint }): number {
  return Number(floorMod(daysFromCivil(date.year, date.month, date.day) + 4n, 7n));
}

export function epochSecondsToLocalDateTime(value: Decimal): LocalDateTime {
  const [epochIntegral] = value.split();
  const epochSeconds = epochIntegral.integer();
  const offsetSeconds = localOffsetAtSeconds(epochSeconds);
  const adjusted = value.add(Decimal(offsetSeconds));
  const [localIntegral, subseconds] = adjusted.split();
  const localSeconds = localIntegral.integer();
  const days = floorDiv(localSeconds, SECONDS_PER_DAY_BIGINT);
  const secondsOfDay = floorMod(localSeconds, SECONDS_PER_DAY_BIGINT);
  const date = civilFromDays(days);
  const hour = floorDiv(secondsOfDay, SECONDS_PER_HOUR_BIGINT);
  const remainingSeconds = secondsOfDay - hour * SECONDS_PER_HOUR_BIGINT;
  const minute = floorDiv(remainingSeconds, SECONDS_PER_MINUTE_BIGINT);
  const second = floorMod(remainingSeconds, SECONDS_PER_MINUTE_BIGINT);
  return {
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    minute,
    second,
    subseconds,
  };
}

function withAlignedLocal(
  value: Decimal,
  adjuster: (local: LocalDateTime) => Pick<LocalDateTime, 'year' | 'month' | 'day'>,
): Decimal {
  const local = epochSecondsToLocalDateTime(value);
  const target = adjuster(local);
  return localDateTimeToEpochSeconds({
    ...target,
    hour: 0n,
    minute: 0n,
    second: 0n,
    subseconds: ZERO_DECIMAL,
  });
}

type Step = bigint | number | (bigint | number)[] | undefined;

function alignToStep(v: bigint, step: Step, offset: bigint = 0n): bigint {
  if (!step) return v;

  if (Array.isArray(step)) {
    return (
      step
        .map((x) => BigInt(x))
        .filter((x) => x <= v)
        .toSorted()
        .at(-1) ?? v
    );
  } else {
    step = BigInt(step);
    return ((v - offset) / step) * step + offset;
  }
}

function nextToStep(v: bigint, step: Step, offset: bigint = 0n): bigint | undefined {
  if (!step) return v;

  if (Array.isArray(step)) {
    return step
      .map((x) => BigInt(x))
      .filter((x) => v < x)
      .toSorted()
      .at(0);
  } else {
    step = BigInt(step);
    return ((v - offset) / step + 1n) * step + offset;
  }
}

export function alignToDay(value: Decimal, step?: Step): Decimal {
  return withAlignedLocal(value, (local) => ({
    ...normalizeDate(local.year, local.month, alignToStep(local.day, step, 1n)),
  }));
}

export function nextDay(value: Decimal, step?: Step): Decimal {
  return withAlignedLocal(value, (local) => {
    const next = nextToStep(local.day, step, 1n);
    if (!next) {
      return normalizeMonth(local.year, nextToStep(local.month, 1n, 1n)!);
    }
    return normalizeDate(local.year, local.month, next);
  });
}

export function alignToMonth(value: Decimal, step?: Step): Decimal {
  return withAlignedLocal(value, (local) => normalizeMonth(local.year, alignToStep(local.month, step, 1n)));
}

export function nextMonth(value: Decimal, step?: Step): Decimal {
  return withAlignedLocal(value, (local) => normalizeMonth(local.year, nextToStep(local.month, step, 1n)!));
}

export function alignToYear(value: Decimal, step?: Step): Decimal {
  return withAlignedLocal(value, (local) => {
    const year = local.year <= 0n ? local.year - 1n : local.year;
    const aligned = alignToStep(year, step, 0n);

    return { year: aligned <= 0n ? aligned + 1n : aligned, month: 1n, day: 1n };
  });
}

export function nextYear(value: Decimal, step?: Step): Decimal {
  return withAlignedLocal(value, (local) => {
    const year = local.year <= 0n ? local.year - 1n : local.year;
    const aligned = nextToStep(year, step)!;

    return { year: aligned <= 0n ? aligned + 1n : aligned, month: 1n, day: 1n };
  });
}

export function alignToSecond(value: Decimal, align: Decimal | bigint | number): Decimal {
  const step = Decimal(align);
  const dayStart = alignToDay(value, 1n);
  return value.sub(dayStart).floorBy(step).add(dayStart);
}

export function addSeconds(value: Decimal, seconds: number | Decimal): Decimal {
  return value.add(Decimal(seconds));
}
