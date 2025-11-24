import { includeIgnoreFile } from '@eslint/compat';
import prettierConfig from '@vue/eslint-config-prettier';
//import prettierConfig from 'eslint-config-prettier/flat';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import { fileURLToPath } from 'node:url';

const gitignorePath = fileURLToPath(new URL('.prettierignore', import.meta.url));

export default defineConfigWithVueTs([
  includeIgnoreFile(gitignorePath),
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
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
