<script setup>
import DefaultTheme from 'vitepress/theme'
import HeroTimeline from './HeroTimeline.vue'
import './style.css';
import { h, nextTick, watch } from "vue";
import { useData } from "vitepress";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";

const Layout = () => {
    const { isDark } = useData();

    const initMermaid = () => {
      const mermaidRenderer = createMermaidRenderer({
        theme: isDark.value ? "dark" : "forest",
        sequence: {
          useMaxWidth: true,
        },
      });
    };

    // initial mermaid setup
    nextTick(() => initMermaid());

    // on theme change, re-render mermaid charts
    watch(
      () => isDark.value,
      () => {
        initMermaid();
      },
    );

    return h(DefaultTheme.Layout);
};


</script>

<template>
  <Layout>
    <template #home-hero-info-after>
      <br />
      <HeroTimeline />
    </template>
  </Layout>
</template>
