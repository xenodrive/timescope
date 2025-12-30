import fs from 'node:fs';
import path from 'node:path';
import RolldownInlineWorkerPlugin from 'rolldown-plugin-inline-worker';
import { defineConfig } from 'tsdown';

function pkgPath(pkgName: string) {
  return pkgName.replace('/', '--');
}

const root = import.meta.dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const outDir = path.join(root, '..', '..', 'dist', pkgPath(pkg.name));
const rootpkgAll = JSON.parse(fs.readFileSync(path.join(root, '..', '..', 'package.json'), 'utf-8'));
const rootpkg = Object.fromEntries(
  ['type', 'version', 'author', 'license', 'homepage', 'repository'].map((k) => [k, rootpkgAll[k]]),
);

function replaceRecursive(obj: Record<string, unknown>, replacer: (s: string, k: string) => string) {
  const results: Record<string, unknown> = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      results[key] = replacer(obj[key], key);
    } else if (typeof obj[key] === 'object') {
      results[key] = replaceRecursive(obj[key] as Record<string, unknown>, replacer);
    } else {
      results[key] = obj[key];
    }
  }
  return results;
}

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm'],
  minify: true,
  sourcemap: false,
  platform: 'neutral',
  plugins: [RolldownInlineWorkerPlugin()],
  dts: true,

  outDir,

  onSuccess() {
    const pkgJson = {
      name: pkg.name,
      ...rootpkg,
      ...pkg,
      keywords: [...rootpkgAll.keywords, ...(pkg.keywords ?? [])],
      types: './index.d.ts',
      main: './index.js',
      exports: {
        '.': {
          types: './index.d.ts',
          import: './index.js',
          require: './index.js',
        },
      },
      dependencies: replaceRecursive(pkg.dependencies, (s, k) => {
        if (s !== 'workspace:*') return s;

        if (rootpkg?.version) return `^${rootpkg.version}`;
        return '*';
      }),
      devDependencies: undefined,
      scripts: undefined,
      private: undefined,
    };

    fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  },
});
