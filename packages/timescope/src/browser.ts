import * as Injections from '#src/index.browser';

for (const k in Injections) {
  const globalScope = globalThis as unknown as Record<string, unknown>;
  globalScope[k] = Injections[k as keyof typeof Injections];
}

export default {};
