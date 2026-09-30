import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { examples } from '../src/guide/examples/catalog.ts';

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
  appearance: true,
  cleanUrls: true,
  lastUpdated: false,
  markdown: {
    math: true,
    //lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    outline: 'deep',
    nav: [
      {
        text: 'Guide',
        link: '/guide/',
      },
      { text: 'Examples', link: '/guide/examples/' },
      { text: 'API', link: '/api/' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/xenodrive/timescope' }],
    sidebar: (() => {
      const shared = [
        {
          text: 'Guide',
          link: '/guide/',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Core Concepts', link: '/guide/concepts' },
            { text: 'Drawing a Chart', link: '/guide/drawing-a-chart' },
            {
              text: 'Advanced',
              link: '/guide/advanced/',
              items: [
                { text: 'Loading and Updating Data', link: '/guide/advanced/data' },
                { text: 'Controlling Views', link: '/guide/advanced/views' },
                { text: 'Rendering Backends', link: '/guide/advanced/backends' },
                { text: 'Styling', link: '/guide/advanced/styling' },
              ],
            },
            {
              text: 'Framework Bindings',
              link: '/guide/advanced/frameworks',
              collapsed: true,
              items: [
                { text: 'Vue', link: '/guide/advanced/frameworks/vue' },
                { text: 'React', link: '/guide/advanced/frameworks/react' },
                { text: 'Svelte', link: '/guide/advanced/frameworks/svelte' },
                { text: 'Solid', link: '/guide/advanced/frameworks/solid' },
                { text: 'Luna', link: '/guide/advanced/frameworks/luna' },
              ],
            },
          ],
        },
        {
          text: 'Examples',
          link: '/guide/examples/',
          items: [
            ...examples.map(({ name, title }) => ({ text: title, link: `/guide/examples/#${name}` })),
            { text: 'Playground', link: '/guide/examples/playground' },
          ],
        },
        {
          text: 'API Reference',
          link: '/api/',
          items: [
            { text: 'Timescope', link: '/api/timescope' },
            { text: 'Timescope Options', link: '/api/timescope-options' },
            { text: 'Framework Components', link: '/api/frameworks' },
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
