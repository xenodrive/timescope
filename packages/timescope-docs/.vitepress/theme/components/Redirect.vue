<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter, withBase } from 'vitepress';

const props = defineProps<{ to: string }>();
const router = useRouter();

onMounted(() => {
  void router.go(withBase(props.to) + window.location.search + window.location.hash, { replace: true });
});
</script>

<template>
  <p>Redirecting… <a :href="withBase(to)">Continue to the first topic</a>.</p>
</template>
