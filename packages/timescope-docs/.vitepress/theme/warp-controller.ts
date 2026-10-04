import { createWarpBlend, createWarpJourney } from './warp-journey';
import { createFlightScene, sceneSettings, type SceneDimensions } from './warp-scene';
import { flightSettings, travelIntensity, type FlightInput } from './warp-flight';
import { normalTravel, travelSettings, type TravelState } from './time-travel';

// The renderer and picker only send commands/read snapshots. All activity,
// flight, fade and density clocks advance together on the same fixed step.
export function createWarpController() {
  const journey = createWarpJourney();
  const scene = createFlightScene(null, sceneSettings.driftSpeedScale, false);
  const opacity = createWarpBlend(0);
  let selection = normalTravel;
  let inactivity = Infinity;
  let accumulator = 0;
  let tubeMix = 0;
  let starScale = 1;
  let movement = journey.advance(0);
  let input: FlightInput | null = null;
  const warpIn = (value: TravelState) => {
    selection = value;
    inactivity = 0;
    journey.set({ ...value, mode: 'travel' });
  };
  const updateSelection = (value: TravelState) => {
    selection = value;
    if (value.dawn >= 1) journey.set({ ...value, mode: 'stopped' });
  };
  const update = (delta: number) => {
    accumulator += delta;
    while (accumulator + 1e-10 >= flightSettings.step) {
      const previous = inactivity;
      inactivity += flightSettings.step;
      if (previous < travelSettings.inactivityMs / 1000 && inactivity >= travelSettings.inactivityMs / 1000) {
        journey.set({ ...selection, mode: selection.mode === 'normal' ? 'normal' : 'stopped' });
      }
      movement = journey.advance(0);
      const idle = movement.mode !== 'travel' || movement.warpPhase === 'out';
      // Entry and exit share the same response for both speed and opacity.
      // Phase boundaries never cut short acceleration or deceleration.
      scene.setTravel({ ...movement, transitionResponse: 5 });
      opacity.set(idle ? 0 : 1, idle ? movement.timing.outDuration : movement.timing.inDuration, 5);
      tubeMix = Math.max(0, Math.min(1, opacity.advance(flightSettings.step)));
      scene.setTube(tubeMix > 0 || !idle);
      scene.advance(flightSettings.step);
      starScale +=
        ((idle ? 1 : travelIntensity(movement.distanceYears).starScale) - starScale) *
        (1 - Math.exp(-3 * flightSettings.step));
      journey.advance(flightSettings.step);
      accumulator = Math.max(0, accumulator - flightSettings.step);
    }
    return { flight: scene.advance(0), tubeMix, starScale };
  };
  const setInput = (value: FlightInput | null) => {
    input = value;
    scene.setInput(movement.mode === 'travel' ? value : null);
  };
  const navigate = (value: FlightInput) => {
    if (movement.mode === 'travel') {
      input = { x: (input?.x ?? 0) + value.x / 0.35, y: (input?.y ?? 0) + value.y / 0.35 };
      scene.setInput(input);
    } else scene.navigate(value);
  };
  return {
    warpIn,
    updateSelection,
    update,
    setInput,
    navigate,
    setDimensions: (value: SceneDimensions) => scene.setDimensions(value),
  };
}
