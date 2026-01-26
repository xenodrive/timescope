import { spawn } from 'node:child_process';
import { defineConfig } from 'tsdown';
import { getCommonConfig, writePackageJson } from '../../tsdown.config.common.ts';

const { outDir, ...config } = getCommonConfig(import.meta.dirname);

function sveltePackage(...args: string[]) {
  const cmd = 'svelte-package';
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

export default defineConfig({
  outDir: '.tmp',
  format: ['esm'],
  dts: false,
  minify: false,
  hooks: {
    async 'build:prepare'() {
      await sveltePackage('-o', outDir);
    },
  },
  onSuccess() {
    writePackageJson({
      config: { outDir, ...config },
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
