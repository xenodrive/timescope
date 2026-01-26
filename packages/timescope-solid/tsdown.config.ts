import solid from 'rolldown-plugin-solid';
import { defineConfig } from 'tsdown';
import { getCommonConfig } from '../../tsdown.config.common.ts';

const { configBase, outDir } = getCommonConfig(import.meta.dirname, {
  plugins: [solid()],
  exports: {
    '.': {
      types: './index.d.ts',
      solid: './index.jsx',
      import: './index.js',
      require: './index.js',
    },
  },
});

export default defineConfig([
  {
    ...configBase,
    onSuccess: undefined,
  },
  {
    ...configBase,
    outExtensions: () => ({ js: '.jsx' }),
    outDir,
  },
]);
