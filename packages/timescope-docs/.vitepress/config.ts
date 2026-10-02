import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { apiMarkdown } from './api-markdown.ts';
import { docSections } from './doc-sections.ts';

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
    config(md) {
      apiMarkdown(md);
      docSections(md);
    },
    //lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  themeConfig: {
    search: {
      provider: 'local',
    },
    logo: '/logo.svg',
    outline: 'deep',
    nav: [
      {
        text: 'Guide',
        link: '/guide/getting-started',
        activeMatch: '^/guide/',
      },
      { text: 'Examples', link: '/examples/gallery', activeMatch: '^/examples/' },
      { text: 'API', link: '/api/', activeMatch: '^/api/' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/xenodrive/timescope' }],
    sidebar: (() => {
      const shared = [
        {
          text: 'Guide',
          link: '/guide/getting-started',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Core Concepts', link: '/guide/concepts' },
            { text: 'Drawing a Chart', link: '/guide/drawing-a-chart' },
            {
              text: 'Advanced',
              link: '/guide/advanced/data',
              collapsed: false,
              items: [
                { text: 'Loading and Updating Data', link: '/guide/advanced/data' },
                { text: 'Controlling Views', link: '/guide/advanced/views' },
                { text: 'Numbers and Calendar Time', link: '/guide/advanced/numbers-and-time' },
                { text: 'Rendering Backends', link: '/guide/advanced/backends' },
                { text: 'Styling', link: '/guide/advanced/styling' },
              ],
            },
            {
              text: 'Framework Bindings',
              link: '/guide/advanced/frameworks/overview',
              collapsed: true,
              items: [
                { text: 'Overview', link: '/guide/advanced/frameworks/overview' },
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
          link: '/examples/gallery',
          items: [
            { text: 'Gallery', link: '/examples/gallery' },
            { text: 'Playground', link: '/examples/playground' },
          ],
        },
        {
          text: 'API Reference',
          link: '/api/',
          items: [
            { text: 'Overview', link: '/api/' },
            {
              text: 'Timescope',
              collapsed: false,
              items: [
                { text: 'Classes', link: '/api/classes' },
                { text: 'Interfaces', link: '/api/interfaces' },
                { text: 'Types', link: '/api/types' },
                { text: 'Utilities', link: '/api/utilities' },
              ],
            },
            { text: 'Framework Components', link: '/api/frameworks' },
          ],
        },
      ];
      return {
        '/guide/': shared,
        '/examples/': shared,
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
