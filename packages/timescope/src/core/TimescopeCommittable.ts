import { TimescopeAnimation, type TimescopeAnimationInput, type TimescopeAnimationType } from '#src/core/animation';
import { Decimal, type NumberLike } from '#src/core/decimal';
import { TimescopeEvent, TimescopeObservable } from '#src/core/event';
import type { TimeRangeInput, TimescopeRange } from '#src/core/range';

type TimescopeCommittableOptions<N extends null> = {
  domain?: TimeRangeInput;
  initialValue: NumberLike | Decimal | N;
  onNull?: () => NonNullable<unknown>;
  lazy?: boolean;
};
type TimescopeCommittableCommitOptions<N extends null> = {
  value?: Decimal | N;
  animation?: TimescopeAnimationType | false;
  duration?: number;
  lazy?: boolean;
};

type TimescopeCommittableMessageBegin<N extends null> = {
  type: 'begin';
  candidate: Decimal | N;
};
type TimescopeCommittableMessageUpdate<N extends null> = {
  type: 'update';
  candidate: Decimal | N;
  current: Decimal;
};
type TimescopeCommittableMessageCommit<N extends null> = {
  type: 'commit';
  targetValue: Decimal | N;
  divergentValue?: Decimal | N;
  animation: TimescopeAnimationType | false;
  duration: number;
  cursorMode: 'current' | 'target';
  lazy: boolean;
};
type TimescopeCommittableMessageSetNullValue = {
  type: 'set:nullvalue';
  nullValue: Decimal | null;
};

type TimescopeCommittableMessageRestore<N extends null> = {
  type: 'restore';
  value: Decimal | N;
  domain: TimescopeRange<Decimal | N | undefined>;
};

export type TimescopeCommittableMessageSync<N extends null> =
  | TimescopeCommittableMessageBegin<N>
  | TimescopeCommittableMessageUpdate<N>
  | TimescopeCommittableMessageCommit<N>
  | TimescopeCommittableMessageRestore<N>
  | TimescopeCommittableMessageSetNullValue;

function clampToRange<N extends null>(
  value: Decimal | N,
  range: TimescopeRange<Decimal | N | undefined>,
  nullValue: Decimal,
): Decimal | N {
  const compareValue = value ?? nullValue;
  if (range[0] !== undefined) {
    const lower = range[0] ?? nullValue;
    if (compareValue.lt(lower)) return range[0] as Decimal | N;
  }
  if (range[1] !== undefined) {
    const upper = range[1] ?? nullValue;
    if (compareValue.gt(upper)) return range[1] as Decimal | N;
  }
  return value;
}

function Decimal_equals(a: Decimal | null | undefined, b: Decimal | null | undefined) {
  return a === b || (b && a?.eq(b));
}

/*
 | State                             | candidate | current  | committing | value                 | committed |
 | --------------------------------- | --------- | -------- | ---------- | --------------------- | --------- |
 | Stable                            |  ○        |  ○       |  ○         |  ○                    | ○         |
 | After begin                       |  ○        |  ☓       |  ☓         |  ☓                    | ☓         |
 | During update                     |  ○        |  △       |  ☓         |  ☓                    | ☓         |
 | During commit (animation running) |  ○        |  △       |  ○         |  ○ (!lazy) / ☓ (lazy) | ☓         |
 | After commit (animation finished) |  ○        |  ○       |  ○         |  ○                    | ○         |
*/

export class TimescopeCommittable<N extends null = null> extends TimescopeObservable<
  | TimescopeEvent<'valuechanging', Decimal | N>
  | TimescopeEvent<'valuechanged', Decimal | N>
  | TimescopeEvent<'valueanimating', Decimal | N>
  | TimescopeEvent<'sync', TimescopeCommittableMessageSync<N>>
> {
  #lazy: boolean;

  #state = {
    id: undefined as string | undefined,
    value: null as Decimal | N,
    nullValue: null as Decimal | null,
    committed: null as Decimal | N,
    committing: null as Decimal | N,
    current: null as Decimal | N,
    candidate: null as Decimal | N,

    domain: [undefined, undefined] as TimescopeRange<Decimal | N | undefined>,

    editing: false as boolean,
    animating: false as boolean,
    cursorMode: 'current' as 'current' | 'target',

    updated: false as boolean,
  };

  #timeAnimation = new TimescopeAnimation();
  #onNull?: () => NonNullable<unknown>;

  get candidate() {
    return this.#state.candidate;
  }

  get value() {
    return this.#state.value;
  }

  get committing() {
    return this.#state.committing;
  }

  parseValue(v: unknown): Decimal | N {
    return Decimal(v as NumberLike);
  }

  setValue(v: unknown, animation?: TimescopeAnimationInput) {
    const value = this.parseValue(v);
    if (Decimal_equals(this.#state.value, value)) return;
    if (animation == null) animation = false;
    const opts = typeof animation === 'object' ? animation : { animation };
    this.begin(value);
    this.commit(opts);
  }

  get committed() {
    return this.#state.committed;
  }

  get current() {
    return this.#state.current;
  }

  get domain(): TimescopeRange<Decimal | N | undefined> {
    return this.#state.domain;
  }

  set domain(domain: TimescopeRange<NumberLike | N | undefined>) {
    const domain_ = domain.map((entry) => Decimal(entry)) as TimescopeRange<Decimal | N | undefined>;
    if (Decimal_equals(this.#state.domain[0], domain_[0]) && Decimal_equals(this.#state.domain[1], domain_[1])) return;
    this.#state.domain = domain_;
    this.restore();
    this.setValue(clampToRange(this.value, domain_, this.nullValue));
    this.changed();
  }

  get editing() {
    return this.#state.editing;
  }

  get animating() {
    return this.#state.animating;
  }

  get cursor() {
    return this.#state.cursorMode === 'current' ? this.#state.current : this.#state.committing;
  }

  constructor(opts: TimescopeCommittableOptions<N> = { initialValue: 0 as NumberLike }) {
    super();
    if (opts.domain) {
      this.#state.domain = opts.domain.map((entry) => Decimal(entry)) as TimescopeRange<Decimal | N | undefined>;
    }

    if (opts.onNull) {
      this.#onNull = opts.onNull;
    }
    this.#lazy = opts.lazy ?? false;

    const initialDecimal = Decimal(opts.initialValue) as Decimal | N;
    const value = clampToRange(initialDecimal, this.#state.domain, this.nullValue);
    this.#state.value = value;
    this.#state.committed = value;
    this.#state.current = value;
    this.#state.candidate = value;
    this.#state.committing = value;
  }

  handleSyncEvent(msg: TimescopeCommittableMessageSync<N>) {
    switch (msg.type) {
      case 'begin':
        this.#begin(msg);
        break;
      case 'update':
        this.#update(msg);
        break;
      case 'commit':
        this.#commit(msg);
        break;
      case 'restore':
        this.#restore(msg);
        break;
      case 'set:nullvalue':
        this.#setNullValue(msg);
        break;
    }
  }

  begin(candidate?: Decimal | N) {
    if (candidate === undefined) candidate = this.#state.current;
    const clamped = clampToRange(candidate, this.#state.domain, this.nullValue);

    const message: TimescopeCommittableMessageBegin<N> = { type: 'begin', candidate: clamped };
    this.dispatchEvent(new TimescopeEvent('sync', message));
    this.dispatchEvent(new TimescopeEvent('valuechanging', clamped));
    this.#begin(message);
  }

  #begin({ candidate }: TimescopeCommittableMessageBegin<N>) {
    this.#timeAnimation.cancel();
    this.#state.cursorMode = 'current';
    this.#state.editing = true;
    this.#state.updated = false;
    this.#state.candidate = candidate;

    this.dispatchEvent(new TimescopeEvent('valuechanging', candidate));
    this.changed();
  }

  update(candidate: Decimal | N) {
    const nullValue = this.nullValue;
    const clamped = clampToRange(candidate, this.#state.domain, nullValue);
    const current = (candidate ?? nullValue)
      .sub(this.#state.current ?? nullValue)
      .mul(clamped === candidate ? 1 : 0.5)
      .add(this.#state.current ?? nullValue)
      .round((candidate ?? nullValue).digits);

    const message: TimescopeCommittableMessageUpdate<N> = { type: 'update', candidate: clamped, current };
    this.dispatchEvent(new TimescopeEvent('sync', message));
    this.#update(message);
  }

  #update({ candidate, current }: TimescopeCommittableMessageUpdate<N>) {
    this.#state.editing = true;
    this.#state.updated = true;
    this.#state.candidate = candidate;
    this.#state.current = current;

    this.dispatchEvent(new TimescopeEvent('valuechanging', candidate));
    this.dispatchEvent(new TimescopeEvent('valueanimating', this.#state.current));
    this.changed();
  }

  commit(opts: TimescopeCommittableCommitOptions<N> = {}) {
    const value = opts.value !== undefined ? opts.value : this.#state.candidate;
    const divergentValue = value;
    const targetValue = clampToRange(value, this.#state.domain, this.nullValue);
    const cursorMode =
      opts.animation === undefined ? (this.#state.updated ? 'current' : 'target') : this.#state.cursorMode;
    const animation = opts.animation === undefined ? (this.#state.editing ? 'out' : 'in-out') : opts.animation;
    const duration = opts.duration ?? 500;

    const message: TimescopeCommittableMessageCommit<N> = {
      type: 'commit',
      targetValue,
      animation,
      duration,
      cursorMode,
      divergentValue,
      lazy: opts.lazy ?? this.#lazy,
    };
    this.dispatchEvent(new TimescopeEvent('sync', message));
    this.#commit(message);
  }

  #commit({
    targetValue,
    divergentValue,
    animation,
    duration,
    cursorMode,
    lazy,
  }: TimescopeCommittableMessageCommit<N>) {
    const changeValue = () => {
      this.#state.value = targetValue;
      this.#state.editing = false;

      this.dispatchEvent(new TimescopeEvent('valuechanging', this.#state.value));
      this.dispatchEvent(new TimescopeEvent('valuechanged', this.#state.value));
      this.changed();
    };

    const nullValue = this.nullValue;
    const originValue = this.#state.current ?? nullValue;
    const a = targetValue ?? nullValue;
    const b = divergentValue ?? nullValue;

    let overshoot = 0;
    if (a.neq(b) && b.neq(originValue)) {
      const alpha = b.sub(originValue).div(a.sub(originValue));
      overshoot = (3 * (alpha.number() - 1)) / 2;
    }

    this.#state.cursorMode = cursorMode;
    this.#state.candidate = targetValue;
    this.#state.committing = targetValue;
    if (!lazy) changeValue();

    const target = a.eq(originValue) ? 0 : 1;

    this.#state.animating = true;
    this.#timeAnimation.start({
      origin: () => 0,
      target: () => target,

      update: (v) => {
        this.#state.animating = true;
        const current = (targetValue ?? this.nullValue).sub(originValue).mul(v).add(originValue);
        this.#state.current = current;
        this.dispatchEvent(new TimescopeEvent('valueanimating', this.#state.current));
        this.changed();
      },

      done: () => {
        this.#state.animating = false;
        this.#state.current = targetValue;
        if (lazy) changeValue();
        this.#state.committed = targetValue;
        this.dispatchEvent(new TimescopeEvent('valueanimating', this.#state.current));
        this.changed();
      },

      animation,
      duration,
      overshoot,
    });
  }

  #setNullValue({ nullValue }: TimescopeCommittableMessageSetNullValue) {
    this.#state.nullValue = nullValue;
    this.changed();
  }

  setNullValue(nullValue: Decimal | null) {
    const message: TimescopeCommittableMessageSetNullValue = {
      type: 'set:nullvalue',
      nullValue,
    };
    this.dispatchEvent(new TimescopeEvent('sync', message));
    this.#setNullValue(message);
  }

  get nullValue(): Decimal {
    return this.#state.nullValue ?? this.parseValue(this.#onNull?.()) ?? Decimal(0);
  }

  toString() {
    return JSON.stringify(this);
  }

  toJSON() {
    return {
      value: this.value,
      candidate: this.candidate,
      committed: this.committed,
      committing: this.committing,
      current: this.current,
      editing: this.editing,
      animating: this.animating,
    };
  }

  #restore({ value, domain }: TimescopeCommittableMessageRestore<N>) {
    this.#timeAnimation.cancel();

    this.#state.cursorMode = 'current';
    this.#state.value = value;
    this.#state.candidate = value;
    this.#state.committed = value;
    this.#state.committing = value;
    this.#state.current = value;
    this.#state.editing = false;
    this.#state.animating = false;

    this.#state.domain = domain;
  }

  restore() {
    const message: TimescopeCommittableMessageRestore<N> = {
      type: 'restore',
      value: this.value,
      domain: this.#state.domain,
    };
    this.dispatchEvent(new TimescopeEvent('sync', message));
    this.#restore(message);
  }
}
