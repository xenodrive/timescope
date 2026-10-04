import { flightSettings, type FlightInput } from './warp-flight';
import type { TravelState } from './time-travel';

export const warpSettings = {
  inDuration: 0.2,
  outDuration: 0.2,
  bendRate: 1.5,
  minimumStraight: 0.25,
  minimumBend: 0.8,
  maximumBend: 1.6,
};
export type WarpMovement = TravelState & { warpPhase?: 'idle' | 'in' | 'cruise' | 'out' };
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  // Zero first/second derivatives at both ends keep straight/bend joins smooth.
  return t * t * t * (10 + t * (-15 + 6 * t));
};

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

// Only entry/exit have fixed durations. Cruise lasts as long as selection moves.
export function createWarpJourney() {
  let requested: TravelState = { mode: 'normal', direction: 1, dawn: 0 };
  let flight = requested;
  let elapsed = 0;
  let phase: NonNullable<WarpMovement['warpPhase']> = 'idle';
  const set = (value: TravelState) => {
    if (value.mode === 'travel') {
      if (phase === 'idle' || phase === 'out') {
        elapsed = 0;
        phase = 'in';
      }
      flight = value;
    } else if (phase === 'cruise') {
      elapsed = 0;
      phase = 'out';
    }
    requested = value;
    if (value.dawn >= 1) {
      phase = 'idle';
    }
  };
  const advance = (delta: number): WarpMovement => {
    elapsed += delta;
    if (phase === 'in' && elapsed + 1e-10 >= warpSettings.inDuration) {
      elapsed -= warpSettings.inDuration;
      phase = requested.mode === 'travel' ? 'cruise' : 'out';
    }
    if (phase === 'out' && elapsed + 1e-10 >= warpSettings.outDuration) phase = 'idle';
    return phase === 'idle'
      ? { ...requested, warpPhase: phase }
      : { ...flight, dawn: requested.dawn, warpPhase: phase };
  };
  return { set, advance };
}
