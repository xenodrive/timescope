import { expect, test } from "vitest";
import { Calendar } from "../packages/timescope/src/index";
import { createWarpController } from "../packages/timescope-docs/.vitepress/theme/warp-controller";
import {
  travelIntensity,
  flightSettings,
} from "../packages/timescope-docs/.vitepress/theme/warp-flight";
import {
  createWarpJourney,
  createWarpBlend,
  createWarpCruise,
  warpSettings,
  warpTiming,
} from "../packages/timescope-docs/.vitepress/theme/warp-journey";
import {
  birthTime,
  birthYear,
  dawnOf,
  pickerZoom,
  timeRange,
  travelSettings,
  yearOf,
} from "../packages/timescope-docs/.vitepress/theme/time-travel";
import {
  createFlightScene,
  createStarField,
  createFreeStarField,
  sceneSettings,
  sceneDimensions,
} from "../packages/timescope-docs/.vitepress/theme/warp-scene";

test("free navigation preserves heading after release, follows it, and suppresses automatic steering", () => {
  const scene = createFlightScene(null, sceneSettings.driftSpeedScale);
  scene.setTravel({ mode: "normal", direction: 1, dawn: 0 });
  scene.navigate({ x: 0.6, y: 0.2 });
  const turned = scene.advance(4);
  expect(turned.history[0].direction[0]).toBeGreaterThan(0.5);
  expect(turned.history[0].direction[1]).toBeGreaterThan(0.1);
  scene.setInput(null);
  const later = scene.advance(40);
  for (let axis = 0; axis < 3; axis++) {
    expect(later.history[0].direction[axis]).toBeCloseTo(turned.history[0].direction[axis], 7);
    expect(later.history[0].position[axis] - turned.history[0].position[axis]).toBeCloseTo(
      turned.history[0].direction[axis] * 40 * 640 * sceneSettings.driftSpeedScale,
      5,
    );
  }
});

test("free-space stars stay fixed when direction changes and only wrap outside the visible shell", () => {
  const field = createFreeStarField([[0.1, 0.2, 0.3]]);
  const scene = createFlightScene();
  const snapshot = scene.advance(0);
  const first = field.update(snapshot)[0].position;
  const rotated = {
    ...snapshot,
    history: snapshot.history.map((pose) => ({
      ...pose,
      direction: [1, 0, 0] as [number, number, number],
    })),
  };
  expect(field.update(rotated)[0].position).toEqual(first);
  const far = {
    ...snapshot,
    history: snapshot.history.map((pose) => ({
      ...pose,
      position: [580, 0, 0] as [number, number, number],
    })),
  };
  const next = field.update(far)[0].position;
  expect(next).not.toEqual(first);
  expect(Math.hypot(...next.map((v, i) => v - far.history[0].position[i]))).toBeGreaterThan(
    sceneSettings.outerRadius * 1.5,
  );
});

test("time travel re-enters a curved tube even after free navigation, with frame-independent turns", () => {
  const make = () => {
    const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
    scene.navigate({ x: 0.3, y: 0.1 });
    expect(scene.advance(3).route).toEqual([]);
    scene.setTravel({ mode: "travel", direction: -1, dawn: 0, distanceYears: 1_000_000 });
    return scene;
  };
  const scene = make();
  const first = scene.advance(0.15);
  expect(first.route.length).toBeGreaterThan(0);
  expect(Math.hypot(first.history[0].curvature.x, first.history[0].curvature.y)).toBeLessThan(
    0.000001,
  );
  const second = scene.advance(3.85);
  expect(
    Math.hypot(...second.history[0].direction.map((v, i) => v - first.history[0].direction[i])),
  ).toBeGreaterThan(0.2);
  const split = make();
  for (let i = 0; i < 120; i++) split.advance(1 / 30);
  expect(split.advance(0).history[0].position).toEqual(second.history[0].position);
  scene.setTravel({ mode: "stopped", direction: -1, dawn: 0 });
  expect(scene.advance(3).route).toEqual([]);
  const released = scene.advance(1).history[0].direction;
  expect(
    Math.hypot(...scene.advance(5).history[0].direction.map((v, i) => v - released[i])),
  ).toBeLessThan(1e-7);
});

test("near trips stay straight and use short warp entry/exit and acceleration/deceleration", () => {
  const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
  scene.setTravel({ mode: "travel", direction: 1, dawn: 0, distanceYears: 100 });
  const snapshot = scene.advance(0.5);
  expect(snapshot.history[0].direction).toEqual([0, 0, 1]);
  expect(snapshot.history[0].curvature).toEqual({ x: 0, y: 0 });
  const journey = createWarpJourney();
  journey.set({ mode: "travel", direction: 1, dawn: 0, distanceYears: 100 });
  expect(journey.advance(0.15).warpPhase).toBe("cruise");
  journey.set({ mode: "stopped", direction: 1, dawn: 0 });
  expect(journey.advance(0).warpPhase).toBe("out");
  expect(journey.advance(0.15).mode).toBe("stopped");
  scene.setTravel({ mode: "stopped", direction: 1, dawn: 0 });
  expect(
    Math.abs(scene.advance(0.5).speedScale - sceneSettings.driftSpeedScale) * flightSettings.speed,
  ).toBeLessThan(1);
});

test("transition timing grows continuously with distance and keeps a full exit for sustained nearby curves", () => {
  const near = warpTiming(100);
  const middle = warpTiming(1000);
  const far = warpTiming(10_000);
  expect(near.inDuration).toBeLessThan(middle.inDuration);
  expect(middle.inDuration).toBeLessThan(far.inDuration);
  expect(near.outDuration).toBeLessThan(middle.outDuration);
  expect(middle.outDuration).toBeLessThan(far.outDuration);
  expect(far.inDuration).toBe(warpSettings.inDuration);
  expect(far.outDuration).toBe(warpSettings.outDuration);
  for (const years of [0, 100, 1000, 10_000, 1_000_000_000]) {
    for (const duration of [0, 2]) {
      const timing = warpTiming(years, duration);
      expect(timing.inDuration + timing.outDuration).toBeLessThanOrEqual(0.5);
    }
  }
  const journey = createWarpJourney();
  journey.set({ mode: "travel", direction: 1, dawn: 0, distanceYears: 100 });
  journey.advance(2);
  journey.set({ mode: "stopped", direction: 1, dawn: 0 });
  expect(journey.advance(0.125).warpPhase).toBe("out");
  expect(journey.advance(0.125).mode).toBe("stopped");
});

test("nearby speed and opacity ease together across the whole entry/exit, in both flight directions", () => {
  for (const direction of [-1, 1] as const) {
    const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
    const opacity = createWarpBlend(0);
    const timing = warpTiming(100);
    scene.setTravel({ mode: "travel", direction, dawn: 0, distanceYears: 100, warpPhase: "in" });
    opacity.set(1, timing.inDuration);
    for (let step = 1; step <= 6; step++) {
      const snapshot = scene.advance(timing.inDuration / 6);
      const fraction =
        (snapshot.speedScale - sceneSettings.driftSpeedScale) /
        (direction - sceneSettings.driftSpeedScale);
      expect(fraction).toBeCloseTo(opacity.advance(timing.inDuration / 6), 10);
      if (step === 1) expect(fraction).toBeLessThan(0.04);
      if (step === 3) expect(fraction).toBeCloseTo(0.5, 10);
      if (step === 6) expect(fraction).toBe(1);
    }
    scene.setTravel({ mode: "travel", direction, dawn: 0, distanceYears: 100, warpPhase: "out" });
    opacity.set(0, timing.outDuration);
    for (let step = 1; step <= 6; step++) {
      const snapshot = scene.advance(timing.outDuration / 6);
      const fraction =
        (snapshot.speedScale - sceneSettings.driftSpeedScale) /
        (direction - sceneSettings.driftSpeedScale);
      expect(fraction).toBeCloseTo(opacity.advance(timing.outDuration / 6), 10);
      if (step === 1) expect(fraction).toBeGreaterThan(0.96);
      if (step === 3) expect(fraction).toBeCloseTo(0.5, 10);
      if (step === 6) expect(snapshot.speedScale).toBe(sceneSettings.driftSpeedScale);
    }
  }
});

test("resuming during warp-out keeps the current speed, opacity and position instead of snapping", () => {
  const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
  const opacity = createWarpBlend(0);
  scene.setTravel({ mode: "travel", direction: -1, dawn: 0, distanceYears: 100, warpPhase: "in" });
  opacity.set(1, 0.15);
  scene.advance(0.15);
  opacity.advance(0.15);
  scene.setTravel({ mode: "travel", direction: -1, dawn: 0, distanceYears: 100, warpPhase: "out" });
  opacity.set(0, 0.15);
  const before = scene.advance(0.05);
  const faded = opacity.advance(0.05);
  scene.setTravel({ mode: "travel", direction: -1, dawn: 0, distanceYears: 100, warpPhase: "in" });
  opacity.set(1, 0.15);
  expect(scene.advance(0).speedScale).toBe(before.speedScale);
  expect(scene.advance(0).history[0].position).toEqual(before.history[0].position);
  expect(opacity.advance(0)).toBe(faded);
  expect(scene.advance(1 / 120).speedScale).toBeGreaterThan(before.speedScale);
  expect(opacity.advance(1 / 120)).toBeLessThan(faded);
});

test("warp controller owns inactivity, repeated activity and smooth restart", () => {
  const warp = createWarpController();
  const request = { mode: "travel", direction: 1, dawn: 0, distanceYears: 100 } as const;
  warp.warpIn(request);
  const entering = warp.update(0.2);
  expect(entering.tubeMix).toBeGreaterThan(0.6);
  expect(entering.tubeMix).toBeLessThan(0.7);
  expect(
    (entering.flight.speedScale - sceneSettings.driftSpeedScale) /
      (1 - sceneSettings.driftSpeedScale),
  ).toBeCloseTo(entering.tubeMix, 10);
  for (let i = 0; i < 10; i++) {
    warp.warpIn(request);
    expect(warp.update(0.3).tubeMix).toBeGreaterThan(0.9);
  }
  warp.updateSelection({ ...request, mode: "stopped" });
  const exiting = warp.update(0.5);
  expect(exiting.tubeMix).toBeGreaterThan(0);
  expect(exiting.tubeMix).toBeLessThan(1);
  warp.warpIn(request);
  expect(warp.update(0).tubeMix).toBe(exiting.tubeMix);
  expect(warp.update(0).flight.speedScale).toBe(exiting.flight.speedScale);
  const resumed = warp.update(0.3);
  expect(resumed.tubeMix).toBeGreaterThan(exiting.tubeMix);
  expect(resumed.tubeMix).toBeLessThan(1);
  const braking = warp.update(0.55);
  expect(braking.tubeMix).toBeGreaterThan(0.3);
  expect(braking.tubeMix).toBeLessThan(0.7);
  expect(braking.flight.speedScale).toBeGreaterThan(sceneSettings.driftSpeedScale + 0.3);
  const stopped = warp.update(3);
  expect(stopped.tubeMix).toBe(0);
  expect(stopped.flight.speedScale).toBe(sceneSettings.driftSpeedScale);
});

test("sustained nearby selections can bend too, while short nearby trips remain straight", () => {
  const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
  scene.setTravel({ mode: "travel", direction: 1, dawn: 0, distanceYears: 10 });
  expect(scene.advance(0.5).history[0].curvature).toEqual({ x: 0, y: 0 });
  let maximum = 0;
  for (let frame = 0; frame < 240; frame++) {
    const curvature = scene.advance(1 / 30).history[0].curvature;
    maximum = Math.max(maximum, Math.hypot(curvature.x, curvature.y));
  }
  expect(maximum).toBeGreaterThan(flightSettings.maxCurvature * 0.97);
});

test("recurring bends remain strong and within the safe limit, including reverse and mobile flight", () => {
  for (const [width, height] of [
    [1920, 365],
    [390, 420],
  ]) {
    const dimensions = sceneDimensions(width, height);
    for (const direction of [-1, 1] as const) {
      const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
      scene.setDimensions(dimensions);
      scene.setTravel({ mode: "travel", direction, dawn: 0, distanceYears: 10_000_000_000 });
      let maximum = 0;
      for (let frame = 0; frame < 240; frame++) {
        const snapshot = scene.advance(1 / 30);
        const curvature = snapshot.history[0].curvature;
        const magnitude = Math.hypot(curvature.x, curvature.y);
        maximum = Math.max(maximum, magnitude);
        expect(magnitude * dimensions.outerRadius).toBeLessThanOrEqual(0.9);
        expect(snapshot.route.every((pose) => pose.position.every(Number.isFinite))).toBe(true);
      }
      expect(maximum).toBeGreaterThan(dimensions.maxCurvature * 0.97);
    }
  }
});

test("rollercoaster bends do not introduce sudden curvature changes at their boundaries", () => {
  const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
  scene.setTravel({ mode: "travel", direction: 1, dawn: 0, distanceYears: 1_000_000 });
  let previous = { x: 0, y: 0 };
  let maximum = 0;
  for (let frame = 0; frame < 960; frame++) {
    const curvature = scene.advance(1 / 120).history[0].curvature;
    expect(Math.hypot(curvature.x - previous.x, curvature.y - previous.y)).toBeLessThan(
      flightSettings.maxCurvature * 0.06,
    );
    maximum = Math.max(maximum, Math.hypot(curvature.x, curvature.y));
    previous = curvature;
  }
  expect(maximum).toBeGreaterThan(flightSettings.maxCurvature * 0.97);
});

test("straight/bend joins ease curvature and its rate to zero instead of briefly switching strength", () => {
  const inputAt = (time: number) => createWarpCruise(() => 0).advance(time);
  const magnitudeAt = (time: number) => {
    const input = inputAt(time);
    return Math.hypot(input.x, input.y);
  };
  const start = warpSettings.minimumStraight;
  const end = start + warpSettings.minimumBend;
  const step = 1 / 120;
  expect(magnitudeAt(start)).toBe(0);
  expect(magnitudeAt(end)).toBe(0);
  expect(magnitudeAt(start + step)).toBeLessThan(flightSettings.inputRange * 0.001);
  expect(magnitudeAt(end - step)).toBeLessThan(flightSettings.inputRange * 0.001);
  expect(magnitudeAt(start + step / 2) / magnitudeAt(start + step)).toBeLessThan(0.15);
  expect(magnitudeAt(end - step / 2) / magnitudeAt(end - step)).toBeLessThan(0.15);
  expect(magnitudeAt(start + warpSettings.minimumBend / 2)).toBeCloseTo(
    flightSettings.inputRange,
    10,
  );
});

test("warp-out interrupts a bend and settles into straight flight before arrival", () => {
  for (const years of [10_000, 1_000_000]) {
    for (const direction of [-1, 1] as const) {
      const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
      scene.setTravel({ mode: "travel", direction, dawn: 0, distanceYears: years });
      expect(scene.advance(0.15).history[0].curvature).toEqual({ x: 0, y: 0 });
      let bending = false;
      for (let frame = 0; frame < 600; frame++) {
        const curvature = scene.advance(1 / 120).history[0].curvature;
        if (Math.hypot(curvature.x, curvature.y) > flightSettings.maxCurvature * 0.9) {
          bending = true;
          break;
        }
      }
      expect(bending).toBe(true);
      scene.setTravel({
        mode: "travel",
        direction,
        dawn: 0,
        distanceYears: years,
        warpPhase: "out",
      });
      const arrival = scene.advance(warpSettings.outDuration).history[0];
      expect(
        Math.abs(
          Math.hypot(...arrival.velocity) - flightSettings.speed * sceneSettings.driftSpeedScale,
        ),
      ).toBeLessThan(0.1);
      expect(Math.hypot(arrival.curvature.x, arrival.curvature.y)).toBeLessThan(
        flightSettings.maxCurvature * 0.01,
      );
      scene.setTravel({ mode: "stopped", direction, dawn: 0 });
      const later = scene.advance(0.5).history[0];
      expect(
        Math.hypot(...later.direction.map((value, axis) => value - arrival.direction[axis])),
      ).toBeLessThan(0.02);
    }
  }
});

test("long cruises keep generating random-duration bends without a count cap or frame-rate dependence", () => {
  const make = () => {
    let seed = 42;
    return createWarpCruise(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    });
  };
  const cruise = make();
  const durations: number[] = [];
  let active = false;
  let length = 0;
  for (let frame = 0; frame < 3600; frame++) {
    const input = cruise.advance(1 / 120);
    const turning = Math.hypot(input.x, input.y) > 0;
    if (turning) length += 1 / 120;
    if (!turning && active) {
      durations.push(length);
      length = 0;
    }
    active = turning;
  }
  expect(durations.length).toBeGreaterThan(8);
  expect(Math.max(...durations) - Math.min(...durations)).toBeGreaterThan(0.2);
  expect(durations.every((duration) => duration > 0.78 && duration < 1.62)).toBe(true);
  const split = make();
  for (let frame = 0; frame < 900; frame++) split.advance(1 / 30);
  expect(split.advance(0).x).toBeCloseTo(cruise.advance(0).x, 8);
  expect(split.advance(0).y).toBeCloseTo(cruise.advance(0).y, 8);
});

test("warp entry/exit have fixed durations, cruise has no deadline, and inactivity can restart entry", () => {
  for (const years of [10_000, 1_000_000]) {
    const journey = createWarpJourney();
    journey.set({ mode: "travel", direction: -1, dawn: 0, distanceYears: years });
    expect(journey.advance(0.125).warpPhase).toBe("in");
    expect(journey.advance(0.125).warpPhase).toBe("cruise");
    expect(journey.advance(120).warpPhase).toBe("cruise");
    journey.set({ mode: "stopped", direction: -1, dawn: 0 });
    expect(journey.advance(0).mode).toBe("travel");
    expect(journey.advance(0.125).warpPhase).toBe("out");
    expect(journey.advance(0.126).mode).toBe("stopped");
    journey.set({ mode: "travel", direction: 1, dawn: 0, distanceYears: years });
    expect(journey.advance(0).warpPhase).toBe("in");
    journey.set({ mode: "stopped", direction: 1, dawn: 0 });
    expect(journey.advance(0.25).warpPhase).toBe("out");
    journey.set({ mode: "travel", direction: 1, dawn: 0, distanceYears: years });
    expect(journey.advance(0).warpPhase).toBe("in");
    journey.set({ mode: "stopped", direction: 1, dawn: 1 });
    expect(journey.advance(0).mode).toBe("stopped");
  }
});

test("cosmic dates retain their year beyond the JavaScript Date range and stop at the present", () => {
  expect(yearOf(birthTime)).toBe(birthYear);
  expect(
    yearOf(
      Calendar.fromComponents({ year: -1_000_000_000, month: 1, day: 1, zone: "utc" }).epoch(),
    ),
  ).toBe(-1_000_000_000);
  expect(timeRange).toEqual([birthTime, undefined]);
  expect(dawnOf(birthYear)).toBe(1);
  expect(dawnOf(birthYear + travelSettings.dawnYears)).toBe(0);
  expect(dawnOf(birthYear + travelSettings.dawnYears / 2)).toBeCloseTo(0.5);
  expect(2 ** -pickerZoom(390, 1) * 390).toBeCloseTo(travelSettings.secondsPerYear, 5);
});

test("far trips accelerate in both directions and increase density with bounded intensity", () => {
  expect(travelIntensity(1)).toEqual(travelIntensity(100));
  const far = travelIntensity(1_000_000);
  expect(far.speedScale).toBeGreaterThan(travelIntensity(1000).speedScale);
  expect(far.starScale).toBeGreaterThan(1);
  expect(travelIntensity(13_800_000_000)).toEqual({ speedScale: 5, starScale: 2 });
  for (const direction of [-1, 1] as const) {
    const scene = createFlightScene();
    scene.setTravel({ mode: "travel", direction, dawn: 0, distanceYears: 1_000_000 });
    expect(scene.advance(3).speedScale).toBeCloseTo(direction * far.speedScale, 4);
    scene.setTravel({ mode: "stopped", direction, dawn: 0, distanceYears: 1_000_000 });
    expect(scene.advance(3).speedScale).toBeCloseTo(sceneSettings.driftSpeedScale, 4);
  }
});

test("inactive extra star seeds are not placed or transformed until density increases", () => {
  const field = createStarField(Array.from({ length: 100 }, (_, i) => [i / 100, 0.5, i / 100]));
  const snapshot = createFlightScene().advance(0);
  field.setCount(50);
  const first = field.update(snapshot);
  const coordinates = first.map((star) => star.coordinate);
  expect(first).toHaveLength(50);
  field.setCount(100);
  expect(field.update(snapshot)).toHaveLength(100);
  field.setCount(50);
  expect(field.update(snapshot).map((star) => star.coordinate)).toEqual(coordinates);
});

test("travel reverses, slows to a drift on arrival, and resumes without teleporting", () => {
  const scene = createFlightScene(null);
  scene.advance(5);
  const before = scene.advance(0);
  scene.setTravel({ mode: "travel", direction: -1, dawn: 0 });
  expect(scene.advance(0).history[0].position).toEqual(before.history[0].position);
  const reverse = scene.advance(3);
  expect(reverse.speedScale).toBe(-1);
  expect(reverse.travel).toBeLessThan(before.travel);
  const field = createStarField(Array.from({ length: 100 }, (_, i) => [i / 100, 0.5, i / 100]));
  field.update(reverse);
  for (const star of field.visible(reverse, 1200, 365))
    expect(star.position.every(Number.isFinite)).toBe(true);
  for (let i = 1; i < reverse.route.length; i++)
    expect(reverse.route[i].distance).toBeGreaterThan(reverse.route[i - 1].distance);
  scene.setTravel({ mode: "stopped", direction: -1, dawn: 0 });
  const stopped = scene.advance(3);
  expect(stopped.speedScale).toBe(sceneSettings.driftSpeedScale);
  const drifting = scene.advance(1);
  expect(drifting.travel - stopped.travel).toBeCloseTo(640 * sceneSettings.driftSpeedScale, 7);
  scene.setInput({ x: 2, y: 0 });
  expect(scene.advance(2).speedScale).toBe(sceneSettings.driftSpeedScale);
  scene.setInput(null);
  scene.setTravel({ mode: "stopped", direction: 1, dawn: 1 });
  expect(scene.advance(3).speedScale).toBe(0);
  scene.setTravel({ mode: "travel", direction: 1, dawn: 0 });
  expect(scene.advance(3).travel).toBeGreaterThan(stopped.travel);
  expect(scene.advance(0).speedScale).toBe(1);
  expect(reverse.route.length).toBeLessThanOrEqual(sceneSettings.routeSamples);
});
