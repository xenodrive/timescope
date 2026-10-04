<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { normalTravel, type TravelState } from './time-travel';
import type { WarpMessage, WarpReply, WarpSize } from './warp-background.worker';

const anchor = ref<HTMLElement>();
const props = withDefaults(defineProps<{ travel?: TravelState }>(), { travel: () => normalTravel });
const canvas = ref<HTMLCanvasElement>();
const hero = shallowRef<HTMLElement>();
let dispose = () => {};
let disposed = false;

onMounted(async () => {
  hero.value = anchor.value?.closest<HTMLElement>('.VPHero') ?? undefined;
  await nextTick();
  if (disposed || !hero.value || !canvas.value) return;

  const container = hero.value;
  const surface = canvas.value;
  container.classList.add('select-none');
  dispose = () => container.classList.remove('select-none');
  if (typeof Worker === 'undefined' || !surface.transferControlToOffscreen) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let worker: Worker | undefined;
  let ready = false;
  let failed = false;
  let visible =
    container.getBoundingClientRect().bottom > 0 && container.getBoundingClientRect().top < window.innerHeight;
  let lastSize: WarpSize | undefined;
  let lastRunning: boolean | undefined;
  let drag: { pointerId: number; x: number; y: number } | undefined;

  const running = () => visible && !document.hidden && !motion.matches;
  const send = (message: WarpMessage) => worker?.postMessage(message);
  const syncTravel = () => {
    container.style.setProperty('--travel-dawn', String(props.travel.dawn));
    container.classList.toggle('travel-dawn', props.travel.dawn > 0.5);
    send({ type: 'travel', travel: { ...props.travel } });
  };
  const unwatch = watch(() => props.travel, syncTravel);
  syncTravel();
  const release = () => {
    if (!drag) return;
    const { pointerId } = drag;
    drag = undefined;
    send({ type: 'input', input: null });
    if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
  };
  const pointerDown = (event: PointerEvent) => {
    if (props.travel.dawn >= 1) return;
    if (event.button !== 0 || !event.isPrimary || drag || !running() || !ready) return;
    const target = event.target;
    // Keep page scrolling available everywhere except the Hero logo.
    if (event.pointerType !== 'mouse' && !(target instanceof Element && target.closest('.image-container'))) return;
    if (
      target instanceof Element &&
      target.closest('a, button, input, select, textarea, [role="button"], [contenteditable], .landing-install-command')
    )
      return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    send({ type: 'input', input: { x: 0, y: 0 } });
    container.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerId !== drag?.pointerId) return;
    // Also recover if the mouse was released outside the browser and returned.
    if (event.pointerType === 'mouse' && !(event.buttons & 1)) return release();
    const scale = Math.max(80, Math.min(container.clientWidth, container.clientHeight) * 0.25);
    const x = ((event.clientX - drag.x) / scale) * 0.35;
    const y = ((drag.y - event.clientY) / scale) * 0.35;
    drag.x = event.clientX;
    drag.y = event.clientY;
    send({ type: 'navigate', input: { x, y } });
  };
  const pointerEnd = (event: PointerEvent) => {
    if (event.pointerId === drag?.pointerId) release();
  };
  const fail = () => {
    release();
    failed = true;
    ready = false;
    container.classList.remove('warp-ready');
    worker?.terminate();
    worker = undefined;
  };
  const measure = (): WarpSize => {
    const { width, height } = container.getBoundingClientRect();
    surface.style.setProperty('--warp-x', `${width / 2}px`);
    surface.style.setProperty('--warp-y', `${height / 2}px`);
    return {
      width,
      height,
      ratio: Math.min(window.devicePixelRatio || 1, width < 640 ? 1 : 1.5),
    };
  };
  const sync = () => {
    container.classList.toggle('warp-ready', ready && !motion.matches);
    const active = running();
    if (!active) release();
    if (active && !worker && !failed) {
      try {
        worker = new Worker(new URL('./warp-background.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }: MessageEvent<WarpReply>) => {
          if (disposed || failed) return;
          if (data.type === 'error') {
            fail();
          } else {
            ready = true;
            syncTravel();
            container.classList.toggle('warp-ready', !motion.matches);
          }
        };
        worker.onerror = fail;
        worker.onmessageerror = fail;
        // Transfer before creating any rendering context on the HTML canvas.
        const offscreen = surface.transferControlToOffscreen();
        lastSize = measure();
        lastRunning = active;
        const message: WarpMessage = { type: 'init', canvas: offscreen, size: lastSize, running: active };
        worker.postMessage(message, [offscreen]);
      } catch {
        fail();
      }
    } else if (worker && active !== lastRunning) {
      lastRunning = active;
      send({ type: 'running', running: active });
    }
  };
  const resize = () => {
    if (!worker) return;
    const size = measure();
    if (size.width === lastSize?.width && size.height === lastSize?.height && size.ratio === lastSize?.ratio) return;
    lastSize = size;
    send({ type: 'resize', size });
  };
  const sizes = new ResizeObserver(resize);
  sizes.observe(container);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  });
  intersection.observe(container);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  container.addEventListener('pointerdown', pointerDown);
  container.addEventListener('lostpointercapture', pointerEnd);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerEnd);
  window.addEventListener('pointercancel', pointerEnd);
  window.addEventListener('blur', release);
  dispose = () => {
    unwatch();
    release();
    sizes.disconnect();
    intersection.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
    container.removeEventListener('pointerdown', pointerDown);
    container.removeEventListener('lostpointercapture', pointerEnd);
    window.removeEventListener('pointermove', pointerMove);
    window.removeEventListener('pointerup', pointerEnd);
    window.removeEventListener('pointercancel', pointerEnd);
    window.removeEventListener('blur', release);
    worker?.terminate();
    container.classList.remove('warp-ready', 'select-none');
    container.classList.remove('travel-dawn');
    container.style.removeProperty('--travel-dawn');
  };
  sync();
});

onBeforeUnmount(() => {
  disposed = true;
  dispose();
});
</script>

<template>
  <span ref="anchor" hidden aria-hidden="true" />
  <Teleport v-if="hero" :to="hero">
    <canvas ref="canvas" class="warp-background" aria-hidden="true" />
    <div class="travel-flash" aria-hidden="true" />
  </Teleport>
</template>
