export function annotationData() {
  function latency(time) {
    return (
      25 +
      3 * Math.sin(time / 2.4) +
      60 * Math.exp(-(((time - 32) / 3.8) ** 2)) +
      12 * Math.exp(-(((time - 15) / 4) ** 2))
    );
  }
  const events = [
    { time: 7, label: 'Started', symbol: '▶', color: '#0284c7', labelHeight: 98 },
    { time: 19, label: 'Checkpoint', symbol: '◆', color: '#7c3aed', labelHeight: 88 },
    { time: 32, label: 'Latency spike', symbol: '!', color: '#e11d48', labelHeight: 98 },
    { time: 49, label: 'Recovered', symbol: '✓', color: '#0d9488', labelHeight: 88 },
  ];
  return {
    samples: Array.from({ length: 241 }, (_, index) => ({ time: index / 4, value: latency(index / 4) })),
    events: events.map((event) => ({
      time: event.time,
      values: { value: latency(event.time), labelHeight: event.labelHeight },
      data: event,
    })),
  };
}
