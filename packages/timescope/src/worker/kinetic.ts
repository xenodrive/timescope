type Point = { x: number; y: number; t: number };

// re-implements almost-equivalent version of ol/Kinetic class
export class Kinetic {
  private decay: number;
  private minVelocity: number;
  private delay: number;

  private points: Point[] = [];
  private angle_: number = 0;
  private distance_: number = 0;

  constructor(decay: number = 0.005, minVelocity: number = 0.05, delay: number = 100) {
    this.decay = decay;
    this.minVelocity = minVelocity;
    this.delay = delay;
  }

  begin(): void {
    this.points = [];
  }

  update(x: number, y: number): void {
    const now = Date.now();
    this.points.push({ x, y, t: now });

    const cutoff = now - this.delay;
    while (this.points.length > 1 && this.points[0].t < cutoff) {
      this.points.shift();
    }
  }

  end(): boolean {
    const n = this.points.length;
    if (n < 2) return false;

    const cutoff = Date.now() - this.delay;

    const last = this.points[n - 1];
    if (last.t < cutoff) return false;

    while (this.points.length > 1 && this.points[0].t < cutoff) {
      this.points.shift();
    }
    const first = this.points[0];

    // The history is too old
    if (last.t < Date.now() - this.delay) return false;

    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const dt = last.t - first.t;

    // Too quick
    if (dt < 1000 / 60) return false;

    const velocity = Math.sqrt(dx * dx + dy * dy) / dt;

    this.distance_ = velocity / this.decay;
    this.angle_ = Math.atan2(dy, dx);

    return true;
  }

  getDistance(): number {
    return this.distance_;
  }

  getAngle(): number {
    return this.angle_;
  }
}
