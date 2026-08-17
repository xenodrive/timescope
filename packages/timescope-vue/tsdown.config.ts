import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsdown';
import { emitDeclarations, getCommonConfig, writePackageJson } from '../../tsdown.config.common.ts';

const root = import.meta.dirname;
const { configBase, outDir, ...config } = getCommonConfig(root);

export default defineConfig({
  ...configBase,
  dts: false,
  inputOptions: {
    ...configBase.inputOptions,
    external: [/\.vue$/],
  },
  async onSuccess() {
    await emitDeclarations('src/index.ts', 'src', outDir, root);
    fs.copyFileSync(path.join(root, 'src/Timescope.vue'), path.join(outDir, 'Timescope.vue'));
    writePackageJson({
      config: { root, outDir, ...config },
      exports: {
        '.': {
          types: './index.d.ts',
          import: './index.js',
          require: './index.js',
        },
      },
    });
  },
});
