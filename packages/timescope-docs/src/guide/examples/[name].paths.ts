import { globSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const CODE = '```';

function extractMeta(lines: string[]) {
  const result = {
    title: '',
  };
  for (const line of lines) {
    if (line.startsWith('title: ')) {
      result.title = line.substring('title: '.length);
    }
  }
  return result;
}

function extractRegion(name: string, lines: string[]) {
  const result: string[] = [];
  let include = false;
  for (const line of lines) {
    if (line.includes(`#region ${name}`)) {
      include = true;
      continue;
    }
    if (line.includes(`#endregion ${name}`)) {
      include = false;
      continue;
    }
    if (!include) continue;
    if (line.includes('ignore:')) continue;

    const m = line.match(/\/\/ add: (.*)/);
    if (m) {
      result.push(m[1]);
      continue;
    }
    result.push(line + '\n');
  }

  return result.join('').replace(/\n\n\n+/g, '\n\n');
}

function parseCode(code: string) {
  const lines = code.split('\n');

  const html = extractRegion('html', lines);
  const js = extractRegion('code', lines);
  const style = extractRegion('style', lines);
  const meta = extractMeta(lines);

  return { js, html, style, meta };
}

export default {
  watch: [
    './*.vue',
    './*.md',
  ],
  paths() {
    return globSync(import.meta.dirname + '/*.vue').map((filename) => {
      const name = basename(filename, '.vue');

      const { js, html, style, meta } = parseCode(readFileSync(filename, 'utf-8'));
      let content: string | undefined = undefined;
      try {
        content = readFileSync(filename.replace('.vue', '.md'), 'utf-8');
      } catch {
        // do nothing
      }

      return {
        params: {
          name,
        },
        content: content ?? `
<script setup>
import Example from '@/guide/examples/${name}.vue';
</script>

# ${meta?.title ?? name}

## Example
<Example />

## Code
${CODE}HTML
${html}
${CODE}
${CODE}TypeScript
${js}
${CODE}
${style ? `
${CODE}CSS
${style}
${CODE}` : `` }
        `.trim(),
      }
    });
  }
}
