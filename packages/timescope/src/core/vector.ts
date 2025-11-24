export class Vector<T extends number[]> {
  values: T;

  constructor(...values: T) {
    this.values = values;
  }

  clone(): this {
    return new (this.constructor as new (...args: T) => this)(...this.values);
  }

  get length() {
    return this.values.length;
  }

  set(...values: T) {
    this.values = values;
    return this;
  }

  add(v: this | number[]) {
    if (!Array.isArray(v)) v = v.values;
    if (v.length !== this.length) throw new Error('Vector size mismatch');
    for (let i = this.length - 1; i >= 0; i--) this.values[i] += v[i];
    return this;
  }

  sub(v: this | number[]) {
    if (!Array.isArray(v)) v = v.values;
    if (v.length !== this.length) throw new Error('Vector size mismatch');
    for (let i = this.length - 1; i >= 0; i--) this.values[i] -= v[i];
    return this;
  }

  scale(s: number) {
    for (let i = this.length - 1; i >= 0; i--) this.values[i] *= s;
    return this;
  }

  get norm() {
    return Math.sqrt(this.values.reduce((acc, val) => acc + val ** 2, 0));
  }

  normalize() {
    const norm = this.norm;
    return norm ? this.scale(1 / norm) : this;
  }

  distanceTo(v: this): number {
    return this.clone().sub(v).norm;
  }
}

export class Vector2f extends Vector<[number, number]> {
  get x() {
    return this.values[0];
  }
  set x(v) {
    this.values[0] = v;
  }

  get y() {
    return this.values[1];
  }
  set y(v) {
    this.values[1] = v;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
    };
  }
}
