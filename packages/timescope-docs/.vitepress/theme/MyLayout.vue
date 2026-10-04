<script setup>
import { useData } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { nextTick, ref, watch } from 'vue';
import LandingFeatures from './LandingFeatures.vue';
import LandingInstall from './LandingInstall.vue';
import LandingPrintExamples from './LandingPrintExamples.vue';
import LandingPrintGesture from './LandingPrintGesture.vue';
import { Icon } from '@iconify/vue';
import github from '@iconify-icons/mdi/github';
import WarpBackground from './WarpBackground.vue';
import './style.css';
import './landing.css';
import './api.css';
import './doc-sections.css';
import './print.css';
import { useStickyGroups } from './useStickyGroups';

useStickyGroups();

const Layout = DefaultTheme.Layout;
const { frontmatter } = useData();
const enteringHome = ref(false);

watch(
  () => frontmatter.value.layout === 'home',
  (isHome, _, onCleanup) => {
    if (!isHome || typeof window === 'undefined') return;

    enteringHome.value = true;
    let frame;
    let cancelled = false;

    onCleanup(() => {
      cancelled = true;
      cancelAnimationFrame(frame);
      enteringHome.value = false;
    });

    // Paint the new page and its restored scroll position before enabling transitions.
    nextTick(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          enteringHome.value = false;
        });
      });
    });
  },
);
</script>

<template>
  <Layout :class="{ 'entering-home': enteringHome }">
    <template #home-hero-info-before>
      <WarpBackground />
    </template>
    <template #home-hero-info-after>
      <p class="landing-print-description">
        It’s an embeddable JavaScript / TypeScript library. Add a time slider to your app in just a few lines.
      </p>
      <LandingInstall />
      <LandingPrintGesture />
    </template>
    <template #home-hero-after>
      <LandingPrintExamples />
      <LandingFeatures />
      <footer class="landing-print-footer">
        <span>For more details, visit:</span>
        <a href="https://github.com/xenodrive/timescope">
          <Icon :icon="github" aria-hidden="true" />
          https://github.com/xenodrive/timescope
        </a>
      </footer>
    </template>
  </Layout>
</template>
