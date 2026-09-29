import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { UserConfig, PluginOption } from 'tsdown';

export function pkgPath(pkgName: string) {
  return pkgName.replace('/', '--');
}

export function emitDeclarations(entry: string, rootDir: string, outDir: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn(
      'tsc',
      [
        '--ignoreConfig',
        entry,
        '--declaration',
        '--emitDeclarationOnly',
        '--noCheck',
        '--module',
        'ESNext',
        '--moduleResolution',
        'Bundler',
        '--target',
        'ESNext',
        '--rootDir',
        rootDir,
        '--outDir',
        outDir,
      ],
      { cwd, stdio: 'inherit' },
    );
    process.on('error', reject);
    process.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tsc exited with ${code}`))));
  });
}

export function replaceRecursive(obj: Record<string, unknown>, replacer: (s: string, k: string) => string) {
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

export interface CommonConfig {
  root: string;
  pkg: Record<string, unknown>;
  outDir: string;
  rootpkgAll: Record<string, unknown>;
  rootpkg: Record<string, unknown>;
  configBase: UserConfig;
}

export interface GetCommonConfigOptions {
  plugins?: PluginOption[];
  dts?: boolean | { vue?: boolean };
  exports?: Record<string, unknown>;
  onSuccess?: () => void;
}

export function getCommonConfig(root: string, options?: GetCommonConfigOptions): CommonConfig {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  const outDir = path.join(root, '..', '..', 'dist', pkgPath(pkg.name as string));
  const rootpkgAll = JSON.parse(fs.readFileSync(path.join(root, '..', '..', 'package.json'), 'utf-8'));
  const rootpkg = Object.fromEntries(
    ['type', 'version', 'author', 'license', 'homepage', 'repository'].map((k) => [k, rootpkgAll[k]]),
  );

  const config = { root, pkg, outDir, rootpkgAll, rootpkg };

  const configBase: UserConfig = {
    entry: ['./src/index.ts'],
    format: ['esm'],
    minify: true,
    sourcemap: false,
    platform: 'neutral',
    plugins: options?.plugins,
    dts: options?.dts ?? true,
    outDir,
    inputOptions: {
      resolve: {
        alias: {
          timescope: path.join(root, '..', '..', 'dist', '@timescope--timescope'),
        },
      },
    },
    onSuccess() {
      writePackageJson({ config, exports: options?.exports });
      options?.onSuccess?.();
    },
  };

  return { ...config, configBase };
}

export interface WritePackageJsonOptions {
  config: Omit<CommonConfig, 'configBase'>;
  exports?: Record<string, unknown>;
}

export function writePackageJson({ config, exports }: WritePackageJsonOptions) {
  const { pkg, outDir, rootpkgAll, rootpkg } = config;

  const defaultExports = {
    '.': {
      types: './index.d.ts',
      import: './index.js',
      require: './index.js',
    },
  };
  const pkgJson = {
    name: pkg.name,
    ...rootpkg,
    ...pkg,
    keywords: [...(rootpkgAll.keywords as string[]), ...((pkg.keywords as string[]) ?? [])],
    types: './index.d.ts',
    main: './index.js',
    exports: exports ?? defaultExports,
    dependencies: replaceRecursive(pkg.dependencies as Record<string, unknown>, (s) => {
      if (s !== 'workspace:*') return s;

        if (rootpkg?.version) return rootpkg.version as string;
      return '*';
    }),
    devDependencies: undefined,
    scripts: undefined,
    private: undefined,
  };

  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
}
