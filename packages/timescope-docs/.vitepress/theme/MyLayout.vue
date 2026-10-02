<script setup>
import DefaultTheme from 'vitepress/theme';
import LandingFeatures from './LandingFeatures.vue';
import LandingInstall from './LandingInstall.vue';
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
      <LandingInstall />
    </template>
    <template #home-hero-after>
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
