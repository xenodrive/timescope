import type { UserConfig, PluginOption } from 'tsdown';
export declare function pkgPath(pkgName: string): string;
export declare function emitDeclarations(entry: string, rootDir: string, outDir: string, cwd: string): Promise<void>;
export declare function replaceRecursive(obj: Record<string, unknown>, replacer: (s: string, k: string) => string): Record<string, unknown>;
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
    dts?: boolean | {
        vue?: boolean;
    };
    exports?: Record<string, unknown>;
    onSuccess?: () => void;
}
export declare function getCommonConfig(root: string, options?: GetCommonConfigOptions): CommonConfig;
export interface WritePackageJsonOptions {
    config: Omit<CommonConfig, 'configBase'>;
    exports?: Record<string, unknown>;
}
export declare function writePackageJson({ config, exports }: WritePackageJsonOptions): void;
