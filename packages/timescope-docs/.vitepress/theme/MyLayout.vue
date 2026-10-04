<script setup>
import DefaultTheme from 'vitepress/theme';
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
</script>

<template>
  <Layout>
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
