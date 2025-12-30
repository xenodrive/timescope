import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import solid from 'eslint-plugin-solid/configs/recommended';
import { defineConfig } from 'eslint/config';
import { join } from 'node:path';
import tseslint from 'typescript-eslint';

const ignorePath = join(import.meta.dirname, '.gitignore');

export default defineConfig(
  includeIgnoreFile(ignorePath),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  solid,
  {
    rules: {
      'no-control-regex': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
