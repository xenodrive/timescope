function isPlainObject(obj: object) {
  const prototype = Object.getPrototypeOf(obj);
  return prototype === Object.prototype || prototype === null;
}

export function mergeOptions(dst: object, src: object) {
  for (const key in src) {
    const srcValue = (src as any)[key];
    const dstValue = (dst as any)[key];
    if (Array.isArray(srcValue)) {
      (dst as any)[key] = srcValue.slice();
    } else if (srcValue && typeof srcValue === 'object' && isPlainObject(srcValue)) {
      if (!dstValue || typeof dstValue !== 'object') (dst as any)[key] = {};
      mergeOptions((dst as any)[key], srcValue);
    } else {
      (dst as any)[key] = srcValue;
    }
  }
  return dst;
}

export function normalizeOptions<T>(opts: boolean | T | undefined | null, defaults: T): T | null {
  if (opts === false) return null;
  if (opts === true || opts == null) return defaults;
  return opts;
}
