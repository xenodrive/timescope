<script setup lang="ts">
import { withBase } from 'vitepress';
import LandingDemo from './LandingDemo.vue';
import { Icon } from '@iconify/vue';
import clockOutline from '@iconify-icons/mdi/clock-outline';
import chartTimeline from '@iconify-icons/mdi/chart-timeline';
import waveform from '@iconify-icons/mdi/waveform';
import finance from '@iconify-icons/mdi/finance';
import type { LandingExampleKind } from './landing-data';

const examples = [
  {
    kind: 'picker',
    title: 'Time Picker',
    description: 'A small interface for choosing a precise moment or a range.',
    link: 'simple-timeline',
    icon: clockOutline,
  },
  {
    kind: 'tasks',
    title: 'Timeline',
    description: 'See activities and status spans unfold over time.',
    link: 'gantt-chart',
    icon: chartTimeline,
  },
  {
    kind: 'audio',
    title: 'Waveform',
    description: 'Move from the shape of a sound to individual samples.',
    link: 'audio-waveform',
    icon: waveform,
  },
  {
    kind: 'stock',
    title: 'Chart',
    description: 'Candlesticks, moving averages, and volume in one view.',
    link: 'financial-chart',
    icon: finance,
  },
] satisfies { kind: LandingExampleKind; title: string; description: string; link: string; icon: typeof clockOutline }[];
</script>

<template>
  <section class="landing-section landing-examples" aria-label="Examples">
    <div class="landing-example-list">
      <article v-for="example in examples" :key="example.kind" class="landing-example-row">
        <header class="landing-example-caption">
          <h3>
            <Icon :icon="example.icon" aria-hidden="true" />
            <a :href="withBase(`/guide/examples/${example.link}`)">{{ example.title }}</a>
          </h3>
          <p>{{ example.description }}</p>
        </header>
        <LandingDemo :kind="example.kind" :label="example.title" />
      </article>
    </div>
  </section>
</template>
