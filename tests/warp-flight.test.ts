import { expect, test } from "vitest";
import {
  createFlight,
  flightSettings,
  straightFlight,
  type FlightInput,
  type Vector,
} from "../packages/timescope-docs/.vitepress/theme/warp-flight";
import {
  createFlightScene,
  createStarField,
  effectiveDistance,
  exposureDuration,
  sceneSettings,
  sceneDimensions,
} from "../packages/timescope-docs/.vitepress/theme/warp-scene";

const neutral = { x: 0, y: 0 };
const distance = (a: Vector, b: Vector) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const dot = (a: Vector, b: Vector) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

test("Hero short-side adaptation preserves reference dimensions and mobile hole coverage", () => {
  const referenceDimensions = sceneDimensions(1920, 365);
  expect(referenceDimensions.holeRadius).toBeCloseTo(90, 0);
  expect(referenceDimensions.outerRadius).toBe(300);
  expect(referenceDimensions.maxCurvature).toBe(0.003);
  expect(sceneDimensions(0, 0)).toEqual({ holeRadius: 90, outerRadius: 300, maxCurvature: 0.003 });
  const scene = createFlightScene();
  const snapshot = scene.advance(0);
  const field = createStarField([[0, 0, 400 / sceneSettings.fieldDepth]]);
  const reference = field.update(snapshot)[0];
  const referenceX =
    (reference.position[0] * 365 * sceneSettings.focalScale) / reference.position[2] / 365;
  const dimensions = sceneDimensions(390, 650);
  field.setDimensions(dimensions);
  const mobile = field.update(snapshot)[0];
  const mobileX = (mobile.position[0] * 650 * sceneSettings.focalScale) / mobile.position[2] / 390;
  expect(mobileX / referenceX).toBeGreaterThan(0.85);
  expect(mobileX / referenceX).toBeLessThan(1);
  expect(Math.hypot(mobile.coordinate[0], mobile.coordinate[1])).toBeCloseTo(
    dimensions.holeRadius,
    10,
  );
  expect(effectiveDistance(mobile.coordinate, snapshot.travel, dimensions)).toBeCloseTo(
    effectiveDistance(reference.coordinate, snapshot.travel),
    10,
  );
});

test("resizing the star field changes only transverse radii without recycling or resetting flight", () => {
  const scene = createFlightScene();
  scene.setInput({ x: 1, y: 0.3 });
  const snapshot = scene.advance(1);
  const field = createStarField([[0.25, 0.7, 0.4]]);
  const reference = field.update(snapshot)[0];
  field.setDimensions(sceneDimensions(390, 650));
  const portrait = field.update(snapshot)[0];
  expect(portrait.coordinate[2]).toBe(reference.coordinate[2]);
  expect(portrait.sector).toBe(reference.sector);
  field.setDimensions(sceneDimensions(0, 0));
  expect(field.update(snapshot)[0].position).toEqual(reference.position);
  expect(scene.advance(0)).toEqual(snapshot);
});

test("adaptive radii leave room for stars and bound tight turns without changing travel speed", () => {
  for (const [width, height] of [
    [390, 650],
    [650, 390],
    [1920, 365],
    [3840, 730],
    [3000, 365],
  ]) {
    const dimensions = sceneDimensions(width, height);
    expect(dimensions.outerRadius).toBeGreaterThanOrEqual(
      dimensions.holeRadius * sceneSettings.sizing.minimumOuterRatio,
    );
    expect(dimensions.outerRadius * dimensions.maxCurvature).toBeLessThanOrEqual(0.9 + 1e-10);
    const scene = createFlightScene();
    scene.setDimensions(dimensions);
    scene.setInput({ x: 20, y: 20 });
    const snapshot = scene.advance(4);
    expect(
      Math.hypot(snapshot.history[0].curvature.x, snapshot.history[0].curvature.y),
    ).toBeCloseTo(dimensions.maxCurvature, 9);
    expect(snapshot.travel).toBeCloseTo(flightSettings.speed * 4, 7);
  }
  expect(sceneDimensions(3000, 365).outerRadius).toBeGreaterThan(300);
});

test("neutral input follows a straight wormhole at constant arc-length speed without autopilot", () => {
  const { history, travel } = createFlightScene().advance(30);
  expect(history[0].direction).toEqual([0, 0, 1]);
  expect(history[0].up).toEqual([0, 1, 0]);
  expect(distance(history[0].position, [0, 0, flightSettings.speed * 30])).toBeLessThan(1e-7);
  expect(travel).toBeCloseTo(flightSettings.speed * 30, 7);
});

test("autopilot makes large turns independently of render frame timing and settles during straight intervals", () => {
  const duration =
    sceneSettings.autopilot.straightDuration + sceneSettings.autopilot.turnDuration / 2;
  const whole = createFlightScene(null).advance(duration);
  const scene = createFlightScene(null);
  let divided = scene.advance(0);
  for (let i = 0; i < Math.round(duration * 30); i++) divided = scene.advance(1 / 30);
  expect(distance(whole.history[0].position, divided.history[0].position)).toBeLessThan(1e-8);
  expect(whole.travel).toBeCloseTo(flightSettings.speed * duration, 7);
  expect(Math.abs(whole.history[0].curvature.x)).toBeGreaterThan(0.0001);
  expect(Math.abs(whole.history[0].curvature.y)).toBeGreaterThan(0.0001);
  expect(Math.hypot(whole.history[0].curvature.x, whole.history[0].curvature.y)).toBeGreaterThan(
    flightSettings.maxCurvature * 0.6,
  );
  const initial = createFlightScene(null).advance(
    sceneSettings.autopilot.straightDuration - flightSettings.step,
  );
  expect(initial.history[0].direction).toEqual([0, 0, 1]);
  const firstTurn = scene.advance(sceneSettings.autopilot.turnDuration / 2 - flightSettings.step);
  expect(distance(firstTurn.history[0].direction, initial.history[0].direction)).toBeGreaterThan(1);
  const settled = scene.advance(sceneSettings.autopilot.turnDuration + 3);
  expect(Math.hypot(settled.history[0].curvature.x, settled.history[0].curvature.y)).toBeLessThan(
    2e-5,
  );
});

test("manual steering overrides autopilot and release resumes it without snapping the pose", () => {
  const scene = createFlightScene(null);
  scene.advance(sceneSettings.autopilot.straightDuration + 0.5);
  scene.setInput({ x: -flightSettings.inputRange, y: 0 });
  const manual = scene.advance(2);
  expect(manual.history[0].curvature.x).toBeCloseTo(-flightSettings.maxCurvature, 6);
  expect(Math.abs(manual.history[0].curvature.y)).toBeLessThan(1e-7);
  scene.setInput(null);
  const released = scene.advance(0);
  expect(released.history[0]).toEqual(manual.history[0]);
  const firstStep = scene.advance(flightSettings.step);
  expect(distance(firstStep.history[0].direction, manual.history[0].direction)).toBeLessThan(0.02);
  const straight = scene.advance(
    sceneSettings.autopilot.straightDuration - 0.1 - flightSettings.step,
  );
  expect(Math.hypot(straight.history[0].curvature.x, straight.history[0].curvature.y)).toBeLessThan(
    1e-9,
  );
  // Repeated null messages must not postpone automatic flight indefinitely.
  scene.setInput(null);
  const resumed = scene.advance(1.6);
  expect(
    Math.hypot(resumed.history[0].curvature.x, resumed.history[0].curvature.y),
  ).toBeGreaterThan(flightSettings.maxCurvature * 0.8);
});

test("consecutive automatic turns change curvature gradually without a mandatory straight interval", () => {
  const scene = createFlightScene(null);
  const { straightDuration, turnDuration } = sceneSettings.autopilot;
  const before = scene.advance(straightDuration + turnDuration - flightSettings.step).history[0];
  const after = scene.advance(flightSettings.step).history[0];
  expect(Math.hypot(after.curvature.x, after.curvature.y)).toBeGreaterThan(
    flightSettings.maxCurvature * 0.8,
  );
  expect(
    Math.hypot(after.curvature.x - before.curvature.x, after.curvature.y - before.curvature.y),
  ).toBeLessThan(0.00005);
  const nextTurn = scene.advance(0.8).history[0];
  expect(Math.hypot(nextTurn.curvature.x, nextTurn.curvature.y)).toBeGreaterThan(0.001);
  expect(
    Math.hypot(
      nextTurn.curvature.x - before.curvature.x,
      nextTurn.curvature.y - before.curvature.y,
    ),
  ).toBeGreaterThan(0.002);
});

test("out-of-range stars do not transform tube geometry before being rejected", () => {
  const snapshot = createFlightScene().advance(0);
  let geometryReads = 0;
  const tracked = {
    ...snapshot,
    route: new Proxy(snapshot.route, {
      get(target, key, receiver) {
        geometryReads++;
        return Reflect.get(target, key, receiver);
      },
    }),
  };
  const field = createStarField([
    [0, 0, 0.895],
    [0.25, 0.5, 0.895],
  ]);
  field.update(tracked);
  expect(field.visible(tracked, 1200, 365)).toEqual([]);
  expect(geometryReads).toBe(0);
});

test("tube prediction covers visible stations but shortens during tight turns", () => {
  const scene = createFlightScene();
  const straight = scene.advance(0);
  scene.setInput({ x: flightSettings.inputRange, y: 0 });
  const turning = scene.advance(2);
  expect(turning.route.length).toBeLessThan(straight.route.length / 2);
  const curvature = Math.hypot(turning.history[0].curvature.x, turning.history[0].curvature.y);
  expect(turning.route.at(-1)!.distance).toBeGreaterThan(turning.travel + Math.PI / curvature);
  const maxAhead =
    Math.sqrt(sceneSettings.visibleRadius ** 2 - sceneSettings.holeRadius ** 2) /
    sceneSettings.longitudinalScale;
  expect(sceneSettings.fieldDepth - sceneSettings.behind).toBeGreaterThan(maxAhead);
});

test("a held curvature follows the analytical circular centerline, with the nose on its tangent", () => {
  const curvature = flightSettings.maxCurvature;
  const flight = createFlight({ ...straightFlight(), curvature: { x: curvature, y: 0 } });
  const duration = 4;
  const pose = flight.step(duration, { x: flightSettings.inputRange, y: 0 });
  const angle = curvature * flightSettings.speed * duration;
  expect(
    distance(pose.position, [(1 - Math.cos(angle)) / curvature, 0, Math.sin(angle) / curvature]),
  ).toBeLessThan(1e-8);
  expect(distance(pose.direction, [Math.sin(angle), 0, Math.cos(angle)])).toBeLessThan(1e-10);
  expect(distance(pose.up, [0, 1, 0])).toBeLessThan(1e-10);
  expect(pose.distance).toBeCloseTo(flightSettings.speed * duration, 8);
});

test.each<FlightInput>([
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
])("input %j bends in the local tube frame, not global yaw and pitch", (input) => {
  const initial = {
    ...straightFlight(),
    direction: [0, 1, 0] as Vector,
    up: [1, 0, 0] as Vector,
    velocity: [0, flightSettings.speed, 0] as Vector,
  };
  const right = cross(initial.up, initial.direction);
  const desired = right.map((value, i) => value * input.x + initial.up[i] * input.y) as Vector;
  const pose = createFlight(initial).step(0.5, input);
  expect(dot(pose.direction, desired)).toBeGreaterThan(0.2);
  expect(dot(pose.position, desired)).toBeGreaterThan(10);
  expect(dot(pose.velocity, pose.direction)).toBeCloseTo(flightSettings.speed, 9);
});

test("displacement controls curvature magnitude, and diagonal input cannot exceed its limit", () => {
  const half = createFlight().step(0.5, { x: 0.5, y: 0 });
  expect(half.curvature.x).toBeCloseTo(
    (flightSettings.maxCurvature / flightSettings.inputRange) *
      0.5 *
      (1 - Math.exp(-flightSettings.curvatureResponse * 0.5)),
    12,
  );
  const diagonal = createFlight().step(2, { x: 2, y: 2 });
  expect(Math.hypot(diagonal.curvature.x, diagonal.curvature.y)).toBeLessThanOrEqual(
    flightSettings.maxCurvature,
  );
  expect(diagonal.curvature.x).toBeCloseTo(diagonal.curvature.y, 12);
});

test("reversal changes curvature smoothly instead of snapping the tube or camera", () => {
  const flight = createFlight();
  const before = flight.step(2, { x: 1, y: 0 });
  expect(flight.step(0, { x: -1, y: 0 })).toEqual(before);
  expect(flight.step(0.01, { x: -1, y: 0 }).curvature.x).toBeGreaterThan(0);
  expect(flight.step(0.3, { x: -1, y: 0 }).curvature.x).toBeLessThan(0);
});

test("release exponentially straightens the tube without losing speed or resetting its heading", () => {
  const flight = createFlight();
  const before = flight.step(2, { x: 0.8, y: 0.4 });
  const releasing = flight.step(0.1, neutral);
  expect(releasing.curvature.x / before.curvature.x).toBeCloseTo(
    Math.exp(-flightSettings.curvatureResponse * 0.1),
    10,
  );
  expect(releasing.curvature.y / before.curvature.y).toBeCloseTo(
    Math.exp(-flightSettings.curvatureResponse * 0.1),
    10,
  );
  const settled = flight.step(8, neutral);
  const later = flight.step(2, neutral);
  expect(distance(later.direction, settled.direction)).toBeLessThan(1e-10);
  expect(distance(later.direction, [0, 0, 1])).toBeGreaterThan(0.5);
  expect(Math.hypot(...later.velocity)).toBeCloseTo(flightSettings.speed, 9);
});

test("changing tube curvature preserves an orthonormal, unbanked frame and constant speed", () => {
  const flight = createFlight();
  for (let i = 0; i < 1200; i++) {
    const pose = flight.step(flightSettings.step, { x: Math.sin(i / 120), y: Math.cos(i / 90) });
    expect(Math.hypot(...pose.velocity)).toBeCloseTo(flightSettings.speed, 9);
    expect(Math.hypot(...pose.direction)).toBeCloseTo(1, 10);
    expect(Math.hypot(...pose.up)).toBeCloseTo(1, 10);
    expect(dot(pose.direction, pose.up)).toBeCloseTo(0, 10);
    expect(
      distance(
        pose.velocity,
        pose.direction.map((value) => value * flightSettings.speed) as Vector,
      ),
    ).toBeLessThan(1e-9);
  }
});

test("a pointer target cannot instantly deform the visible future tube, and traveled stations stay fixed", () => {
  const scene = createFlightScene();
  scene.setInput({ x: 1, y: 0.3 });
  const first = scene.advance(2);
  const station = first.route.findLast((pose) => pose.distance < first.travel)!;
  scene.setInput({ x: -1, y: -1 });
  expect(scene.advance(0)).toEqual(first);
  const later = scene.advance(0.1);
  expect(later.route.find((pose) => pose.distance === station.distance)).toEqual(station);
});

test("frame timing does not alter the centerline or the actual camera exposure history", () => {
  const uniform = createFlightScene();
  const irregular = createFlightScene();
  for (const scene of [uniform, irregular]) scene.setInput({ x: 0.8, y: 0.4 });
  for (let i = 0; i < 120; i++) uniform.advance(1 / 60);
  for (let i = 0; i < 10; i++) {
    irregular.advance(0.073);
    irregular.advance(0.027);
    irregular.advance(0.1);
  }
  expect(irregular.advance(0)).toEqual(uniform.advance(0));
  const before = uniform.advance(0).history;
  const after = uniform.advance(sceneSettings.exposureStride * flightSettings.step).history;
  expect(after.slice(1)).toEqual(before.slice(0, -1));
  expect(after[0].distance - after.at(-1)!.distance).toBeCloseTo(
    flightSettings.speed * exposureDuration,
    8,
  );
});

test("star placement leaves an empty center even at the camera's own tube station", () => {
  const scene = createFlightScene();
  scene.setInput({ x: 1, y: 0.5 });
  const snapshot = scene.advance(1);
  const seeds: Vector[] = [
    [0.1, 0, snapshot.travel / sceneSettings.fieldDepth],
    [0.3, 1, snapshot.travel / sceneSettings.fieldDepth],
    [0.9, 0.5, snapshot.travel / sceneSettings.fieldDepth],
  ];
  const stars = createStarField(seeds).update(snapshot);
  for (const star of stars) {
    const radius = Math.hypot(star.coordinate[0], star.coordinate[1]);
    expect(radius).toBeGreaterThanOrEqual(sceneSettings.holeRadius - 1e-9);
    expect(radius).toBeLessThanOrEqual(sceneSettings.outerRadius + 1e-9);
    expect(star.coordinate[2]).toBeCloseTo(snapshot.travel, 8);
    expect(distance(star.position, snapshot.history[0].position)).toBeCloseTo(radius, 5);
  }
  // A regular tube cannot fold its radial wall through the centerline.
  expect(flightSettings.maxCurvature * sceneSettings.outerRadius).toBeLessThan(1);
});

test("distance compresses longitudinal arc length, not transverse radius or world-space Z", () => {
  const coordinate: Vector = [60, 80, 1000];
  expect(effectiveDistance(coordinate, 400)).toBeCloseTo(
    Math.sqrt(100 ** 2 + (600 * sceneSettings.longitudinalScale) ** 2),
    10,
  );
  expect(effectiveDistance([60, 0, 600], 0)).toBeLessThan(sceneSettings.visibleRadius);
  expect(Math.hypot(60, 600)).toBeGreaterThan(sceneSettings.visibleRadius);
  expect(effectiveDistance([sceneSettings.visibleRadius, 0, 0], 0)).toBe(
    sceneSettings.visibleRadius,
  );
});

test("stars keep intrinsic coordinates while the tube bends, and recycle beyond the distance limit", () => {
  const scene = createFlightScene();
  const field = createStarField([[0.1, 0, 0.5]]);
  const first = field.update(scene.advance(0))[0];
  scene.setInput({ x: 1, y: 0 });
  const bent = field.update(scene.advance(0.5))[0];
  expect(bent.coordinate).toEqual(first.coordinate);
  expect(distance(bent.position, first.position)).toBeGreaterThan(10);
  const recycleTime = (first.coordinate[2] + sceneSettings.behind + 32) / flightSettings.speed;
  const recycledSnapshot = scene.advance(recycleTime - 0.5);
  const recycled = field.update(recycledSnapshot)[0];
  expect(recycled.sector).toBe(first.sector + 1);
  expect(effectiveDistance(recycled.coordinate, recycledSnapshot.travel)).toBeGreaterThan(
    sceneSettings.visibleRadius,
  );
  expect(sceneSettings.behind).toBeGreaterThan(flightSettings.speed * exposureDuration);
});

test("stars remain around the visible tube during sustained turns and return to a straight view", () => {
  let randomState = 12345;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 2 ** 32;
  };
  const seeds: Vector[] = Array.from({ length: sceneSettings.fieldStars }, () => [
    random(),
    random(),
    random(),
  ]);
  const scene = createFlightScene();
  const field = createStarField(seeds);
  const range = flightSettings.inputRange;
  for (const input of [
    neutral,
    { x: range, y: 0 },
    { x: 0, y: range },
    { x: -range, y: -range },
    neutral,
  ]) {
    scene.setInput(input);
    for (let i = 0; i < 4; i++) {
      const snapshot = scene.advance(0.5);
      field.update(snapshot);
      const visible = field.visible(snapshot, 1200, 365);
      expect(visible.length).toBeGreaterThan(sceneSettings.fieldStars * 0.05);
      for (const star of visible)
        expect(effectiveDistance(star.coordinate, snapshot.travel)).toBeLessThan(
          sceneSettings.visibleRadius,
        );
    }
  }
});

test("outer tube stars have slower parallax than inner stars at the same projected location", () => {
  const scene = createFlightScene();
  const radiusFraction =
    (100 ** 2 - sceneSettings.holeRadius ** 2) /
    (sceneSettings.outerRadius ** 2 - sceneSettings.holeRadius ** 2);
  const tube = createStarField([[0, radiusFraction, 400 / sceneSettings.fieldDepth]]);
  const outerFraction =
    (280 ** 2 - sceneSettings.holeRadius ** 2) /
    (sceneSettings.outerRadius ** 2 - sceneSettings.holeRadius ** 2);
  const outer = createStarField([[0, outerFraction, 1120 / sceneSettings.fieldDepth]]);
  const before = scene.advance(0);
  const close = tube.update(before)[0];
  const far = outer.update(before)[0];
  const projectedX = (position: Vector, camera: Vector) =>
    (position[0] - camera[0]) / (position[2] - camera[2]);
  const closeX = projectedX(close.position, before.history[0].position);
  const farX = projectedX(far.position, before.history[0].position);
  expect(closeX).toBeCloseTo(farX, 10);
  const after = scene.advance(0.1);
  const closeMovement =
    projectedX(tube.update(after)[0].position, after.history[0].position) - closeX;
  const farMovement = projectedX(outer.update(after)[0].position, after.history[0].position) - farX;
  expect(farMovement).toBeGreaterThan(0);
  expect(closeMovement).toBeGreaterThan(farMovement * 3);
});
