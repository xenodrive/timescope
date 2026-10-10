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
    ['type', 'author', 'license', 'homepage', 'repository'].map((k) => [k, rootpkgAll[k]]),
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
  const { root, pkg, outDir, rootpkgAll, rootpkg } = config;

  const peerDependencies = pkg.peerDependencies as Record<string, string> | undefined;
  const resolvedPeers = peerDependencies && { ...peerDependencies };
  if (resolvedPeers && Object.values(resolvedPeers).includes('workspace:*')) {
    const packagesDir = path.join(root, '..');
    const versions = new Map<string, string>();
    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(packagesDir, entry.name, 'package.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      versions.set(manifest.name, manifest.version);
    }
    for (const [name, range] of Object.entries(resolvedPeers)) {
      if (range !== 'workspace:*') continue;
      const version = versions.get(name);
      if (!version) throw new Error(`Workspace peer dependency not found: ${name}`);
      resolvedPeers[name] = version;
    }
  }

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
    dependencies: pkg.dependencies,
    peerDependencies: resolvedPeers,
    devDependencies: undefined,
    scripts: undefined,
    private: undefined,
    imports: undefined,
  };

  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
}
