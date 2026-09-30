import fs from 'node:fs';
import path from 'node:path';
import RolldownInlineWorkerPlugin from 'rolldown-plugin-inline-worker';
import { defineConfig } from 'tsdown';
import { getCommonConfig, writePackageJson } from '../../tsdown.config.common.ts';

const { root, outDir, ...config } = getCommonConfig(import.meta.dirname, {
  plugins: [RolldownInlineWorkerPlugin()],
});
const profileBuild = process.env.BENCHMARK_PROFILE_BUILD === '1';

const configBase = defineConfig({
  entry: path.join(root, 'src/index.browser.ts'),
  minify: !profileBuild,
  cwd: root,
  plugins: [RolldownInlineWorkerPlugin()],
  sourcemap: profileBuild,
  deps: { neverBundle: ['skia-canvas'] },
});

export default defineConfig([
  {
    ...configBase,
    entry: { index: path.join(root, 'src/index.browser.ts') },
    format: ['esm'],
    fixedExtension: false,
    dts: true,
    clean: false,
    outputOptions: {
      dir: outDir,
    },
    onSuccess() {
      fs.copyFileSync('./README.md', path.join(outDir, 'README.md'));
      fs.copyFileSync(path.join(root, 'src/assets/fonts/Timescope.woff2'), path.join(outDir, 'Timescope.woff2'));
      writePackageJson({
        config: { root, outDir, ...config },
        exports: {
          '.': {
            types: './index.d.ts',
            node: './index.node.js',
            default: './index.js',
          },
          './browser.js': './browser.js',
          './Timescope.woff2': './Timescope.woff2',
        },
      });
    },
  },
  {
    ...configBase,
    entry: path.join(root, 'src/index.node.ts'),
    format: ['esm'],
    fixedExtension: false,
    dts: false,
    clean: false,
    outputOptions: { dir: outDir },
  },
  {
    ...configBase,
    entry: path.join(root, 'src/browser.ts'),
    format: ['iife'],
    globalName: '__timescope',
    clean: false,
    deps: {
      alwaysBundle: () => true,
    },
    outputOptions: {
      entryFileNames: 'browser.js',
      dir: outDir,
    },
  },
]);
