export function vibrationSamples() {
  return Array.from({ length: 12 * 4096 }, (_, index) => {
    const time = index / 4096;
    const burst = Math.exp(-(((time - 4) / 0.7) ** 2)) * 0.7 + Math.exp(-(((time - 8) / 1.2) ** 2)) * 0.4;
    const vibration = (0.025 + burst) * (Math.sin(time * 2 * Math.PI * 137) + 0.3 * Math.sin(time * 2 * Math.PI * 331));
    const impact = 1.7 * Math.exp(-(((time - 6.125) / 0.001) ** 2));
    return { time, value: vibration + impact };
  });
}
