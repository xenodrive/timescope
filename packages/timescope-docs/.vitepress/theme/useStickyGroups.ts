import { nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vitepress';

/** Only toggle presentation state; the real headings stay in normal document flow. */
export function useStickyGroups() {
  const route = useRoute();
  let frame = 0;
  const update = () => {
    frame = 0;
    for (const section of document.querySelectorAll<HTMLElement>('.doc-group, .doc-section')) {
      const proxy = section.querySelector<HTMLElement>(':scope > .doc-sticky');
      const heading = section.querySelector<HTMLElement>(':scope > .doc-group-heading, :scope > .doc-section-heading');
      if (!proxy || !heading) continue;
      const top = parseFloat(getComputedStyle(proxy).top);
      section.classList.toggle('is-stuck', heading.getBoundingClientRect().top < top);
      // Stop showing the outgoing label once its section pushes it above its slot.
      section.classList.toggle('is-leaving', proxy.getBoundingClientRect().top < top - 0.5);
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
