import fs from 'node:fs';
import path from 'node:path';
import solid from 'rolldown-plugin-solid';
import { defineConfig } from 'tsdown';

function pkgPath(pkgName: string) {
  return pkgName.replace('/', '--');
}

const root = import.meta.dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const outDir = path.join(root, '..', '..', 'dist', pkgPath(pkg.name));

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

// export both js and jsx
export default defineConfig([
  {
    platform: 'neutral',
    // use the solid plugin to handle jsx
    plugins: [solid()],
    outDir,
  },
  {
    platform: 'neutral',
    outExtensions: () => ({ js: '.jsx' }),
    outDir,

    onSuccess() {
      const pkgJson = {
        ...pkg,
        types: './index.d.ts',
        main: './index.js',
        exports: {
          '.': {
            types: './index.d.ts',
            solid: './index.jsx',
            import: './index.js',
            require: './index.js',
          },
        },
        dependencies: replaceRecursive(pkg.dependencies, (s, k) => {
          if (s !== 'workspace:*') return s;

          const ppkg = JSON.parse(fs.readFileSync(path.join(root, '..', pkgPath(k), 'package.json'), 'utf-8'));
          if (ppkg?.version) return `^${ppkg.version}`;
          return '*';
        }),
        devDependencies: undefined,
        scripts: undefined,
        private: undefined,
      };

      // XXX: sync package version
      pkgJson.version = pkgJson.dependencies.timescope.substring(1);

      fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
    },
  },
]);
