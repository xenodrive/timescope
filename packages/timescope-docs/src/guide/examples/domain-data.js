export function domainSamples() {
  return Array.from({ length: 1001 }, (_, index) => {
    const time = index / 2;
    const section = Math.min(4, Math.floor(time / 100));
    const local = time % 100;
    const base = [4, 4, 4, 120, -80][section];
    const impact = section === 1 ? 45 * Math.exp(-(((local - 50) / 5) ** 2)) : 0;
    return { time, value: base + Math.sin(time * 0.25) * 1.4 + Math.cos(time * 0.63) * 0.4 + impact };
  });
}
