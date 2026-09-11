<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { WarpMessage, WarpReply, WarpSize } from './warp-background.worker'

const anchor = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const hero = shallowRef<HTMLElement>()
let dispose = () => {}
let disposed = false

onMounted(async () => {
  hero.value = anchor.value?.closest<HTMLElement>('.VPHero') ?? undefined
  await nextTick()
  if (disposed || !hero.value || !canvas.value) return

  const container = hero.value
  const surface = canvas.value
  if (typeof Worker === 'undefined' || !surface.transferControlToOffscreen) return

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let worker: Worker | undefined
  let ready = false
  let failed = false
  let visible = container.getBoundingClientRect().bottom > 0
    && container.getBoundingClientRect().top < window.innerHeight
  let lastSize: WarpSize | undefined
  let lastRunning: boolean | undefined

  const running = () => visible && !document.hidden && !motion.matches
  const send = (message: WarpMessage) => worker?.postMessage(message)
  const fail = () => {
    failed = true
    ready = false
    container.classList.remove('warp-ready')
    worker?.terminate()
    worker = undefined
  }
  const measure = (): WarpSize => {
    const { width, height } = container.getBoundingClientRect()
    surface.style.setProperty('--warp-x', `${width / 2}px`)
    surface.style.setProperty('--warp-y', `${height / 2}px`)
    return {
      width,
      height,
      ratio: Math.min(window.devicePixelRatio || 1, width < 640 ? 1 : 1.5),
    }
  }
  const sync = () => {
    container.classList.toggle('warp-ready', ready && !motion.matches)
    const active = running()
    if (active && !worker && !failed) {
      try {
        worker = new Worker(new URL('./warp-background.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }: MessageEvent<WarpReply>) => {
          if (disposed || failed) return
          if (data.type === 'error') {
            fail()
          } else {
            ready = true
            container.classList.toggle('warp-ready', !motion.matches)
          }
        }
        worker.onerror = fail
        worker.onmessageerror = fail
        // Transfer before creating any rendering context on the HTML canvas.
        const offscreen = surface.transferControlToOffscreen()
        lastSize = measure()
        lastRunning = active
        const message: WarpMessage = { type: 'init', canvas: offscreen, size: lastSize, running: active }
        worker.postMessage(message, [offscreen])
      } catch {
        fail()
      }
    } else if (worker && active !== lastRunning) {
      lastRunning = active
      send({ type: 'running', running: active })
    }
  }
  const resize = () => {
    if (!worker) return
    const size = measure()
    if (size.width === lastSize?.width && size.height === lastSize?.height && size.ratio === lastSize?.ratio) return
    lastSize = size
    send({ type: 'resize', size })
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
  dispose = () => {
    sizes.disconnect()
    intersection.disconnect()
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', sync)
    motion.removeEventListener('change', sync)
    worker?.terminate()
    container.classList.remove('warp-ready')
  }
  sync()
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
