import {
  createFlight,
  cross,
  dot,
  normalize,
  flightSettings,
  travelIntensity,
  straightFlight,
  type FlightInput,
  type Vector,
} from './warp-flight';
import type { TravelState } from './time-travel';
import { createWarpBlend, createWarpCruise, warpTiming, type WarpMovement } from './warp-journey';

export const sceneSettings = {
  exposureSamples: 25,
  exposureStride: 2,
  trailExposure: 0.06,
  fieldStars: 1260,
  fieldDepth: 3100,
  behind: 320,
  holeRadius: 90,
  outerRadius: 300,
  longitudinalScale: 0.12,
  fadeStart: 240,
  visibleRadius: 340,
  routeSpacing: 32,
  routeSamples: 110,
  near: 0.5,
  focalScale: 0.9,
  driftSpeedScale: 0.035,
  sizing: {
    shortSide: 365,
    longSide: 1920,
    exponent: 0.75,
    squareHoleReduction: 0.12,
    minimumOuterRatio: 1.8,
  },
  autopilot: {
    strength: 0.9,
    straightDuration: 4,
    turnDuration: 1.8,
    response: 1.8,
  },
};
export const exposureDuration =
  (sceneSettings.exposureSamples - 1) * sceneSettings.exposureStride * flightSettings.step;

export type SceneDimensions = { holeRadius: number; outerRadius: number; maxCurvature: number };
const referenceDimensions: SceneDimensions = {
  holeRadius: sceneSettings.holeRadius,
  outerRadius: sceneSettings.outerRadius,
  maxCurvature: flightSettings.maxCurvature,
};

export function sceneDimensions(width: number, height: number): SceneDimensions {
  if (width <= 0 || height <= 0) return referenceDimensions;
  // Convert screen-sized radii back into world units because projection uses
  // Hero height. The hole follows the short side; the outer wall the long side.
  const { shortSide, longSide, exponent, squareHoleReduction, minimumOuterRatio } = sceneSettings.sizing;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  // Compact Heroes need some closer stars as well as an open center. Ease this
  // adjustment out for wide layouts, rather than special-casing mobile widths.
  const breathingRoom = 1 - squareHoleReduction * (short / long) ** 2;
  const holeScale = (((short / shortSide) ** exponent * shortSide) / height) * breathingRoom;
  const outerScale = ((long / longSide) ** exponent * shortSide) / height;
  const holeRadius = sceneSettings.holeRadius * holeScale;
  const outerRadius = Math.max(sceneSettings.outerRadius * outerScale, holeRadius * minimumOuterRatio);
  return {
    holeRadius,
    outerRadius,
    maxCurvature: Math.min(flightSettings.maxCurvature, flightSettings.maxCurvature / holeScale, 0.9 / outerRadius),
  };
}

export function createFlightScene(
  initialInput: FlightInput | null = { x: 0, y: 0 },
  initialSpeed = 1,
  predictTube = true,
) {
  const tickDistance = flightSettings.speed * flightSettings.step;
  const pastTicks = Math.ceil((sceneSettings.behind + sceneSettings.routeSpacing * 2) / tickDistance);
  const path = Array.from({ length: pastTicks + 1 }, (_, i) => {
    const pose = straightFlight((i - pastTicks) * tickDistance * initialSpeed);
    pose.velocity = pose.velocity.map((value) => value * initialSpeed) as Vector;
    return pose;
  });
  const flight = createFlight(path.at(-1)!);
  // Null hands control to the autopilot; an explicit input always takes priority.
  let input = initialInput;
  let dimensions = referenceDimensions;
  const setDimensions = (value: SceneDimensions) => {
    dimensions = value;
  };
  let phaseElapsed = 0;
  let turning = false;
  let turnIndex = 0;
  let automaticInput: FlightInput = { x: 0, y: 0 };
  let accumulator = 0;
  let travelMode: TravelState['mode'] = 'normal';
  let speedScale = initialSpeed;
  const speedBlend = createWarpBlend(initialSpeed);
  let bidirectional = false;
  let freeNavigation = false;
  let forceTube = false;
  const setTube = (value: boolean) => {
    forceTube = value;
  };
  let travelElapsed = 0;
  let travelTurn = 0;
  let warpPhase: WarpMovement['warpPhase'];
  const randomTurn = (index: number) => {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  let cruise: ReturnType<typeof createWarpCruise> | undefined;
  let bendsEnabled = false;
  let timing = warpTiming();
  const pendingTurn = { x: 0, y: 0 };
  const navigate = (value: FlightInput) => {
    freeNavigation = true;
    bidirectional = true;
    pendingTurn.x += value.x;
    pendingTurn.y += value.y;
  };
  const setTravel = (value: WarpMovement) => {
    const starting =
      value.mode === 'travel' && (travelMode !== 'travel' || (value.warpPhase === 'in' && warpPhase !== 'in'));
    if (starting) {
      travelTurn++;
      travelElapsed = 0;
      phaseElapsed = 0;
      turning = false;
      automaticInput = { x: 0, y: 0 };
      let sample = 0;
      cruise = createWarpCruise(() => randomTurn(travelTurn * 997 + sample++));
    }
    bendsEnabled = (value.distanceYears ?? 0) >= 1000;
    if (value.timing) timing = value.timing;
    else if (value.mode === 'travel') timing = warpTiming(value.distanceYears);
    warpPhase = value.warpPhase;
    travelMode = value.mode;
    const targetSpeed =
      value.dawn >= 1
        ? 0
        : value.mode === 'travel' && warpPhase !== 'out'
          ? value.direction * travelIntensity(value.distanceYears).speedScale
          : sceneSettings.driftSpeedScale;
    speedBlend.set(
      targetSpeed,
      value.mode === 'travel' && warpPhase !== 'out' ? timing.inDuration : timing.outDuration,
      value.transitionResponse,
    );
    // Idle frames repeat the same arc length too. Never interpolate the
    // chronological exposure history as a spatial route after time control.
    bidirectional = true;
  };
  const setInput = (value: FlightInput | null) => {
    if (value === null && input !== null) {
      // Releasing manual control always starts a fresh straight interval.
      phaseElapsed = 0;
      turning = false;
      automaticInput = { x: 0, y: 0 };
    }
    input = value;
  };
  const advance = (delta: number) => {
    accumulator += delta;
    while (accumulator + 1e-10 >= flightSettings.step) {
      let steering = input;
      if (freeNavigation && travelMode !== 'travel') {
        const response = 1 - Math.exp(-6 * flightSettings.step);
        const x = pendingTurn.x * response;
        const y = pendingTurn.y * response;
        pendingTurn.x -= x;
        pendingTurn.y -= y;
        flight.turn(x, y);
        steering = { x: 0, y: 0 };
      }
      const drifting = bidirectional && travelMode !== 'travel';
      if (travelMode === 'travel') {
        travelElapsed += flightSettings.step;
        const straight = warpPhase === 'in' || warpPhase === 'out' || travelElapsed <= timing.inDuration;
        const automatic =
          !straight && (bendsEnabled || travelElapsed >= 1.2) ? cruise!.advance(flightSettings.step) : { x: 0, y: 0 };
        if (straight) steering = { x: 0, y: 0 };
        else if (steering === null) steering = automatic;
      }
      if (steering === null) {
        const { strength, straightDuration, turnDuration, response } = sceneSettings.autopilot;
        phaseElapsed += flightSettings.step * (drifting ? 0.12 : 1);
        const duration = turning ? turnDuration : straightDuration;
        if (phaseElapsed + 1e-10 >= duration) {
          phaseElapsed = Math.max(0, phaseElapsed - duration);
          // Pair some turns directly, then leave a longer straight interval.
          turning = !turning || turnIndex % 2 !== 0;
          if (turning) turnIndex++;
        }
        // Only automatic steering gets this slower transition. Manual input
        // retains the flight model's original, more responsive smoothing.
        const angle = 0.4 + (turnIndex - 1) * 2.39996323;
        const amplitude = turning ? flightSettings.inputRange * strength : 0;
        const blend = 1 - Math.exp(-response * flightSettings.step);
        automaticInput = {
          x: automaticInput.x + (amplitude * Math.cos(angle) - automaticInput.x) * blend,
          y: automaticInput.y + (amplitude * Math.sin(angle) - automaticInput.y) * blend,
        };
        steering = automaticInput;
      }
      const magnitude = Math.max(1, Math.hypot(steering.x, steering.y) / flightSettings.inputRange);
      const curvatureScale = (dimensions.maxCurvature / flightSettings.maxCurvature) * (drifting ? 0.35 : 1);
      speedScale = speedBlend.advance(flightSettings.step);
      path.push(
        flight.step(
          flightSettings.step,
          {
            x: (steering.x / magnitude) * curvatureScale,
            y: (steering.y / magnitude) * curvatureScale,
          },
          speedScale,
          travelMode === 'travel' ? flightSettings.bendResponse : flightSettings.curvatureResponse,
        ),
      );
      accumulator = Math.max(0, accumulator - flightSettings.step);
    }
    const current = path.at(-1)!;
    const exposureTicks = (sceneSettings.exposureSamples - 1) * sceneSettings.exposureStride;
    path.splice(0, Math.max(0, path.length - Math.max(pastTicks + 1, exposureTicks + 1)));
    const history = Array.from({ length: sceneSettings.exposureSamples }, (_, i) =>
      path.at(-1 - i * sceneSettings.exposureStride)!,
    );
    const travel = current.distance;
    // A world-space field needs only camera history. Do not predict a tunnel
    // that is no longer rendered after the user takes over navigation.
    if (travelMode !== 'travel' && !forceTube && (freeNavigation || !predictTube))
      return { history, route: [], travel, routeStart: travel, speedScale };
    const routeStart =
      Math.floor((travel - sceneSettings.behind - sceneSettings.routeSpacing) / sceneSettings.routeSpacing) *
      sceneSettings.routeSpacing;
    // The visible tube extends the current, smoothed curvature. A new pointer
    // target must not instantly snap the distant tunnel into a different shape.
    const predictionInput = {
      x: (current.curvature.x / flightSettings.maxCurvature) * flightSettings.inputRange,
      y: (current.curvature.y / flightSettings.maxCurvature) * flightSettings.inputRange,
    };
    // Exposure history is chronological even in reverse. Route samples must
    // instead remain ordered by arc length; predict both sides from the pose.
    const start = bidirectional
      ? createFlight(current).step((travel - routeStart) / flightSettings.speed, predictionInput, -1)
      : current;
    const prediction = createFlight(start);
    const samples = bidirectional ? [start] : path.slice();
    const curvature = Math.hypot(current.curvature.x, current.curvature.y);
    const visibleAhead = Math.min(
      Math.sqrt(sceneSettings.visibleRadius ** 2 - sceneSettings.holeRadius ** 2) / sceneSettings.longitudinalScale,
      curvature > 0 ? Math.PI / curvature : Infinity,
    );
    const routeSamples = Math.min(
      sceneSettings.routeSamples,
      Math.ceil((travel + visibleAhead - routeStart) / sceneSettings.routeSpacing) + 2,
    );
    const routeEnd = routeStart + (routeSamples - 1) * sceneSettings.routeSpacing;
    while (samples.at(-1)!.distance < routeEnd) samples.push(prediction.step(flightSettings.step, predictionInput));
    let sampleIndex = 1;
    const route = Array.from({ length: routeSamples }, (_, i) => {
      const distance = routeStart + i * sceneSettings.routeSpacing;
      while (samples[sampleIndex].distance < distance) sampleIndex++;
      const before = samples[sampleIndex - 1];
      const after = samples[sampleIndex];
      const fraction = (distance - before.distance) / (after.distance - before.distance);
      const interpolate = (a: Vector, b: Vector) =>
        a.map((value, axis) => value + (b[axis] - value) * fraction) as Vector;
      const direction = normalize(interpolate(before.direction, after.direction));
      const up = normalize(cross(direction, cross(interpolate(before.up, after.up), direction)));
      return { distance, position: interpolate(before.position, after.position), direction, up };
    });
    return { history, route, travel, routeStart, speedScale };
  };
  return { advance, setInput, setDimensions, setTravel, navigate, setTube };
}

export type SceneSnapshot = ReturnType<ReturnType<typeof createFlightScene>['advance']>;
export type Star = { index: number; position: Vector; coordinate: Vector; sector: number };

// Coordinates are intrinsic to the wormhole: X/Y lie outside its empty
// center, and Z is arc length, not global world Z or camera-space depth.
export function effectiveDistance(coordinate: Vector, travel: number, dimensions = referenceDimensions) {
  const radiusSquared = coordinate[0] ** 2 + coordinate[1] ** 2;
  const fraction =
    (radiusSquared - dimensions.holeRadius ** 2) / (dimensions.outerRadius ** 2 - dimensions.holeRadius ** 2);
  const referenceRadiusSquared =
    sceneSettings.holeRadius ** 2 + fraction * (sceneSettings.outerRadius ** 2 - sceneSettings.holeRadius ** 2);
  return Math.sqrt(
    Math.max(0, referenceRadiusSquared) + ((coordinate[2] - travel) * sceneSettings.longitudinalScale) ** 2,
  );
}

function tubePosition(coordinate: Vector, { route, routeStart }: SceneSnapshot): Vector {
  const station = (coordinate[2] - routeStart) / sceneSettings.routeSpacing;
  const index = Math.max(0, Math.min(Math.floor(station), route.length - 2));
  const t = station - index;
  const a = route[index];
  const b = route[index + 1];
  const direction = normalize(a.direction.map((value, axis) => value + (b.direction[axis] - value) * t) as Vector);
  const up = a.up.map((value, axis) => value + (b.up[axis] - value) * t) as Vector;
  const right = normalize(cross(up, direction));
  const vertical = cross(direction, right);
  // Hermite interpolation preserves the centerline tangent at tube stations.
  return a.position.map(
    (value, axis) =>
      (2 * t * t * t - 3 * t * t + 1) * value +
      (t * t * t - 2 * t * t + t) * sceneSettings.routeSpacing * a.direction[axis] +
      (-2 * t * t * t + 3 * t * t) * b.position[axis] +
      (t * t * t - t * t) * sceneSettings.routeSpacing * b.direction[axis] +
      coordinate[0] * right[axis] +
      coordinate[1] * vertical[axis],
  ) as Vector;
}

export function createStarField(seeds: Vector[]) {
  const stars: Star[] = [];
  let count = seeds.length;
  const setCount = (value: number) => {
    count = Math.max(0, Math.min(seeds.length, Math.round(value)));
  };
  let dimensions = referenceDimensions;
  let appliedDimensions = referenceDimensions;
  const setDimensions = (value: SceneDimensions) => {
    dimensions = value;
  };
  const fract = (value: number) => value - Math.floor(value);
  const update = (snapshot: SceneSnapshot) => {
    stars.length = count;
    for (let index = 0; index < count; index++) {
      const seed = seeds[index];
      const sector =
        Math.floor(
          (snapshot.travel - seed[2] * sceneSettings.fieldDepth - sceneSettings.behind) / sceneSettings.fieldDepth,
        ) + 1;
      let coordinate = stars[index]?.coordinate;
      if (!coordinate || stars[index].sector !== sector || appliedDimensions !== dimensions) {
        const angle = fract(seed[0] + sector * 0.75487766) * Math.PI * 2;
        const radius = Math.sqrt(
          dimensions.holeRadius ** 2 +
            (dimensions.outerRadius ** 2 - dimensions.holeRadius ** 2) * fract(seed[1] + sector * 0.56984029),
        );
        coordinate = [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          (seed[2] + sector) * sceneSettings.fieldDepth,
        ];
      }
      const intrinsic = coordinate;
      let position: Vector | undefined;
      stars[index] = {
        index,
        coordinate,
        sector,
        // Range and mobile-budget rejection happens before this is read. Cache
        // the transformation for the remaining visibility/rendering accesses.
        get position() {
          return (position ??= tubePosition(intrinsic, snapshot));
        },
      };
    }
    appliedDimensions = dimensions;
    return stars;
  };
  const visible = (snapshot: SceneSnapshot, width: number, height: number): Star[] => {
    const curvature = Math.hypot(snapshot.history[0].curvature.x, snapshot.history[0].curvature.y);
    return visibleStars(stars, snapshot, width, height, (star) => {
      // The camera cannot see around a full turn of the tube. Otherwise a tight
      // predicted loop would bring distant stations back into the foreground.
      const ahead = Math.max(0, star.coordinate[2] - snapshot.travel);
      return (
        ahead * curvature < Math.PI &&
        effectiveDistance(star.coordinate, snapshot.travel, dimensions) < sceneSettings.visibleRadius
      );
    });
  };
  return { update, visible, setDimensions, setCount };
}

// Free navigation uses fixed world positions. Only stars outside the visible
// shell wrap; turning the camera never bends or rotates their surroundings.
export function createFreeStarField(seeds: Vector[]) {
  const stars: Star[] = [];
  let dimensions = referenceDimensions;
  let count = seeds.length;
  const setDimensions = (value: SceneDimensions) => {
    dimensions = value;
  };
  const setCount = (value: number) => {
    count = Math.min(seeds.length, Math.max(0, Math.round(value)));
  };
  const radius = () => dimensions.outerRadius * 1.5;
  const update = (snapshot: SceneSnapshot) => {
    const camera = snapshot.history[0].position;
    const size = radius() * 2 + 64;
    stars.length = Math.min(stars.length, count);
    for (let index = 0; index < count; index++) {
      const previous = stars[index];
      if (previous && previous.position.every((value, axis) => Math.abs(value - camera[axis]) < size / 2)) continue;
      const position = seeds[index].map((seed, axis) => {
        const cell = Math.floor((camera[axis] - seed * size + size / 2) / size);
        return (seed + cell) * size;
      }) as Vector;
      stars[index] = { index, position, coordinate: position, sector: 0 };
    }
    return stars;
  };
  const visible = (snapshot: SceneSnapshot, width: number, height: number) =>
    visibleStars(stars, snapshot, width, height, (star) => {
      const camera = snapshot.history[0].position;
      const distance = Math.hypot(...star.position.map((value, axis) => value - camera[axis]));
      return distance > dimensions.holeRadius * 0.7 && distance < radius();
    });
  return { update, visible, setCount, setDimensions };
}

function visibleStars(
  stars: Star[],
  { history }: SceneSnapshot,
  width: number,
  height: number,
  withinRange: (star: Star) => boolean,
): Star[] {
  const current = history[0];
  const past =
    history[Math.ceil((sceneSettings.trailExposure * 1.6) / (sceneSettings.exposureStride * flightSettings.step))];
  const right = cross(current.up, current.direction);
  const pastRight = cross(past.up, past.direction);
  const focal = height * sceneSettings.focalScale;
  const halfWidth = width / 2 + 32;
  const halfHeight = height / 2 + 32;
  const limit = width < 640 ? Math.floor(stars.length * 0.45) : stars.length;
  const result: Star[] = [];
  for (let index = 0; index < limit; index++) {
    const star = stars[index];
    if (!withinRange(star)) continue;
    const relative = star.position.map((value, axis) => value - current.position[axis]) as Vector;
    const depth = dot(relative, current.direction);
    if (depth <= sceneSettings.near) continue;
    const pastRelative = star.position.map((value, axis) => value - past.position[axis]) as Vector;
    const pastDepth = Math.max(sceneSettings.near, dot(pastRelative, past.direction));
    const headX = (dot(relative, right) * focal) / depth;
    const headY = (dot(relative, current.up) * focal) / depth;
    const tailX = (dot(pastRelative, pastRight) * focal) / pastDepth;
    const tailY = (dot(pastRelative, past.up) * focal) / pastDepth;
    if (Math.min(headX, tailX) > halfWidth || Math.max(headX, tailX) < -halfWidth) continue;
    if (Math.min(headY, tailY) > halfHeight || Math.max(headY, tailY) < -halfHeight) continue;
    result.push(star);
  }
  return result;
}
