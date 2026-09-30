import { mergeOptions } from '#src/core/options';
import { describe, expect, it } from 'vitest';

describe('option merging', () => {
  it('preserves class instances while recursively merging option objects', () => {
    class Source {
      query() {}
    }

    const source = new Source();
    const options = mergeOptions(
      { cursor: { color: 'red' } },
      { cursor: { borderColor: 'blue' }, sources: { source } },
    ) as {
      cursor: { color: string; borderColor: string };
      sources: { source: Source };
    };

    expect(options.cursor).toEqual({ color: 'red', borderColor: 'blue' });
    expect(options.sources.source).toBe(source);
    expect(options.sources.source.query).toBe(Source.prototype.query);
  });
});
