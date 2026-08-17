import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsdown';
import { emitDeclarations, getCommonConfig, writePackageJson } from '../../tsdown.config.common.ts';

const root = import.meta.dirname;
const { configBase, outDir, ...config } = getCommonConfig(root);

export default defineConfig({
  ...configBase,
  entry: ['./src/lib/index.ts'],
  dts: false,
  inputOptions: {
    ...configBase.inputOptions,
    external: [/\.svelte$/],
  },
  async onSuccess() {
    await emitDeclarations('src/lib/index.ts', 'src/lib', outDir, root);
    fs.copyFileSync(path.join(root, 'src/lib/Timescope.svelte'), path.join(outDir, 'Timescope.svelte'));
    writePackageJson({
      config: { root, outDir, ...config },
      exports: {
        '.': {
          types: './index.d.ts',
          svelte: './index.js',
          import: './index.js',
          require: './index.js',
        },
      },
    });
  },
});
