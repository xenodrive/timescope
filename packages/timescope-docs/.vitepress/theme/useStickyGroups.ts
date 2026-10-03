import { nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vitepress';

/** Only toggle presentation state; the real headings stay in normal document flow. */
export function useStickyGroups() {
  const route = useRoute();
  let frame = 0;
  const update = () => {
    frame = 0;
    const scroller = document.scrollingElement;
    if (!scroller) return;
    // Safari rubber-banding can move sticky boxes independently of document layout.
    // Keep the last valid state until the viewport returns to its scroll range.
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (window.scrollY < 0 || window.scrollY > maxScroll) return;

    for (const section of document.querySelectorAll<HTMLElement>('.doc-group, .doc-section')) {
      const proxy = section.querySelector<HTMLElement>(':scope > .doc-sticky');
      const heading = section.querySelector<HTMLElement>(':scope > .doc-group-heading, :scope > .doc-section-heading');
      if (!proxy || !heading) continue;
      const style = getComputedStyle(proxy);
      const top = parseFloat(style.top);
      section.classList.toggle('is-stuck', heading.getBoundingClientRect().top < top);
      // Use the section boundary, never the browser's moving sticky-box coordinates.
      const end = section.getBoundingClientRect().bottom;
      const occupiedHeight = proxy.offsetHeight + (parseFloat(style.marginBottom) || 0);
      section.classList.toggle('is-leaving', end < top + occupiedHeight - 0.5);
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
