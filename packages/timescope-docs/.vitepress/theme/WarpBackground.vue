<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

const anchor = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const hero = shallowRef<HTMLElement>()
let dispose = () => {}
let disposed = false

const flightSpeed = 15
const routeAmplitude = [35, 14, 28, 12]
const routeFrequency = [0.018, 0.029, 0.016, 0.025]

// Convert constant distance along the curve into its longitudinal increment.
function travelRate(z: number) {
  const slope = routeAmplitude.map((amplitude, i) =>
    amplitude * routeFrequency[i] * Math.cos(z * routeFrequency[i] + (i === 2 ? 0.8 : 0)),
  )
  return flightSpeed / Math.hypot(slope[0] + slope[1], slope[2] + slope[3], 1)
}

// Fly through a stationary 3D star field along a winding tunnel.
// Trails sample past camera poses, giving real perspective and motion parallax.
const vertexSource = `
attribute vec3 seed;
attribute vec2 corner;
uniform vec2 resolution;
uniform vec2 origin;
uniform float travel;
uniform vec4 routeAmplitude;
uniform vec4 routeFrequency;
varying vec2 uv;
varying vec3 color;
varying float brightness;
varying vec3 pointGlow;

const float speed = ${flightSpeed.toFixed(1)};
const float fieldDepth = 180.0;
const float exposure = 0.075;

vec3 route(float z) {
  vec4 wave = routeAmplitude * sin(z * routeFrequency + vec4(0.0, 0.0, 0.8, 0.0));
  return vec3(wave.x + wave.y, wave.z + wave.w, z);
}

vec3 routeTangent(float z) {
  vec4 slope = routeAmplitude * routeFrequency
    * cos(z * routeFrequency + vec4(0.0, 0.0, 0.8, 0.0));
  return vec3(slope.x + slope.y, slope.z + slope.w, 1.0);
}

vec3 viewPosition(vec3 point, float travel) {
  vec3 forward = normalize(routeTangent(travel));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec3 relative = point - route(travel);
  return vec3(dot(relative, right), dot(relative, up), dot(relative, forward));
}

vec2 project(vec3 point) {
  return origin + point.xy * (resolution.y * 0.9) / max(point.z, 0.5);
}

void main() {
  // Recycle only after passing behind the camera. A star's world position
  // stays fixed throughout its flight past us, including its entire trail.
  float sector = floor((travel - seed.z * fieldDepth - 30.0) / fieldDepth) + 1.0;
  float z = (seed.z + sector) * fieldDepth;
  vec2 random = fract(seed.xy + sector * vec2(0.75487766, 0.56984029));
  float angle = random.x * 6.2831853;
  float radius = sqrt(mix(9.0, 1600.0, random.y));
  vec3 star = route(z) + vec3(cos(angle) * radius, sin(angle) * radius, 0.0);

  vec3 head = viewPosition(star, travel);
  float proximity = 1.0 - smoothstep(3.0, 110.0, head.z);
  // Keep each star's scale stable throughout its passage through the field.
  float sizeSeed = fract(seed.x * 31.7 + seed.y * 17.3 + seed.z * 13.1 + sector * 0.618);
  float starScale = mix(0.55, 1.6, sizeSeed * sizeSeed);
  float width = (0.55 + 8.0 * pow(proximity, 3.0)) * starScale;
  // Each star carries a round flare at the trail's head.
  float spread = 1.0;
  float tailTravel = travel - exposure * speed * starScale / length(routeTangent(travel));
  float trailLength = max(length(project(head) - project(viewPosition(star, tailTravel))), 0.5);
  float padding = min(width * spread / trailLength, 2.0);
  float along = mix(-padding, 1.0 + padding, corner.x);
  float trailDistance = along * exposure * speed * starScale;
  float midpoint = travel - 0.5 * trailDistance / length(routeTangent(travel));
  float sampleTravel = travel - trailDistance / length(routeTangent(midpoint));
  vec3 samplePoint = viewPosition(star, sampleTravel);
  vec2 center = project(samplePoint);
  vec2 movement = project(viewPosition(star, sampleTravel + 0.05)) - center;
  vec2 tangent = movement / max(length(movement), 0.0001);
  vec2 position = center
    + vec2(-tangent.y, tangent.x) * corner.y * width * spread;
  gl_Position = vec4(position / resolution * 2.0 - 1.0, 0.0, 1.0);
  uv = vec2(along, corner.y);
  pointGlow = vec3(1.0, trailLength / (width * spread), spread);
  color = seed.y > 0.82 ? vec3(1.0, 0.55, 0.25) : mix(vec3(0.28, 0.61, 1.0), vec3(0.86, 0.94, 1.0), seed.y);
  // Shorter trails at low speeds need more light in the distant star field.
  float lowSpeedLift = 1.0 - smoothstep(15.0, 55.0, speed);
  float distantLight = mix(0.015, 0.085, lowSpeedLift);
  float depthLight = pow(proximity, mix(3.0, 2.3, lowSpeedLift));
  brightness = smoothstep(0.5, 3.0, head.z) * (1.0 - smoothstep(100.0, 140.0, z - travel))
    * (distantLight + (1.3 - distantLight) * depthLight) * (0.25 + seed.y * 0.7);
}
`

const fragmentSource = `
precision mediump float;
varying vec2 uv;
varying vec3 color;
varying float brightness;
varying vec3 pointGlow;
void main() {
  float crossSection = abs(uv.y) * pointGlow.z;
  float core = exp(-crossSection * crossSection * 110.0);
  float halo = exp(-crossSection * crossSection * 4.0) * 0.36;
  float tail = pow(max(0.0, 1.0 - uv.x), 0.65) * smoothstep(0.0, 0.12, uv.x);
  float glow = (core + halo) * (1.0 - smoothstep(0.7, 1.0, crossSection));
  vec2 point = vec2(uv.x * pointGlow.y, uv.y);
  float radiusSquared = dot(point, point);
  float pointCore = exp(-radiusSquared * 85.0) * pointGlow.x;
  float pointHalo = exp(-radiusSquared * 5.0) * 0.55 * pointGlow.x
    * (1.0 - smoothstep(0.7, 1.0, length(point)));
  vec3 light = mix(color, vec3(1.0), max(core * 0.5, pointCore * 0.9));
  gl_FragColor = vec4(light, (glow * tail + pointCore + pointHalo) * brightness);
}
`

onMounted(async () => {
  hero.value = anchor.value?.closest<HTMLElement>('.VPHero') ?? undefined
  await nextTick()
  if (disposed || !hero.value || !canvas.value) return

  const container = hero.value
  const surface = canvas.value
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let context: WebGLRenderingContext | null
  try {
    context = surface.getContext('webgl', { alpha: true, antialias: false, depth: false })
  } catch {
    return
  }
  if (!context) return
  const gl = context
  const shaders: WebGLShader[] = []
  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  let frame = 0
  let visible = false
  let lost = false
  let travel = 0
  let previous = 0
  let starCount = 0

  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    previous = 0
  }
  const release = () => {
    stop()
    container.classList.remove('warp-ready')
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    shaders.forEach(shader => gl.deleteShader(shader))
  }
  dispose = release
  if (!program || !buffer) return

  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type)
    if (!shader) return
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
  gl.useProgram(program)

  const stars = 1200
  const segments = 8
  const verticesPerStar = segments * 6
  const corners = [[0, -1], [1, -1], [0, 1], [0, 1], [1, -1], [1, 1]]
  const data = new Float32Array(stars * verticesPerStar * 5)
  let offset = 0
  for (let i = 0; i < stars; i++) {
    const seed = [Math.random(), Math.random(), Math.random()]
    for (let segment = 0; segment < segments; segment++) {
      for (const [along, across] of corners) {
        data.set([...seed, (segment + along) / segments, across], offset)
        offset += 5
      }
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  for (const [name, size, offset] of [['seed', 3, 0], ['corner', 2, 12]] as const) {
    const location = gl.getAttribLocation(program, name)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 20, offset)
  }
  const resolution = gl.getUniformLocation(program, 'resolution')
  const origin = gl.getUniformLocation(program, 'origin')
  const travelUniform = gl.getUniformLocation(program, 'travel')
  gl.uniform4fv(gl.getUniformLocation(program, 'routeAmplitude'), routeAmplitude)
  gl.uniform4fv(gl.getUniformLocation(program, 'routeFrequency'), routeFrequency)
  gl.enable(gl.BLEND)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  const resize = () => {
    if (lost) return
    const bounds = container.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const mobile = bounds.width < 640
    const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5)
    surface.width = Math.round(bounds.width * ratio)
    surface.height = Math.round(bounds.height * ratio)
    starCount = mobile ? 540 : stars
    const x = bounds.width / 2
    const y = bounds.height / 2
    surface.style.setProperty('--warp-x', `${x}px`)
    surface.style.setProperty('--warp-y', `${y}px`)
    gl.viewport(0, 0, surface.width, surface.height)
    // CSS pixels keep the streak widths consistent across displays.
    gl.uniform2f(resolution, bounds.width, bounds.height)
    gl.uniform2f(origin, x, bounds.height - y)
  }
  const draw = (now: number) => {
    if (previous) {
      const delta = Math.min((now - previous) / 1000, 0.05)
      const midpoint = travel + travelRate(travel) * delta * 0.5
      travel += travelRate(midpoint) * delta
    }
    previous = now
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(travelUniform, travel)
    gl.drawArrays(gl.TRIANGLES, 0, starCount * verticesPerStar)
    container.classList.add('warp-ready')
    frame = requestAnimationFrame(draw)
  }
  const sync = () => {
    if (motion.matches || lost || !visible || document.hidden) {
      stop()
      if (motion.matches || lost) container.classList.remove('warp-ready')
    } else if (!frame) {
      resize()
      frame = requestAnimationFrame(draw)
    }
  }
  const contextLost = () => {
    lost = true
    sync()
  }
  const sizes = new ResizeObserver(resize)
  sizes.observe(container)
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting
    sync()
  })
  intersection.observe(container)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', sync)
  motion.addEventListener('change', sync)
  surface.addEventListener('webglcontextlost', contextLost)
  dispose = () => {
    sizes.disconnect()
    intersection.disconnect()
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', sync)
    motion.removeEventListener('change', sync)
    surface.removeEventListener('webglcontextlost', contextLost)
    release()
  }
})

onBeforeUnmount(() => {
  disposed = true
  dispose()
})
</script>

<template>
  <span ref="anchor" hidden aria-hidden="true" />
  <Teleport v-if="hero" :to="hero">
    <canvas ref="canvas" class="warp-background" aria-hidden="true" />
  </Teleport>
</template>
