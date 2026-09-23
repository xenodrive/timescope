class Expression {
  constructor(readonly code: string) {}
}

export const expression = (code: string) => new Expression(code);

// Preserve undefined bounds and callbacks: JSON.stringify cannot represent either.
export function javascript(value: unknown, depth = 0): string {
  if (value instanceof Expression) return value.code;
  if (typeof value === 'function') return value.toString();
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) return `[${value.map((item) => javascript(item, depth + 1)).join(', ')}]`;
  return `{\n${Object.entries(value)
    .map(
      ([key, item]) =>
        `${indent}  ${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${javascript(item, depth + 1)}`,
    )
    .join(',\n')}\n${indent}}`;
}

export function vanillaCode(options: object, helpers = '', after = '') {
  return {
    html: '<div id="timescope"></div>',
    javascript: `import { Timescope } from 'timescope';\n\n${helpers.replace(/^export /gm, '').trim()}\n\nconst options = ${javascript({ ...options, target: '#timescope' })};\n\nconst timescope = new Timescope(options);\n${after}\n\n// Call when removing the visualization.\nfunction cleanup() {\n  timescope.dispose();\n}\n`,
  };
}
