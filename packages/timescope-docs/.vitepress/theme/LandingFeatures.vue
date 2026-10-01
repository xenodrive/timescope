<script setup lang="ts">
import { Icon } from '@iconify/vue';
import cursorPointer from '@iconify-icons/mdi/cursor-pointer';
import orbit from '@iconify-icons/mdi/orbit';
import atom from '@iconify-icons/mdi/atom';
import compass from '@iconify-icons/mdi/compass';
import infinity from '@iconify-icons/mdi/infinity';
import layers from '@iconify-icons/mdi/layers-triple';
import chunks from '@iconify-icons/mdi/view-column';
import worker from '@iconify-icons/mdi/engine';
import rocketLaunch from '@iconify-icons/mdi/rocket-launch';

const features = [
  {
    title: 'Smooth Navigation',
    kind: 'pan',
    icon: compass,
    description: 'Grab the time axis like a map. Pan freely, zoom smoothly, and keep your moment in focus.',
  },
  {
    title: 'Smooth Animation',
    kind: 'worker',
    icon: worker,
    description:
      'Canvas draws dense data efficiently. A dedicated Worker renders and animates while your app loads and processes data asynchronously.',
  },
  {
    title: 'Explore Any Era',
    kind: 'era',
    icon: orbit,
    description:
      'Travel from the dawn of time to distant aeons. Arbitrary-precision coordinates let you explore any moment on the time axis.',
  },
  {
    title: 'Zoom to Any Scale',
    kind: 'precision',
    icon: infinity,
    description:
      'From the age of the universe to quark lifetimes. One arbitrary-precision time axis spans an extraordinary dynamic range.',
  },
  {
    title: 'Compose Your View',
    kind: 'views',
    icon: layers,
    description: 'Combine graphs, events, and overlapping time spans. Different data, the same map-like navigation.',
  },
  {
    title: 'Load Efficiently',
    kind: 'chunks',
    icon: chunks,
    description:
      'Load only what you need, at the detail you need. Chunks follow the visible time range and resolution.',
  },
];
</script>

<template>
  <section class="landing-section landing-features" aria-label="Features">
    <div class="landing-feature-grid">
      <article
        v-for="feature in features"
        :key="feature.kind"
        class="landing-feature"
        :class="`landing-feature--${feature.kind}`">
        <h3>
          <span class="landing-feature-icon" aria-hidden="true"><Icon :icon="feature.icon" /></span>{{ feature.title }}
        </h3>
        <p>{{ feature.description }}</p>
        <svg
          class="landing-feature-diagram"
          viewBox="0 0 300 112"
          role="img"
          :aria-label="feature.title + ' diagram'"
          fill="none">
          <template v-if="feature.kind === 'pan'">
            <rect x="95" y="32" width="110" height="48" fill="#60a5fa" fill-opacity=".18" />
            <path d="M95 32V80M205 32V80" stroke="#008dff" stroke-width="1.5" />
            <path class="diagram-axis" d="M12 56H288M12 102H288" />
            <path
              class="diagram-ticks"
              d="M30 50V60M70 50V60M110 50V60M150 50V60M190 50V60M230 50V60M270 50V60M30 97V107M90 97V107M150 97V107M210 97V107M270 97V107" />
            <text x="30" y="73" text-anchor="middle">10:00</text>
            <text x="150" y="73" text-anchor="middle">13:00</text>
            <text x="270" y="73" text-anchor="middle">16:00</text>
            <path
              d="M129 40H66l10-7m-10 7 10 7M175 40h59l-10-7m10 7-10 7"
              stroke="#008dff"
              stroke-width="3"
              stroke-linejoin="round" />
            <Icon :icon="cursorPointer" x="135" y="30" width="30" height="30" color="var(--landing-diagram-pointer)" />
            <path class="diagram-dashed" d="M95 80 30 97M205 80 270 97" />
            <text x="150" y="92" text-anchor="middle">Zoom along time</text>
          </template>
          <template v-else-if="feature.kind === 'era'">
            <path d="M18 54H284l-8-5m8 5-8 5" stroke="#38a1ff" stroke-width="2" />
            <path d="M40 22V44m-11-17 7 13m15-13-7 13M23 39l12 5m22-5-12 5" stroke="#f5a623" stroke-width="1.5" />
            <circle cx="40" cy="54" r="5" fill="#f5a623" />
            <circle cx="150" cy="54" r="5" fill="#10b981" />
            <circle cx="255" cy="54" r="5" fill="#8b5cf6" />
            <Icon :icon="rocketLaunch" x="240" y="15" width="30" height="30" color="#8b5cf6" />
            <text x="40" y="79" text-anchor="middle">Dawn of Time</text>
            <text x="150" y="79" text-anchor="middle">Now</text>
            <text x="255" y="79" text-anchor="middle">Distant Aeons</text>
            <text x="150" y="105" text-anchor="middle">Choose when.</text>
          </template>
          <template v-else-if="feature.kind === 'precision'">
            <Icon :icon="orbit" x="25" y="15" width="30" height="30" color="#f5a623" />
            <Icon :icon="atom" x="240" y="15" width="30" height="30" color="#8b5cf6" />
            <path d="M18 54H284l-8-5m8 5-8 5" stroke="#38a1ff" stroke-width="2" />
            <circle cx="40" cy="54" r="5" fill="#f5a623" />
            <circle cx="150" cy="54" r="5" fill="#10b981" />
            <circle cx="255" cy="54" r="5" fill="#8b5cf6" />
            <text x="40" y="79" text-anchor="middle">Age of the</text>
            <text x="40" y="93" text-anchor="middle">universe</text>
            <text x="150" y="79" text-anchor="middle">Seconds</text>
            <text x="255" y="79" text-anchor="middle">Quark</text>
            <text x="255" y="93" text-anchor="middle">lifetimes</text>
            <text x="150" y="105" text-anchor="middle">Choose the detail.</text>
          </template>
          <template v-else-if="feature.kind === 'views'">
            <path class="diagram-axis" d="M12 37H220M12 63H220M12 103H220" />
            <g fill="#80d8c1">
              <path d="M23 37V25h9v12M55 37V18h9v19M87 37V27h9v10M119 37V10h9v27M151 37V20h9v17M183 37V15h9v22" />
            </g>
            <path d="M12 30 43 17 72 25 103 9 136 21 167 13 197 22 220 10" stroke="#f5a623" stroke-width="2" />
            <g v-for="(x, i) in [38, 84, 127, 190]" :key="x" :fill="['#38bdf8', '#a78bfa', '#fbbf24', '#34d399'][i]">
              <path :d="`M${x} 63V49`" stroke="currentColor" />
              <circle :cx="x" cy="49" r="4" />
            </g>
            <rect x="20" y="77" width="65" height="9" rx="3" fill="#7dc4ff" />
            <rect x="65" y="90" width="58" height="9" rx="3" fill="#c49af2" />
            <rect x="135" y="77" width="70" height="9" rx="3" fill="#64dfb4" />
            <path class="diagram-cursor" d="M110 4V107" />
            <text x="235" y="27">Data</text>
            <text x="235" y="61">Events</text>
            <text x="235" y="92">Spans</text>
          </template>
          <template v-else-if="feature.kind === 'chunks'">
            <rect x="83" y="24" width="134" height="62" rx="4" fill="#60a5fa" fill-opacity=".12" />
            <text x="150" y="18" text-anchor="middle">Visible viewport</text>
            <path d="M86 29h128m-120-5-8 5 8 5m112-10 8 5-8 5" stroke="#008dff" stroke-width="1.5" />
            <rect
              v-for="i in 12"
              :key="i"
              :x="18 + (i - 1) * 22"
              y="45"
              width="20"
              height="27"
              rx="3"
              fill="#39a5f5"
              :fill-opacity="i >= 4 && i <= 9 ? 0.65 : 0.18" />
            <path class="diagram-cursor" d="M150 36V82" />
            <text x="7" y="63" text-anchor="middle">…</text>
            <text x="293" y="63" text-anchor="middle">…</text>
            <text x="150" y="104" text-anchor="middle">Just the range. Just the detail.</text>
          </template>
          <template v-else>
            <rect x="10" y="20" width="116" height="75" rx="7" fill="var(--landing-diagram-main-bg)" stroke="#b99ae8" />
            <rect
              x="174"
              y="20"
              width="116"
              height="75"
              rx="7"
              fill="var(--landing-diagram-worker-bg)"
              stroke="#67b8f4" />
            <text x="68" y="40" text-anchor="middle" class="diagram-strong">Main thread</text>
            <text x="68" y="60" text-anchor="middle">load &amp; process</text>
            <text x="68" y="77" text-anchor="middle">your data</text>
            <path d="M134 48h31l-6-5m6 5-6 5M165 69h-31l6-5m-6 5 6 5" stroke="#008dff" stroke-width="2" />
            <text x="232" y="40" text-anchor="middle" class="diagram-strong">Worker</text>
            <text x="232" y="60" text-anchor="middle">render &amp; animate</text>
            <text x="232" y="77" text-anchor="middle">Canvas</text>
          </template>
        </svg>
      </article>
    </div>
  </section>
</template>
