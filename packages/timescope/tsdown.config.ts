import fs from 'node:fs';
import path from 'node:path';
import RolldownInlineWorkerPlugin from 'rolldown-plugin-inline-worker';
import { defineConfig } from 'tsdown';

const root = import.meta.dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const outDir = path.join(root, '..', '..', 'dist', path.basename(pkg.name));

function replaceRecursive(obj: object, replacer: (s: string, k: string) => string) {
  const results = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      results[key] = replacer(obj[key], key);
    } else if (typeof obj[key] === 'object') {
      results[key] = replaceRecursive(obj[key], replacer);
    } else {
      results[key] = obj[key];
    }
  }
  return results;
}

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
    dts: {
      resolve: true,
    },
    clean: false,
    outputOptions: {
      dir: outDir,
    },
    onSuccess() {
      fs.copyFileSync('./README.md', path.join(outDir, 'README.md'));
      fs.writeFileSync(
        path.join(outDir, 'package.json'),
        JSON.stringify(
          {
            ...pkg,
            types: './index.d.ts',
            main: './index.js',
            exports: {
              '.': {
                types: './index.d.ts',
                browser: './browser.js',
                import: './index.js',
                require: './index.js',
              },
            },
            imports: undefined,
            dependencies: replaceRecursive(pkg.dependencies, (s, k) => {
              if (s !== 'workspace:*') return s;

              const ppkg = JSON.parse(fs.readFileSync(path.join(root, 'packages', k, 'package.json'), 'utf-8'));
              if (ppkg?.version) return `^${ppkg.version}`;
              return '*';
            }),
            devDependencies: undefined,
            scripts: undefined,
            private: undefined,
          },
          null,
          2,
        ),
      );
    },
  },
  {
    ...configBase,
    entry: path.join(root, 'src/index.browser.ts'),
    format: ['iife'],
    clean: false,
    noExternal: () => true,
    outputOptions: {
      dir: undefined,
      file: path.join(outDir, 'browser.js'),
    },
  },
]);
