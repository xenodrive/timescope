import fs from 'node:fs';
import path from 'node:path';
import RolldownInlineWorkerPlugin from 'rolldown-plugin-inline-worker';
import { defineConfig } from 'tsdown';
import { getCommonConfig, writePackageJson } from '../../tsdown.config.common.ts';

const { root, outDir, ...config } = getCommonConfig(import.meta.dirname, {
  plugins: [RolldownInlineWorkerPlugin()],
});

const configBase = defineConfig({
  entry: path.join(root, 'src/index.ts'),
  minify: true,
  cwd: root,
  plugins: [RolldownInlineWorkerPlugin()],
  sourcemap: false,
});

export default defineConfig([
  {
    ...configBase,
    format: ['esm'],
    fixedExtension: false,
    dts: true,
    clean: false,
    outputOptions: {
      dir: outDir,
    },
    onSuccess() {
      fs.copyFileSync('./README.md', path.join(outDir, 'README.md'));
      writePackageJson({
        config: { root, outDir, ...config },
        exports: {
          '.': {
            types: './index.d.ts',
            import: './index.js',
            require: './index.js',
          },
          './browser.js': './browser.js',
        },
      });
    },
  },
  {
    ...configBase,
    entry: path.join(root, 'src/index.browser.ts'),
    inlineOnly: ['@kikuchan/decimal', '@kikuchan/calendar'],
    format: ['iife'],
    clean: false,
    noExternal: () => true,
    outputOptions: {
      entryFileNames: 'browser.js',
      dir: outDir,
    },
  },
]);
