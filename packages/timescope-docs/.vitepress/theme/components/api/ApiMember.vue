<script setup lang="ts">
import { computed } from 'vue';
import ApiCode from './ApiCode.vue';
import ApiParameters from './ApiParameters.vue';
import type { ApiParameter } from '../../../api-members';

const props = withDefaults(
  defineProps<{
    id: string;
    signatures: string[];
    parameters?: ApiParameter[];
    returns: string;
    kind?: string;
    aliases?: string[];
  }>(),
  { parameters: () => [], aliases: () => [], kind: 'Method' },
);

const headings = computed(() =>
  props.signatures.map((signature) => {
    const start = signature.indexOf('(');
    return {
      signature,
      name: start < 0 ? signature : signature.slice(0, start),
      arguments: start < 0 ? '' : signature.slice(start),
    };
  }),
);
</script>

<template>
  <section :id="id" class="api-member">
    <span v-for="anchor in aliases" :id="anchor" :key="anchor" class="api-member-alias" />
    <header class="api-member-header">
      <slot name="header" :signatures="signatures" :kind="kind">
        <h4 class="api-member-heading">
          <code v-for="heading in headings" :key="heading.signature" class="api-code"
            ><span class="api-member-name">{{ heading.name }}</span
            ><span>{{ heading.arguments }}</span></code
          >
        </h4>
      </slot>
      <span class="api-entry-kind">{{ kind }}</span>
    </header>
    <div class="api-member-body">
      <div v-if="$slots.default" class="api-member-description"><slot /></div>
      <slot name="parameters" :parameters="parameters">
        <ApiParameters v-if="parameters.length" :parameters="parameters" />
      </slot>
      <dl v-if="$slots.defaults" class="api-details">
        <div class="api-detail">
          <dt>Defaults</dt>
          <dd><slot name="defaults" /></dd>
        </div>
      </dl>
      <slot name="returns" :type="returns">
        <div class="api-member-returns">
          <span class="api-member-label">Returns</span>
          <ApiCode :text="returns" />
          <div v-if="$slots['return-description']" class="api-member-return-description">
            <slot name="return-description" />
          </div>
        </div>
      </slot>
      <dl v-if="$slots.throws || $slots.rejects" class="api-details api-member-errors">
        <div v-if="$slots.throws" class="api-detail">
          <dt>Throws</dt>
          <dd><slot name="throws" /></dd>
        </div>
        <div v-if="$slots.rejects" class="api-detail">
          <dt>Rejects</dt>
          <dd><slot name="rejects" /></dd>
        </div>
      </dl>
      <slot name="details" />
    </div>
  </section>
</template>

<style>
.vp-doc .api-member {
  position: relative;
  margin: 16px 0 24px;
  border: 1px solid var(--api-member-border, var(--vp-c-divider));
  border-radius: var(--api-member-radius, 6px);
  background: var(--api-member-background, var(--vp-c-bg));
  scroll-margin-top: 88px;
}

.vp-doc .api-member-header {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  padding: 14px var(--api-member-padding, 16px) 0;
  background: var(--api-member-header-background, transparent);
}

.vp-doc .api-member-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
}

.vp-doc .api-member-heading code.api-code {
  min-width: 0;
  padding: 0;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: inherit;
}

.vp-doc .api-member-name {
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.vp-doc .api-member-body {
  padding: 10px var(--api-member-padding, 16px) 16px;
  font-size: 14px;
}

.vp-doc .api-member-description {
  margin: 0 0 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
}

.vp-doc .api-member-description > :first-child {
  margin-top: 0;
}

.vp-doc .api-member-description > :last-child {
  margin-bottom: 0;
}

.vp-doc .api-member-label {
  display: block;
  margin-bottom: 6px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
}

.vp-doc .api-member-returns {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 12px;
  margin-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 12px;
}

.vp-doc .api-member-returns > .api-member-label {
  margin-bottom: 0;
}

.vp-doc .api-member-return-description {
  width: 100%;
  font-size: 13px;
}

.vp-doc .api-member-return-description > p {
  margin: 0;
}

.api-member-alias {
  position: absolute;
  top: 0;
  scroll-margin-top: 88px;
}

@media (max-width: 639px) {
  .vp-doc .api-member {
    --api-member-padding: 12px;
    font-size: 13px;
  }

  .vp-doc .api-member-heading {
    font-size: 13px;
  }
}
</style>
