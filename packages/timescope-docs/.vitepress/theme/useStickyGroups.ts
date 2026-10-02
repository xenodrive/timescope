import { nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vitepress';

/** Detect sticking from the stable section boundary, not the resizing heading. */
export function useStickyGroups() {
  const route = useRoute();
  let frame = 0;
  const update = () => {
    frame = 0;
    for (const group of document.querySelectorAll<HTMLElement>('.doc-group')) {
      const heading = group.querySelector<HTMLElement>('.doc-group-heading');
      if (!heading) continue;
      const top = parseFloat(getComputedStyle(heading).top);
      group.classList.toggle('is-stuck', group.getBoundingClientRect().top < top);
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  watch(
    () => route.path,
    async () => {
      await nextTick();
      schedule();
    },
  );
  onMounted(() => {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
  });
  onUnmounted(() => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  });
}
