declare global {
  var _uid: number;
}

export function setUid(obj?: object) {
  if (!globalThis._uid) globalThis._uid = 1;
  if (obj) {
    if ('_uid' in obj) return String(obj._uid);
    (obj as any)._uid = String(globalThis._uid);
    Object.defineProperty(obj, '_uid', { enumerable: false });
  }
  return String(globalThis._uid++);
}
