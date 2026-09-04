import { defineConfig } from 'vite';

export default defineConfig({
  root: './playground',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@luna_ui/luna',
  },
});
