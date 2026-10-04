export type Vector = [number, number, number];
export type FlightInput = { x: number; y: number };
export type FlightPose = { position: Vector; direction: Vector; up: Vector };
export type FlightState = FlightPose & {
  distance: number;
  velocity: Vector;
  curvature: FlightInput;
};

// Arc length and time, rather than lateral thrust, determine the flight.
export const flightSettings = {
  speed: 640,
  maxCurvature: 0.003,
  inputRange: 2,
  curvatureResponse: 5,
  step: 1 / 120,
};

export const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(vector: Vector): Vector {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length) as Vector;
}
function rotate(vector: Vector, axis: Vector, angle: number): Vector {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const perpendicular = cross(axis, vector);
  const parallel = dot(axis, vector) * (1 - cosine);
  return vector.map((value, i) => value * cosine + perpendicular[i] * sine + axis[i] * parallel) as Vector;
}

export function straightFlight(distance = 0): FlightState {
  return {
    position: [0, 0, distance],
    direction: [0, 0, 1],
    up: [0, 1, 0],
    velocity: [0, 0, flightSettings.speed],
    distance,
    curvature: { x: 0, y: 0 },
  };
}

export function createFlight(initial = straightFlight()) {
  let state = initial;
  const step = (delta: number, input: FlightInput): FlightState => {
    const magnitude = Math.max(1, Math.hypot(input.x, input.y) / flightSettings.inputRange);
    const target = {
      x: ((input.x / magnitude) * flightSettings.maxCurvature) / flightSettings.inputRange,
      y: ((input.y / magnitude) * flightSettings.maxCurvature) / flightSettings.inputRange,
    };
    for (let remaining = delta; remaining > 1e-10;) {
      const dt = Math.min(remaining, flightSettings.step);
      const halfResponse = 1 - Math.exp((-flightSettings.curvatureResponse * dt) / 2);
      const response = 1 - Math.exp(-flightSettings.curvatureResponse * dt);
      const x = state.curvature.x + (target.x - state.curvature.x) * halfResponse;
      const y = state.curvature.y + (target.y - state.curvature.y) * halfResponse;
      const curvature = Math.hypot(x, y);
      const distance = flightSettings.speed * dt;
      const right = cross(state.up, state.direction);
      const normal =
        curvature > 1e-12 ? (right.map((value, i) => (value * x + state.up[i] * y) / curvature) as Vector) : right;
      const axis = normalize(cross(state.direction, normal));
      const angle = curvature * distance;
      // Bishop frame: C' = T, T' = κx R + κy U, U' = -κy T.
      // Integrate a circular arc at midpoint curvature, without camera lag,
      // artificial banking, or a component of motion aimed at the tube wall.
      const along = curvature > 1e-12 ? Math.sin(angle) / curvature : distance;
      const across = curvature > 1e-12 ? (2 * Math.sin(angle / 2) ** 2) / curvature : 0;
      const direction = normalize(rotate(state.direction, axis, angle));
      const up = normalize(cross(direction, cross(rotate(state.up, axis, angle), direction)));
      state = {
        position: state.position.map((value, i) => value + state.direction[i] * along + normal[i] * across) as Vector,
        direction,
        up,
        velocity: direction.map((value) => value * flightSettings.speed) as Vector,
        distance: state.distance + distance,
        curvature: {
          x: state.curvature.x + (target.x - state.curvature.x) * response,
          y: state.curvature.y + (target.y - state.curvature.y) * response,
        },
      };
      remaining -= dt;
    }
    return state;
  };
  return { step };
}
