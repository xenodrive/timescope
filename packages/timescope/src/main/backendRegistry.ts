import type { TimescopeBackend, TimescopeBackendChoice } from '#src/main/backend';

let registeredBackends: ReadonlyArray<[name: string, backend: TimescopeBackend]> = [];

export function registerBackends(backends: ReadonlyArray<[name: string, backend: TimescopeBackend]>) {
  registeredBackends = backends;
}

export function resolveBackends(choice?: TimescopeBackendChoice | readonly TimescopeBackendChoice[]) {
  if (choice === undefined) return registeredBackends.map(([, backend]) => backend);
  if (Array.isArray(choice)) return choice.flatMap((item) => resolveOne(item));
  return resolveOne(choice as TimescopeBackendChoice);
}

function resolveOne(choice: TimescopeBackendChoice): TimescopeBackend[] {
  const backends = registeredBackends.filter(([name]) => name === choice).map(([, backend]) => backend);
  if (!backends.length) throw new Error(`Unknown backend: ${choice}`);
  return backends;
}
