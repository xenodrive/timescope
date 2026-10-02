// Keep imports and helpers, but show the mounted example at the top level.
export function mountedCode(source: string, target: string) {
  const [before, rest] = source.split('  // #region example\n');
  const preamble = before.replace(/^export function [^\n]+\{\n$/m, '').trim();
  const body = rest.split('  // #endregion example')[0].replace(/^  /gm, '').trim();
  return `${preamble}\n\nconst target = ${JSON.stringify(target)};\n\n${body}\n`;
}
