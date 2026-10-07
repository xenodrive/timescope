import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import vueConfig from '../timescope-vue/eslint.config.js';

export default defineConfig([
  globalIgnores(['dist', '.vitepress/cache', '.vitepress/dist', 'src/public']),
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['**/*.{ts,tsx,mts,cts,vue}'], extends: [vueConfig] },
]);
