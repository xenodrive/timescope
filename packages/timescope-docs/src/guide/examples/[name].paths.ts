import { globSync } from 'node:fs';
import { basename } from 'node:path';
import { examples } from './catalog';

const aliases: Record<string, string> = {
  'basic-chart': 'chart-playground',
  'simple-timeline': 'events',
  'time-control': 'events',
  'shared-domain': 'track-comparison',
  'multiple-tracks': 'track-comparison',
  'system-metrics': 'track-comparison',
  'realtime-data': 'live-stream',
  'gantt-chart': 'intervals',
  'log-viewer': 'intervals',
  'chart-presets': 'chart-playground',
  'marks-and-links': 'chart-playground',
  styling: 'chart-playground',
};

export default {
  watch: ['./*.vue', './catalog.ts'],
  paths() {
    return globSync(import.meta.dirname + '/*.vue').map((filename) => {
      const name = basename(filename, '.vue');
      const destination = aliases[name] ?? name;
      const example = examples.find((item) => item.name === destination);
      return {
        params: { name },
        content: `
<script setup>
import { onMounted } from 'vue';
import { useRouter, withBase } from 'vitepress';
const router = useRouter();
const destination = withBase('/guide/examples/?example=${destination}');
onMounted(() => { void router.go(destination); });
</script>

# ${example?.title ?? 'Examples'}

<a :href="destination">Open this demo in the gallery →</a>
`.trim(),
      };
    });
  },
};
