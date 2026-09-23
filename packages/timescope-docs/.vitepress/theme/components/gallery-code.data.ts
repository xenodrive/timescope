import { readFileSync } from 'node:fs';
import { transformWithOxc } from 'vite';

export interface VanillaExample {
  html: string;
  javascript: string;
}
export declare const data: Record<string, VanillaExample>;

function region(source: string, name: string) {
  let included = false;
  let ignored = false;
  const lines: string[] = [];
  for (const line of source.split('\n')) {
    if (line.includes(`#region ${name}`)) {
      included = true;
      continue;
    }
    if (line.includes(`#endregion ${name}`)) {
      included = false;
      continue;
    }
    if (line.includes('#region docs-ignore')) {
      ignored = true;
      continue;
    }
    if (line.includes('#endregion docs-ignore')) {
      ignored = false;
      continue;
    }
    if (included && !ignored) lines.push(line.replace(/^  /, ''));
  }
  return lines.join('\n').trim();
}

export default {
  watch: ['../../../src/guide/examples/*.vue'],
  async load() {
    return Object.fromEntries(
      await Promise.all(
        ['events', 'timezones', 'financial-chart', 'audio-waveform'].map(async (name) => {
          const source = readFileSync(new URL(`../../../src/guide/examples/${name}.vue`, import.meta.url), 'utf8');
          const code = region(source, 'code');
          return [
            name,
            {
              html: region(source, 'html')
                .replace(/<(span|audio)([^>]*?)\s*\/>/g, '<$1$2></$1>')
                .replace(/\s:class="[^"]*"/g, ''),
              javascript: (await transformWithOxc(code, `${name}.ts`)).code.replace(/\t/g, '  '),
            },
          ];
        }),
      ),
    );
  },
};
