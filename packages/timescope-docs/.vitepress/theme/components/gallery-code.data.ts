import { readFileSync } from 'node:fs';
import { mountedCode } from '../../../src/examples/module-code.ts';

export interface VanillaExample {
  html: string;
  javascript: string;
}
export declare const data: Record<string, VanillaExample>;

function source(name: string) {
  return readFileSync(new URL(`../../../src/examples/${name}`, import.meta.url), 'utf8');
}

export default {
  watch: ['../../../src/examples/*.vue', '../../../src/examples/*.js'],
  load() {
    const examples = [
      ['events', 'events-demo', '#example-intermediate-values'],
      ['timezones', 'timezones-demo', '#example-timezones'],
      ['styling', 'styling-demo', '#example-styling'],
      ['live-stream', 'live-signal', '#example-live-stream'],
      ['dynamic-loader', 'dynamic-terrain', '#example-dynamic-loader'],
      ['decimation', 'decimation-demo', '#example-decimation'],
      ['financial-chart', 'financial-chart-demo', '#example-financial-chart'],
      ['audio-waveform', 'audio-waveform-demo', '#example-audio-waveform'],
    ];
    return Object.fromEntries(
      examples.map(([name, module, target]) => {
        let javascript = source(`${module}.js`);
        if (name === 'decimation') {
          javascript = javascript.replace(
            "import { vibrationSamples } from './vibration-data.js';",
            source('vibration-data.js').replace(/^export /gm, ''),
          );
        }
        const html = source(`${name}.vue`)
          .split('<!-- #region html -->')[1]
          .split('<!-- #endregion html -->')[0]
          .replace(/^  /gm, '')
          .trim()
          .replace(/<(span|audio)([^>]*?)\s*\/>/g, '<$1$2></$1>')
          .replace(/\s:class="[^"]*"/g, '');
        return [name, { html, javascript: mountedCode(javascript, target) }];
      }),
    );
  },
};
