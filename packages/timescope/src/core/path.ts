export const PathCommand = {
  moveTo: 0,
  lineTo: 1,
  bezierCurveTo: 2,
  closePath: 3,
} as const;

export type TimescopePathCommands = {
  values: Float64Array;
  length: number;
};
