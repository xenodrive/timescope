<script setup>
import DefaultTheme from 'vitepress/theme'
import HeroTimeline from './HeroTimeline.vue'
import './style.css';

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-info-after>
      <br />
      <HeroTimeline />
    </template>
  </Layout>
</template>
