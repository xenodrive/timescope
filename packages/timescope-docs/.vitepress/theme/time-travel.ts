import { Calendar, type Decimal } from 'timescope';

export const travelSettings = {
  universeYears: 13_800_000_000,
  dawnYears: 100_000_000,
  secondsPerYear: 365.2425 * 86400,
  inactivityMs: 700,
};
export type TravelState = {
  activity?: number;
  mode: 'normal' | 'travel' | 'stopped';
  direction: 1 | -1;
  dawn: number;
  year?: number;
  distanceYears?: number;
};
export const normalTravel: TravelState = { mode: 'normal', direction: 1, dawn: 0 };
export const birthYear =
  Number(
    Calendar.fromEpoch(Date.now() / 1000)
      .utc()
      .year(),
  ) - travelSettings.universeYears;
export const birthTime = Calendar.fromComponents({ year: birthYear, month: 1, day: 1, zone: 'utc' }).epoch();
export const timeRange: [Decimal, undefined] = [birthTime, undefined];
export const yearOf = (time: Decimal | null) =>
  Number(
    Calendar.fromEpoch(time ?? Date.now() / 1000)
      .utc()
      .year(),
  );
export function dawnOf(year: number) {
  const progress = Math.max(0, Math.min(1, (year - birthYear) / travelSettings.dawnYears));
  return 1 - progress * progress * (3 - 2 * progress);
}
export function pickerZoom(width: number, years: number) {
  return Math.log2(Math.max(1, width) / (travelSettings.secondsPerYear * years));
}
