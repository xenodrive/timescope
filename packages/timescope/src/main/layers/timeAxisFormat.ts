import {
  scaleTimeUnit,
  type TimeAxisTick,
  type TimeFormatFuncOptions,
  type TimeFormatLabeler,
  type TimeFormatLabelerOptions,
  type TickLabel,
  type TimescopeTimeAxisOptions,
} from '#src/main/timeAxis';
import { Calendar } from '@kikuchan/calendar';

function toSmallDigits(s: string) {
  return s.replace(/[0-9]/g, (v) => String.fromCodePoint(v.charCodeAt(0) - 48 + '₀'.charCodeAt(0)));
}
function formatRelative({ time, digits }: TimeFormatFuncOptions, labeler?: TimeFormatLabeler): string {
  const opts: TimeFormatLabelerOptions = {
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
    return labeler?.seconds?.(opts) ?? parts[0] + '.' + toSmallDigits(parts[1]);
  }
  return labeler?.seconds?.(opts) ?? time.toString();
}
function formatCalendar(opts: TimeFormatFuncOptions & { timeZone?: string }, labeler: TimeFormatLabeler = {}): string {
  const { time, unit } = opts;
  const {
    year,
    month,
    day,
    hour,
    minutes: minute,
    seconds,
    weekday,
  } = Calendar.fromEpoch(scaleTimeUnit(time, unit, 's'))
    .zone(opts.timeZone ?? 'local')
    .components();
  const [secondIntegral, subseconds] = seconds.split();
  const second = secondIntegral.integer();
  const week = weekday;
  const quarter = Math.floor((Number(month) - 1) / 3) + 1;
  const pad2 = (value: number | bigint) => value.toString().padStart(2, '0');
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
    digits: opts.digits,
    time,
  };
  const formatYear = labeler.year ?? (() => (year > 0n ? year.toString() : ` ${1n - year} BC`));
  const formatQuarter = labeler.quarter ?? (() => (quarter === 1 ? `${formatYear(lopts)} Q${quarter}` : `Q${quarter}`));
  const formatMonth = labeler.month ?? (() => `${formatYear(lopts)}/${pad2(month)}`);
  const formatDate =
    labeler.date ?? (() => `${pad2(month)}/${pad2(day)}(${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][week]})`);
  const formatMinutes = labeler.minutes ?? (() => `${pad2(hour)}:${pad2(minute)}`);
  const digits = opts.digits > 0 ? '.' + toSmallDigits(subseconds.toFixed(opts.digits).split('.')[1]) : '';
  const formatSeconds = labeler.seconds ?? (() => `${pad2(hour)}:${pad2(minute)}:${pad2(second)}${digits}`);
  switch (opts.level) {
    case 'subsecond':
    case 'second':
      return hour === 0n && minute === 0n && second === 0n && subseconds.eq(0)
        ? formatDate(lopts)
        : formatSeconds(lopts);
    case 'minute':
    case 'hour':
      return hour === 0n && minute === 0n ? formatDate(lopts) : formatMinutes(lopts);
    case 'day':
      return formatDate(lopts);
    case 'month':
      return opts.stride === 3n ? formatQuarter(lopts) : formatMonth(lopts);
    default:
      return formatYear(lopts);
  }
}
export function formatTick(tick: TimeAxisTick, options: TimescopeTimeAxisOptions): TickLabel {
  const { format, ...label } = tick;
  if (!format) return { ...label, text: '' };
  const custom = typeof options.timeFormat === 'function' ? options.timeFormat : undefined;
  const labeler = typeof options.timeFormat !== 'function' ? options.timeFormat : undefined;
  return {
    ...label,
    text:
      custom?.(format) ??
      (format.level === 'relative' ? formatRelative(format, labeler) : formatCalendar(format, labeler)),
  };
}
