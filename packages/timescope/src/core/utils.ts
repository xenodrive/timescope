export function unwrapFn<T, A extends unknown[]>(obj: T | ((...args: A) => T), ...args: A): T {
  if (typeof obj === 'function') {
    return (obj as (...args: A) => T)(...args);
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => unwrapFn(v, ...args)) as T;
  }
  if (typeof obj === 'object' && obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, unwrapFn(v, ...args)])) as T;
  }
  return obj as T;
}

export function createGetter(key: string) {
  return function (obj: Record<string, unknown>) {
    const cands = key.split(',').map((c) => c.trim());

    let r: any = obj;
    for (const cand of cands) {
      const keys = cand.split('.');
      r = obj;

      for (let i = 0; i < keys.length; i++) {
        if (r == null) break;
        if (typeof r !== 'object') {
          r = null;
          break;
        }
        r = r[keys[i]];
      }
      if (r != null) return r;
    }

    return r;
  };
}

function isPlainObject(obj: object) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

export function mergeOptions(dst: object, src: object) {
  for (const key in src) {
    const srcValue = (src as any)[key];
    const dstValue = (dst as any)[key];

    if (Array.isArray(srcValue)) {
      (dst as any)[key] = srcValue.slice();
    } else if (srcValue && typeof srcValue === 'object' && isPlainObject(srcValue)) {
      if (!dstValue || typeof dstValue !== 'object') {
        (dst as any)[key] = {};
      }
      mergeOptions((dst as any)[key], srcValue);
    } else {
      (dst as any)[key] = srcValue;
    }
  }
  return dst;
}
