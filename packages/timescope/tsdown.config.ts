import fs from 'node:fs';
import path from 'node:path';
import RolldownInlineWorkerPlugin from 'rolldown-plugin-inline-worker';
import { defineConfig } from 'tsdown';
import { getCommonConfig, writePackageJson } from '../../tsdown.config.common.ts';

const { root, outDir, ...config } = getCommonConfig(import.meta.dirname, {
  plugins: [RolldownInlineWorkerPlugin()],
});
const profileBuild = process.env.BENCHMARK_PROFILE_BUILD === '1';
const fontImport = '../assets/Timescope.woff2?inline';
const fontId = '\0timescope-font';
const fontPath = path.join(root, 'src/assets/Timescope.woff2');

const inlineFontPlugin = {
  name: 'inline-timescope-font',
  resolveId(source: string) {
    if (source === fontImport) return fontId;
  },
  load(this: { addWatchFile(file: string): void }, id: string) {
    if (id !== fontId) return;
    this.addWatchFile(fontPath);
    const url = `data:font/woff2;base64,${fs.readFileSync(fontPath).toString('base64')}`;
    return `export default ${JSON.stringify(url)};`;
  },
};

const configBase = defineConfig({
  entry: path.join(root, 'src/index.ts'),
  minify: !profileBuild,
  cwd: root,
  plugins: [RolldownInlineWorkerPlugin(), inlineFontPlugin],
  sourcemap: profileBuild,
  deps: { neverBundle: ['skia-canvas'] },
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
            browser: './index.browser.js',
            node: './index.node.js',
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
    entry: path.join(root, 'src/index.node.ts'),
    format: ['esm'],
    fixedExtension: false,
    dts: false,
    clean: false,
    outputOptions: { dir: outDir },
  },
  {
    ...configBase,
    entry: path.join(root, 'src/index.browser.ts'),
    format: ['esm'],
    fixedExtension: false,
    dts: false,
    clean: false,
    outputOptions: { dir: outDir },
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
