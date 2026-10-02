<script lang="ts">
import { withBase } from 'vitepress';
import { defineComponent, h } from 'vue';
import { splitApiIdentifiers } from '../../../api-identifiers';

export default defineComponent({
  name: 'ApiCode',
  props: {
    text: { type: String, required: true },
    linked: { type: Boolean, default: true },
  },
  setup(props) {
    return () =>
      h(
        'code',
        { class: 'api-code' },
        splitApiIdentifiers(props.text).map(({ text, href }) =>
          props.linked && href ? h('a', { class: 'api-identifier', href: withBase(href) }, text) : text,
        ),
      );
  },
});
</script>

<style>
.vp-doc code.api-code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.9em;
}

.vp-doc .api-identifier {
  color: var(--vp-c-brand-1);
  font-weight: inherit;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.vp-doc .api-identifier:hover,
.vp-doc .api-identifier:focus-visible {
  text-decoration-style: solid;
}
</style>
