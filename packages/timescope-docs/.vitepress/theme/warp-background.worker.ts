import { flightSettings, travelIntensity, type FlightInput, type Vector } from './warp-flight';
import { createFreeStarField, createStarField, sceneDimensions, sceneSettings } from './warp-scene';
import type { TravelState } from './time-travel';
import { createWarpController } from './warp-controller';

export type WarpSize = { width: number; height: number; ratio: number };
export type WarpMessage =
  | { type: 'init'; canvas: OffscreenCanvas; size: WarpSize; running: boolean }
  | { type: 'resize'; size: WarpSize }
  | { type: 'running'; running: boolean }
  | { type: 'input'; input: FlightInput | null }
  | { type: 'navigate'; input: FlightInput }
  | { type: 'warp'; active: boolean }
  | { type: 'travel'; travel: TravelState };

export type WarpReply = { type: 'ready' } | { type: 'error' };

// This module is only executed inside a dedicated worker.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WarpMessage>) => void) | null;
  postMessage(message: WarpReply): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
};

// Follow the centerline of a wormhole, steering its curvature with the mouse.
// Trails sample past camera poses, giving real perspective and motion parallax.
const trailSegments = 8;
const vertexSource = `
attribute vec3 seed;
attribute vec3 corner;
attribute vec3 starPosition;
attribute float starSector;
attribute vec3 starCoordinate;
uniform vec2 resolution;
uniform vec2 origin;
uniform float travel;
uniform vec2 tubeRadii;
uniform float curvature;
uniform float speed;
uniform float freeSpace;
uniform float layerOpacity;
uniform float motionTimeScale;
uniform vec3 cameraPositions[${sceneSettings.exposureSamples}];
uniform vec3 cameraDirections[${sceneSettings.exposureSamples}];
uniform vec3 cameraUps[${sceneSettings.exposureSamples}];
varying vec2 uv;
varying vec3 color;
varying float brightness;
varying vec2 pointPosition;
varying float pointOpacity;
varying float trailHeadDistance;
varying float opacity;

const float sampleInterval = ${(sceneSettings.exposureStride * flightSettings.step).toFixed(8)};
const float exposure = ${sceneSettings.trailExposure.toFixed(3)};

vec3 viewPosition(vec3 point, float age) {
  // A camera pose must use one timestamp: mixing an older position with a
  // newer orientation shears curved trails into artificial lateral motion.
  // Only the tunnel's flight history uses represented time; free navigation
  // keeps the unscaled shutter interval for both translation and rotation.
  float sample = clamp(age * motionTimeScale / sampleInterval, 0.0, ${sceneSettings.exposureSamples - 1}.0);
  int index = int(clamp(floor(sample), 0.0, ${sceneSettings.exposureSamples - 2}.0));
  float fraction = sample - float(index);
  vec3 position = mix(cameraPositions[index], cameraPositions[index + 1], fraction);
  vec3 forward = normalize(mix(cameraDirections[index], cameraDirections[index + 1], fraction));
  vec3 cameraUp = mix(cameraUps[index], cameraUps[index + 1], fraction);
  vec3 right = normalize(cross(cameraUp, forward));
  vec3 up = cross(forward, right);
  vec3 relative = point - position;
  return vec3(dot(relative, right), dot(relative, up), dot(relative, forward));
}

vec2 project(vec3 point) {
  return origin + point.xy * (resolution.y * 0.9) / max(point.z, 0.5);
}

void main() {
  opacity = layerOpacity;
  // Stars surround an empty tube, rather than flying toward the camera.
  vec3 star = starPosition;
  vec3 head = viewPosition(star, 0.0);
  float radiusSquared = dot(starCoordinate.xy, starCoordinate.xy);
  float radiusFraction = (radiusSquared - tubeRadii.x * tubeRadii.x) / (tubeRadii.y * tubeRadii.y - tubeRadii.x * tubeRadii.x);
  float referenceRadius = sqrt(max(0.0, ${sceneSettings.holeRadius ** 2}.0 + radiusFraction * ${sceneSettings.outerRadius ** 2 - sceneSettings.holeRadius ** 2}.0));
  vec3 metric = vec3(referenceRadius, 0.0,
    (starCoordinate.z - travel) * ${sceneSettings.longitudinalScale.toFixed(4)});
  float distance = length(metric);
  float worldDistance = length(star - cameraPositions[0]);
  if (freeSpace > 0.5) {
    metric.z = head.z * ${sceneSettings.longitudinalScale.toFixed(4)};
    distance = worldDistance / (tubeRadii.y * 1.5) * ${sceneSettings.visibleRadius.toFixed(1)};
  }
  // Keep the original depth-based flare profile, using compressed axial depth.
  // The full anisotropic distance below only controls visibility and fading.
  float proximity = 1.0 - smoothstep(3.0, 110.0, max(metric.z, 0.0));
  // Keep each star's scale stable throughout its passage through the field.
  float sizeSeed = fract(seed.x * 31.7 + seed.y * 17.3 + seed.z * 13.1 + starSector * 0.618);
  float starScale = mix(0.55, 1.6, sizeSeed * sizeSeed);
  float width = (0.55 + 8.0 * pow(proximity, 3.0)) * starScale;
  // Keep the head sprite separate from the ribbon, so a collapsed or folded
  // exposure never changes the shape of the star itself.
  float spread = 1.0;
  vec2 headProjection = project(head);
  vec2 position;
  pointOpacity = corner.z < 0.0 ? 1.0 : 0.0;
  if (pointOpacity > 0.5) {
    vec2 offset = vec2(corner.x * 2.0 - 1.0, corner.y);
    position = headProjection + offset * width * spread;
    uv = vec2(0.0, corner.y);
    trailHeadDistance = 0.0;
  } else {
    vec3 previousView = head;
    vec2 segmentStart = headProjection;
    vec2 segmentEnd = headProjection;
    float segmentOffset = 0.0;
    float segmentLength = 0.0;
    float trailLength = 0.0;
    // Use arc length, not head-to-tail distance: an exposure may double back
    // without being short. Each quad has one local normal at both ends, so
    // a reversal cannot swap sides within a quad or twist its triangles.
    for (int i = 0; i < ${trailSegments}; i++) {
      float age = float(i + 1) / ${trailSegments.toFixed(1)} * exposure;
      vec3 nextView = viewPosition(star, age);
      vec3 startView = previousView;
      vec3 endView = nextView;
      // Clip each historical segment in view space before projection. Behind-
      // camera samples must not create enormous, artificial screen-space arcs.
      if (startView.z < 0.5 && endView.z >= 0.5) {
        startView = mix(startView, endView, (0.5 - startView.z) / (endView.z - startView.z));
      } else if (endView.z < 0.5 && startView.z >= 0.5) {
        endView = mix(startView, endView, (0.5 - startView.z) / (endView.z - startView.z));
      }
      vec2 startPoint = project(startView);
      vec2 endPoint = project(endView);
      float lengthHere = previousView.z < 0.5 && nextView.z < 0.5 ? 0.0 : length(endPoint - startPoint);
      if (float(i) == corner.z) {
        segmentStart = startPoint;
        segmentEnd = lengthHere > 0.0 ? endPoint : startPoint;
        segmentOffset = trailLength;
        segmentLength = lengthHere;
      }
      trailLength += lengthHere;
      previousView = nextView;
    }
    vec2 tangent = (segmentEnd - segmentStart) / max(segmentLength, 0.0001);
    position = mix(segmentStart, segmentEnd, corner.x)
      + vec2(-tangent.y, tangent.x) * corner.y * width * spread;
    uv = vec2((segmentOffset + corner.x * segmentLength) / max(trailLength, 0.0001), corner.y);
    trailHeadDistance = (segmentOffset + corner.x * segmentLength) / (width * spread);
  }
  gl_Position = vec4(position / resolution * 2.0 - 1.0, 0.0, 1.0);
  pointPosition = (position - headProjection) / (width * spread);
  color = seed.y > 0.82 ? vec3(1.0, 0.55, 0.25) : mix(vec3(0.28, 0.61, 1.0), vec3(0.86, 0.94, 1.0), seed.y);
  // Shorter trails at low speeds need more light in the distant star field.
  float lowSpeedLift = 1.0 - smoothstep(15.0, 55.0, speed);
  float distantLight = mix(0.015, 0.085, lowSpeedLift);
  float depthLight = pow(proximity, mix(3.0, 2.3, lowSpeedLift));
  brightness = smoothstep(0.5, 3.0, head.z)
    * (1.0 - smoothstep(${sceneSettings.fadeStart.toFixed(1)}, ${sceneSettings.visibleRadius.toFixed(1)}, distance))
    * (distantLight + (1.3 - distantLight) * depthLight) * (0.25 + seed.y * 0.7)
    * ${sceneSettings.starBrightness.toFixed(2)};
  // Fade before the half-turn visibility cutoff instead of showing a sliced
  // tunnel end. Also soften the finite outer wall, especially while turning.
  if (freeSpace < 0.5) {
    float turnAngle = max(starCoordinate.z - travel, 0.0) * curvature;
    brightness *= 1.0 - smoothstep(2.2, 3.14159265, turnAngle);
    float outerFade = 1.0 - smoothstep(${(sceneSettings.outerRadius * 0.85).toFixed(1)}, ${sceneSettings.outerRadius.toFixed(1)}, length(metric.xy));
    brightness *= mix(1.0, outerFade, smoothstep(0.0005, 0.002, curvature));
  } else brightness *= smoothstep(tubeRadii.x * 0.7, tubeRadii.x * 1.2, worldDistance);
}
`;

const fragmentSource = `
precision mediump float;
varying vec2 uv;
varying vec3 color;
varying float brightness;
varying vec2 pointPosition;
varying float pointOpacity;
varying float trailHeadDistance;
varying float opacity;
void main() {
  float crossSection = abs(uv.y);
  float core = exp(-crossSection * crossSection * 110.0);
  float halo = exp(-crossSection * crossSection * 4.0) * 0.36;
  // The head fade covers a fixed fraction of the star's width, not 12% of
  // the entire trail: a receding trail can extend far beyond the viewport.
  float tail = pow(max(0.0, 1.0 - uv.x), 0.65) * smoothstep(0.0, 0.5, trailHeadDistance);
  float glow = (core + halo) * (1.0 - smoothstep(0.7, 1.0, crossSection));
  vec2 point = pointPosition;
  float radiusSquared = dot(point, point);
  float pointCore = exp(-radiusSquared * 85.0) * pointOpacity;
  float pointHalo = exp(-radiusSquared * 5.0) * 0.55 * pointOpacity
    * (1.0 - smoothstep(0.7, 1.0, length(point)));
  vec3 light = mix(color, vec3(1.0), max(core * 0.5, pointCore * 0.9));
  gl_FragColor = vec4(light, (glow * tail * (1.0 - pointOpacity) + pointCore + pointHalo) * brightness * opacity);
}
`;

function createRenderer(surface: OffscreenCanvas) {
  const context = surface.getContext('webgl', { alpha: true, antialias: false, depth: false });
  if (!context) throw new Error('WebGL is unavailable');
  const gl = context;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const starBuffer = gl.createBuffer();
  const warp = createWarpController();
  const instances = gl.getExtension('ANGLE_instanced_arrays');
  let frame = 0;
  let lost = false;
  let ready = false;
  let previous = 0;
  let width = 0;
  let height = 0;
  let travelState: TravelState = { mode: 'normal', direction: 1, dawn: 0 };
  let activity = 0;

  const stop = () => {
    scope.cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  };
  if (!program || !buffer || !starBuffer) throw new Error('WebGL allocation failed');

  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Shader allocation failed');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
  }
  shaders.forEach((shader) => {
    gl.detachShader(program, shader);
    gl.deleteShader(shader);
  });
  gl.useProgram(program);

  const verticesPerStar = (trailSegments + 1) * 6;
  const corners = [
    [0, -1],
    [1, -1],
    [0, 1],
    [0, 1],
    [1, -1],
    [1, 1],
  ];
  const totalStars = Math.ceil(sceneSettings.fieldStars * travelIntensity(Infinity).starScale) * 3;
  // Appearance is independent of placement around the tube.
  const appearanceSeeds: Vector[] = Array.from({ length: totalStars }, () => [
    Math.random(),
    Math.random(),
    Math.random(),
  ]);
  const cornerData = new Float32Array(verticesPerStar * 3);
  const repeat = instances ? 1 : verticesPerStar;
  let capacity = 0;
  let starData = new Float32Array();
  let offset = 0;
  for (let segment = -1; segment < trailSegments; segment++) {
    for (const [along, across] of corners) {
      cornerData.set([along, across, segment], offset);
      offset += 3;
    }
  }
  const field = createFreeStarField(
    Array.from({ length: totalStars }, () => [Math.random(), Math.random(), Math.random()]),
  );
  const tubeField = createStarField(
    Array.from({ length: Math.ceil(totalStars / 3) }, () => [Math.random(), Math.random(), Math.random()]),
  );
  let dimensions = sceneDimensions(1920, 365);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, cornerData, gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 3, gl.FLOAT, false, 12, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
  for (const [name, size, offset] of [
    ['seed', 3, 0],
    ['starPosition', 3, 12],
    ['starSector', 1, 24],
    ['starCoordinate', 3, 28],
  ] as const) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 40, offset);
    instances?.vertexAttribDivisorANGLE(location, 1);
  }
  const resolution = gl.getUniformLocation(program, 'resolution');
  const origin = gl.getUniformLocation(program, 'origin');
  const travel = gl.getUniformLocation(program, 'travel');
  const tubeRadii = gl.getUniformLocation(program, 'tubeRadii');
  const curvature = gl.getUniformLocation(program, 'curvature');
  const speed = gl.getUniformLocation(program, 'speed');
  const freeSpace = gl.getUniformLocation(program, 'freeSpace');
  const layerOpacity = gl.getUniformLocation(program, 'layerOpacity');
  const motionTimeScale = gl.getUniformLocation(program, 'motionTimeScale');
  const cameraPositions = gl.getUniformLocation(program, 'cameraPositions[0]');
  const cameraDirections = gl.getUniformLocation(program, 'cameraDirections[0]');
  const cameraUps = gl.getUniformLocation(program, 'cameraUps[0]');
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let active = false;
  const resize = (size: WarpSize) => {
    if (lost) return;
    if (!size.width || !size.height) return;
    ({ width, height } = size);
    dimensions = sceneDimensions(width, height);
    field.setDimensions(dimensions);
    tubeField.setDimensions(dimensions);
    warp.setDimensions(dimensions);
    gl.uniform2f(tubeRadii, dimensions.holeRadius, dimensions.outerRadius);
    surface.width = Math.max(1, Math.round(width * size.ratio));
    surface.height = Math.max(1, Math.round(height * size.ratio));
    gl.viewport(0, 0, surface.width, surface.height);
    // CSS pixels keep the streak widths consistent across displays.
    gl.uniform2f(resolution, width, height);
    gl.uniform2f(origin, width / 2, height / 2);
    if (active && !frame) frame = scope.requestAnimationFrame(draw);
  };
  const draw = (now: number) => {
    const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    const { flight: snapshot, tubeMix, starScale } = warp.update(delta);
    const { history } = snapshot;
    previous = now;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(speed, Math.abs(snapshot.speedScale) * flightSettings.speed);
    gl.uniform1f(travel, snapshot.travel);
    gl.uniform1f(curvature, Math.hypot(history[0].curvature.x, history[0].curvature.y));
    gl.uniform3fv(
      cameraPositions,
      history.flatMap((pose) => pose.position),
    );
    gl.uniform3fv(
      cameraDirections,
      history.flatMap((pose) => pose.direction),
    );
    gl.uniform3fv(
      cameraUps,
      history.flatMap((pose) => pose.up),
    );
    const layers = [
      { field, opacity: 1 - tubeMix, space: 1, multiplier: 3 },
      { field: tubeField, opacity: tubeMix, space: 0, multiplier: 1 },
    ];
    for (const layer of layers) {
      if (layer.opacity === 0) continue;
      layer.field.setCount(sceneSettings.fieldStars * starScale * layer.multiplier);
      layer.field.update(snapshot);
      const visible = layer.field.visible(snapshot, width, height);
      const visibleCount = visible.length;
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
      if (visibleCount > capacity) {
        capacity = 2 ** Math.ceil(Math.log2(visibleCount));
        starData = new Float32Array(capacity * repeat * 10);
        gl.bufferData(gl.ARRAY_BUFFER, starData.byteLength, gl.DYNAMIC_DRAW);
        if (!instances) {
          const data = new Float32Array(capacity * cornerData.length);
          for (let i = 0; i < capacity; i++) data.set(cornerData, i * cornerData.length);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
        }
      }
      let offset = 0;
      for (const { index, position, sector, coordinate } of visible) {
        const seed = appearanceSeeds[index];
        for (let i = 0; i < repeat; i++) {
          starData.set([...seed, ...position, sector, ...coordinate], offset);
          offset += 10;
        }
      }
      if (offset) gl.bufferSubData(gl.ARRAY_BUFFER, 0, starData.subarray(0, offset));
      gl.uniform1f(freeSpace, layer.space);
      gl.uniform1f(motionTimeScale, layer.space === 0 ? sceneSettings.warpMotionScale : 1);
      gl.uniform1f(layerOpacity, layer.opacity);
      if (visibleCount) {
        if (instances) instances.drawArraysInstancedANGLE(gl.TRIANGLES, 0, verticesPerStar, visibleCount);
        else gl.drawArrays(gl.TRIANGLES, 0, visibleCount * verticesPerStar);
      }
    }
    if (!ready) {
      ready = true;
      scope.postMessage({ type: 'ready' });
    }
    if (travelState.dawn >= 1) {
      frame = 0;
      previous = 0;
    } else frame = scope.requestAnimationFrame(draw);
  };
  const setRunning = (running: boolean) => {
    active = running;
    if (!running || lost) {
      stop();
    } else if (!frame) {
      frame = scope.requestAnimationFrame(draw);
    }
  };
  const setTravel = (travel: TravelState) => {
    travelState = travel;
    if (travel.activity !== undefined ? travel.activity !== activity : travel.mode === 'travel') warp.warpIn(travel);
    else warp.updateSelection(travel);
    activity = travel.activity ?? activity;
    if (active && !frame) frame = scope.requestAnimationFrame(draw);
  };
  const setInput = (input: FlightInput | null) => {
    warp.setInput(input);
    if (active && !frame) frame = scope.requestAnimationFrame(draw);
  };
  const navigate = (input: FlightInput) => {
    warp.navigate(input);
    if (active && !frame) frame = scope.requestAnimationFrame(draw);
  };
  const contextLost = () => {
    lost = true;
    stop();
    scope.postMessage({ type: 'error' });
  };
  surface.addEventListener('webglcontextlost', contextLost);
  return { resize, setRunning, setInput, setTravel, navigate, setWarp: warp.setWarp };
}

let renderer: ReturnType<typeof createRenderer> | undefined;
scope.onmessage = ({ data }) => {
  try {
    switch (data.type) {
      case 'init':
        renderer = createRenderer(data.canvas);
        renderer.resize(data.size);
        renderer.setRunning(data.running);
        break;
      case 'resize':
        renderer?.resize(data.size);
        break;
      case 'running':
        renderer?.setRunning(data.running);
        break;
      case 'input':
        renderer?.setInput(data.input);
        break;
      case 'navigate':
        renderer?.navigate(data.input);
        break;
      case 'travel':
        renderer?.setTravel(data.travel);
        break;
      case 'warp':
        renderer?.setWarp(data.active);
        break;
    }
  } catch {
    renderer?.setRunning(false);
    scope.postMessage({ type: 'error' });
  }
};
