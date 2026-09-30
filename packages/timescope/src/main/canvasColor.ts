/** Resolve inherited CSS on the DOM side, including for Worker rendering. */
export function watchCanvasColor(element: Element, changed: (color: string) => void): () => void {
  if (typeof getComputedStyle === 'undefined') return () => {};

  let previous: string | undefined;
  const update = () => {
    const color = getComputedStyle(element).color;
    if (!color || color === previous) return;
    previous = color;
    changed(color);
  };
  update();

  const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update);
  for (let node: Element | null = element; node; node = node.parentElement) {
    observer?.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', update);
  window.addEventListener('resize', update);
  const transition = (event: TransitionEvent) => {
    if (event.propertyName === 'color') update();
  };
  window.addEventListener('transitionend', transition);

  return () => {
    observer?.disconnect();
    media?.removeEventListener('change', update);
    window.removeEventListener('resize', update);
    window.removeEventListener('transitionend', transition);
  };
}
