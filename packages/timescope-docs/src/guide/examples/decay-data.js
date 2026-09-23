export function decaySamples() {
  return Array.from({ length: 121 }, (_, index) => {
    const time = index / 2;
    const recovery = 10 ** (4 - time / 12);
    const retry = 1 + 6 * Math.exp(-(((time - 44) / 1.8) ** 2));
    return { time, value: recovery * retry * (1 + 0.12 * Math.sin(time / 2)) };
  });
}
