import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withMermaid } from 'vitepress-plugin-mermaid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

export default withMermaid({
  head: [
    ['link', { rel: 'icon', href: '/timescope/logo.svg' }],
    ["meta", { property: "og:image", content: "https://xenodrive.github.io/timescope/ogp.png" }],
  ],
  title: 'Timescope',
  titleTemplate: ':title | Timescope',
  description: 'Timescope - Canvas for Time-Series Visualization',
  srcDir: './src',
  outDir: './dist',
  base: '/timescope/',
  cleanUrls: true,
  lastUpdated: false,
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  mermaid: {
    // Mermaid configuration for light/dark theme support
  },
  mermaidPlugin: {
    class: 'mermaid',
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
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xenodrive/timescope' },
    ],
    sidebar: (() => {
      const shared = [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Core Concepts', link: '/guide/concepts' },
            { text: 'Events', link: '/guide/events' },
            { text: 'Chunk Loading', link: '/guide/chunk-loading' },
            {
              text: 'Examples',
              items: [
                { text: 'Overview', link: '/guide/examples/' },
                { text: 'Simple Timeline', link: '/guide/examples/simple-timeline' },
                { text: 'Events', link: '/guide/examples/events' },
                { text: 'Basic Chart', link: '/guide/examples/basic-chart' },
                { text: 'Log Scale', link: '/guide/examples/log-scale' },
                { text: 'Chart Presets', link: '/guide/examples/chart-presets' },
                { text: 'Marks & Links', link: '/guide/examples/marks-and-links' },
                { text: 'Multiple Tracks', link: '/guide/examples/multiple-tracks' },
                { text: 'Gantt Chart', link: '/guide/examples/gantt-chart' },
                { text: 'Dynamic Loader', link: '/guide/examples/dynamic-loader' },
                { text: 'System Metrics', link: '/guide/examples/system-metrics' },
                { text: 'Log Viewer', link: '/guide/examples/log-viewer' },
                { text: 'Financial Chart', link: '/guide/examples/financial-chart' },
                { text: 'Audio Waveform', link: '/guide/examples/audio-waveform' },
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
