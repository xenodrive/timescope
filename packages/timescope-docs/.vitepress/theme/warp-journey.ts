import { flightSettings, type FlightInput } from './warp-flight';
import type { TravelState } from './time-travel';

export const warpSettings = {
  // Entry + exit together fit Timescope's default setTime animation (500 ms).
  inDuration: 0.25,
  outDuration: 0.25,
  bendRate: 1.5,
  minimumStraight: 0.25,
  minimumBend: 0.8,
  maximumBend: 1.6,
};
export function warpTiming(distanceYears = 0, travelSeconds = 0) {
  // Nearby hops should not linger. Sustained travel keeps the full transition
  // so a curve still has time to straighten before exiting.
  const strength =
    travelSeconds >= 1.2 ? 1 : Math.min(1, Math.max(0, Math.log10(Math.max(100, distanceYears) / 100) / 2));
  // 75 ms left only a handful of frames for nearby hops. Keep enough frames
  // to ease both ends while entry + exit still fit the 500 ms total budget.
  const inDuration = 0.15 + (warpSettings.inDuration - 0.15) * strength;
  const outDuration = 0.15 + (warpSettings.outDuration - 0.15) * strength;
  return { inDuration, outDuration };
}
export type WarpMovement = TravelState & {
  transitionResponse?: number;
  warpPhase?: 'idle' | 'in' | 'cruise' | 'out';
  timing?: ReturnType<typeof warpTiming>;
};
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  // Zero first/second derivatives at both ends keep straight/bend joins smooth.
  return t * t * t * (10 + t * (-15 + 6 * t));
};

// Shared by camera speed and field opacity: use the whole finite duration,
// rather than exponential damping that front-loads almost all of the change.
export function createWarpBlend(initial: number) {
  let value = initial;
  let origin = initial;
  let target = initial;
  let elapsed = 0;
  let duration = 0;
  let velocity = 0;
  let initialVelocity = 0;
  let response = 0;
  const set = (next: number, seconds: number, damping = 0) => {
    if (next === target) return;
    origin = value;
    initialVelocity = velocity;
    target = next;
    elapsed = 0;
    duration = seconds;
    response = damping;
  };
  const advance = (delta: number) => {
    elapsed += delta;
    if (response > 0) {
      value += (target - value) * (1 - Math.exp(-response * delta));
      if (Math.abs(target - value) < 0.00001) value = target;
      velocity = (target - value) * response;
      return value;
    }
    if (duration > 0 && elapsed + 1e-10 < duration) {
      const t = elapsed / duration;
      value =
        origin + (target - origin) * ease(t) + initialVelocity * duration * (t - 6 * t ** 3 + 8 * t ** 4 - 3 * t ** 5);
      velocity =
        ((target - origin) * 30 * t * t * (1 - t) ** 2) / duration +
        initialVelocity * (1 - 18 * t * t + 32 * t ** 3 - 15 * t ** 4);
    } else {
      value = target;
      velocity = 0;
    }
    return value;
  };
  return { set, advance };
}

// Exponential waiting times give a fixed chance per second, independent of FPS.
// There is no trip-wide budget or limit on the number of bends.
export function createWarpCruise(random = Math.random) {
  const straightDuration = () => warpSettings.minimumStraight - Math.log(1 - random()) / warpSettings.bendRate;
  let duration = straightDuration();
  let elapsed = 0;
  let turning = false;
  let angle = random() * Math.PI * 2;
  const advance = (delta: number): FlightInput => {
    elapsed += delta;
    while (elapsed >= duration) {
      elapsed -= duration;
      turning = !turning;
      if (turning) {
        duration = warpSettings.minimumBend + random() * (warpSettings.maximumBend - warpSettings.minimumBend);
        angle += Math.PI * (0.75 + random() * 0.5);
      } else duration = straightDuration();
    }
    if (!turning) return { x: 0, y: 0 };
    const direction = angle + Math.PI * 0.25 * (ease(elapsed / duration) - 0.5);
    // Spend a visible part of each bend entering/exiting, not just 80 ms.
    // Keep a full-strength middle so smooth transitions do not weaken the turn.
    const transition = Math.min(0.45, duration * 0.4);
    const amplitude = flightSettings.inputRange * ease(Math.min(elapsed, duration - elapsed) / transition);
    return { x: amplitude * Math.cos(direction), y: amplitude * Math.sin(direction) };
  };
  return { advance };
}

// Entry/exit depend on trip distance, not a total budget. Cruise has no deadline.
export function createWarpJourney() {
  let requested: TravelState = { mode: 'normal', direction: 1, dawn: 0 };
  let flight = requested;
  let elapsed = 0;
  let travelSeconds = 0;
  let timing = warpTiming();
  let phase: NonNullable<WarpMovement['warpPhase']> = 'idle';
  const set = (value: TravelState) => {
    if (value.mode === 'travel') {
      if (phase === 'idle' || phase === 'out') {
        elapsed = 0;
        travelSeconds = 0;
        phase = 'in';
      }
      flight = value;
      timing = warpTiming(value.distanceYears, travelSeconds);
    } else if (phase === 'cruise') {
      elapsed = 0;
      phase = 'out';
    }
    requested = value;
    if (value.dawn >= 1) {
      phase = 'idle';
    }
  };
  const advance = (delta: number): WarpMovement & { timing: ReturnType<typeof warpTiming> } => {
    elapsed += delta;
    if (phase === 'in' || phase === 'cruise') {
      travelSeconds += delta;
      timing = warpTiming(flight.distanceYears, travelSeconds);
    }
    if (phase === 'in' && elapsed + 1e-10 >= timing.inDuration) {
      elapsed -= timing.inDuration;
      phase = requested.mode === 'travel' ? 'cruise' : 'out';
    }
    if (phase === 'out' && elapsed + 1e-10 >= timing.outDuration) phase = 'idle';
    return phase === 'idle'
      ? { ...requested, warpPhase: phase, timing }
      : { ...flight, dawn: requested.dawn, warpPhase: phase, timing };
  };
  return { set, advance };
}
