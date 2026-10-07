import prettierConfig from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import { defineConfig, globalIgnores } from 'eslint/config';
import ts from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default defineConfig([
  globalIgnores(['dist', 'files', 'playground', '.vite', '.local']),
  ts.configs.recommended,
  // Oxlint cannot lint SFC templates yet. Keep Vue's parser and essential rules.
  pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: ts.parser, extraFileExtensions: ['.vue'] },
    },
    rules: ts.configs.eslintRecommended.rules,
  },
  {
    rules: {
      'vue/multi-word-component-names': 0,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettierConfig,
]);
