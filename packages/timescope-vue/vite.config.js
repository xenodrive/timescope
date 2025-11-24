import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

export default defineConfig({
  plugins: [externalizeDeps(), vue()],
});
