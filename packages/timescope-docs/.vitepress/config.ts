import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

export default defineConfig({
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap',
      },
    ],
    ['link', { rel: 'icon', href: '/timescope/logo.svg' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://xenodrive.github.io/timescope/ogp.png',
      },
    ],
  ],
  title: 'Timescope',
  titleTemplate: ':title | Timescope',
  description: 'Timescope - Canvas for Time-Series Visualization',
  srcDir: './src',
  outDir: './dist',
  base: '/timescope/',
  appearance: false,
  cleanUrls: true,
  lastUpdated: false,
  markdown: {
    //lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      {
        text: 'Guide',
        link: '/guide/getting-started',
      },
      { text: 'Examples', link: '/guide/examples/' },
      { text: 'API', link: '/api/timescope' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/xenodrive/timescope' }],
    sidebar: (() => {
      const shared = [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            {
              text: 'Core Concepts',
              link: '/guide/concepts',
              items: [
                {
                  text: 'Infinite Time Navigation',
                  link: '/guide/concepts#infinite-time-navigation',
                },
                { text: 'Marks & Links', link: '/guide/concepts#marks-and-links' },
                { text: 'Chunk Loading', link: '/guide/concepts#chunk-loading' },
                { text: 'Data Pipeline', link: '/guide/concepts#data-pipeline' },
              ],
            },
            {
              text: 'Examples',
              link: '/guide/examples/',
              items: [
                {
                  text: 'Simple Timeline',
                  link: '/guide/examples/simple-timeline',
                },
                { text: 'Events', link: '/guide/examples/events' },
                { text: 'Basic Chart', link: '/guide/examples/basic-chart' },
                { text: 'Decimation', link: '/guide/examples/decimation' },
                { text: 'Log Scale', link: '/guide/examples/log-scale' },
                {
                  text: 'Chart Presets',
                  link: '/guide/examples/chart-presets',
                },
                {
                  text: 'Marks & Links',
                  link: '/guide/examples/marks-and-links',
                },
                {
                  text: 'Multiple Tracks',
                  link: '/guide/examples/multiple-tracks',
                },
                { text: 'Time Zones', link: '/guide/examples/timezones' },
                { text: 'Gantt Chart', link: '/guide/examples/gantt-chart' },
                {
                  text: 'Dynamic Loader',
                  link: '/guide/examples/dynamic-loader',
                },
                {
                  text: 'Realtime Data',
                  link: '/guide/examples/realtime-data',
                },
                {
                  text: 'System Metrics',
                  link: '/guide/examples/system-metrics',
                },
                { text: 'Log Viewer', link: '/guide/examples/log-viewer' },
                {
                  text: 'Financial Chart',
                  link: '/guide/examples/financial-chart',
                },
                {
                  text: 'Audio Waveform',
                  link: '/guide/examples/audio-waveform',
                },
                { text: 'Styling', link: '/guide/examples/styling' },
              ],
            },
          ],
        },
        {
          text: 'API Reference',
          items: [
            { text: 'Timescope', link: '/api/timescope' },
            { text: 'Timescope Options', link: '/api/timescope-options' },
            { text: 'Decimal', link: '/api/decimal' },
            { text: 'Calendar', link: '/api/calendar' },
          ],
        },
      ];
      return {
        '/guide/': shared,
        '/api/': shared,
      };
    })(),
  },
  vite: {
    resolve: {
      alias: {
        '@': pkgRoot + '/src',
        '~': pkgRoot + '/src',
      },
    },
    server: {
      fs: {
        allow: [pkgRoot],
      },
    },
  },
});
