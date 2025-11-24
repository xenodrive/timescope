export type TimescopeTrackOptions = {
  id: string;
  oy: number;
  height?: number;
  symmetric?: boolean;
  labelHeight?: number;

  seriesKeys: string[];
};

export class TimescopeTrack {
  id: string;

  height: number;
  symmetric: boolean;
  oy: number = 0;

  paddingY = [5, 5];
  labelHeight = 0;

  seriesKeys: string[];

  constructor(opts: TimescopeTrackOptions) {
    this.id = opts.id;
    this.oy = opts.oy ?? 0;
    this.height = opts.height ?? 0;
    this.symmetric = opts.symmetric ?? false;
    this.labelHeight = opts.labelHeight ?? 0;

    this.seriesKeys = opts.seriesKeys;
  }

  get chartHeight() {
    return this.height - this.paddingY[0] - this.paddingY[1] - this.labelHeight;
  }

  get axisY() {
    return (this.symmetric ? this.chartHeight / 2 : this.chartHeight) + this.paddingY[0];
  }

  y(value: number | null | undefined) {
    if (value == null || isNaN(value)) return NaN;
    const resolution = this.symmetric ? this.chartHeight / 2 : this.chartHeight;
    return this.axisY - resolution * value;
  }

  getRenderers() {
    return [];
  }
}
