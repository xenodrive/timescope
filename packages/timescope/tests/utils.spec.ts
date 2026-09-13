import { mergeOptions } from '#src/core/options';
import { describe, expect, it } from 'vitest';

describe('mergeOptions', () => {
  it('preserves class instances while recursively merging option objects', () => {
    class Source {
      query() {}
    }

    const source = new Source();
    const options = mergeOptions({ style: { width: '10px' } }, { style: { height: '20px' }, sources: { source } }) as {
      style: { width: string; height: string };
      sources: { source: Source };
    };

    expect(options.style).toEqual({ width: '10px', height: '20px' });
    expect(options.sources.source).toBe(source);
    expect(options.sources.source.query).toBe(Source.prototype.query);
  });
});
