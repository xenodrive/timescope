<script setup>
import DefaultTheme from 'vitepress/theme'
import HeroShowcase from './HeroShowcase.vue'
import LandingExamples from './LandingExamples.vue'
import WarpBackground from './WarpBackground.vue'
import './style.css'

const Layout = DefaultTheme.Layout
</script>

<template>
  <Layout>
    <template #home-hero-info-before>
      <WarpBackground />
    </template>
    <template #home-hero-after>
      <HeroShowcase />
      <LandingExamples />
    </template>
  </Layout>
</template>
