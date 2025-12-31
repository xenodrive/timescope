export default {
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-svelte'],

  printWidth: 120,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: true,
  arrowParens: 'always',
  overrides: [
    {
      files: '*.svelte',
      options: {
        parser: 'svelte',
      },
    },
  ],

  organizeImportsSkipDestructiveCodeActions: true,
};
