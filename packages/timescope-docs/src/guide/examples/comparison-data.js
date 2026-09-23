export function comparisonSamples() {
  return Array.from({ length: 181 }, (_, index) => {
    const time = index / 3;
    const cycle = Math.exp(-(((time - 30) / 9) ** 2));
    return {
      time,
      values: {
        intake: 18 + 10 * cycle + 1.2 * Math.sin(time / 3),
        outlet: 25 + 18 * Math.exp(-(((time - 34) / 9) ** 2)) + Math.sin(time / 4),
        flow: 45 + 35 * cycle + 4 * Math.cos(time / 2),
      },
    };
  });
}
