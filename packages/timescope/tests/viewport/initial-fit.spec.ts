import { Timescope } from '#src/main/Timescope';
import { describe, expect, it } from 'vitest';

describe('initial fit', () => {
  it('initializes the center before the canvas has a width', () => {
    const timescope = new Timescope({ fit: [10, 50] });
    expect(timescope.time?.number()).toBe(30);
    timescope.dispose();
  });

  it('accepts fit padding but rejects conflicting or invalid initial views', () => {
    const timescope = new Timescope({ fit: { range: [0, 60], padding: [12, 8] } });
    expect(timescope.time?.number()).toBe(30);
    timescope.dispose();

    expect(() => new Timescope({ fit: [0, 60], zoom: 2 } as never)).toThrow('fit cannot be combined');
    expect(() => new Timescope({ fit: [60, 0] })).toThrow('fit range must be increasing');
    expect(() => new Timescope({ fit: { range: [0, 60], padding: -1 } })).toThrow('fit padding');
  });
});
