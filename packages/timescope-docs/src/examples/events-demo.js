import { Timescope } from 'timescope';

export function createEventsDemo(target) {
  // #region example
  function setValueOn(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerText = value?.toString()?.replace(',', '\n') ?? 'null';
  }

  const timescope = new Timescope({ target });
  for (const event of [
    'timechanged',
    'timechanging',
    'timeanimating',
    'zoomchanged',
    'zoomchanging',
    'zoomanimating',
    'selectionrangechanging',
    'selectionrangechanged',
  ]) {
    timescope.on(event, ({ value }) => setValueOn(event, value));
    setValueOn(event, event.startsWith('zoom') ? '0' : 'null');
  }

  // #endregion example
  return () => timescope.dispose();
}
