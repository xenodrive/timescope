import { DEFAULT_FONT_FAMILY, resolveFont } from '#src/main/fontStyle';
import { describe, expect, it } from 'vitest';

describe('font styles', () => {
  const defaults = { weight: 'normal', size: 12, family: 'BIZ UDPGothic' };

  it('uses per-location defaults and quotes a single multi-word family', () => {
    expect(resolveFont(undefined, defaults)).toBe('normal 12px "BIZ UDPGothic"');
    expect(resolveFont({ family: 'sans-serif' }, { ...defaults, size: 11 })).toBe('normal 11px sans-serif');
  });

  it('uses Timescope before the platform font for ordinary text', () => {
    expect(resolveFont(undefined, { weight: 'normal', size: 11, family: DEFAULT_FONT_FAMILY })).toBe(
      'normal 11px Timescope, sans-serif',
    );
  });

  it('inherits only specified global properties while retaining each location’s defaults', () => {
    const inherited = { family: 'MS Gothic' };
    expect(resolveFont(undefined, defaults, inherited)).toBe('normal 12px "MS Gothic"');
    expect(resolveFont({}, { ...defaults, size: 11 }, inherited)).toBe('normal 11px "MS Gothic"');
    expect(
      resolveFont({ size: 16, weight: undefined }, defaults, {
        ...inherited,
        size: 20,
        weight: 'bold',
        style: 'italic',
        lineHeight: 1.5,
      }),
    ).toBe('italic bold 16px/1.5 "MS Gothic"');
    expect(resolveFont({ weight: 'normal' }, defaults, { ...inherited, weight: 'bold' })).toBe(
      'normal 12px "MS Gothic"',
    );
  });

  it('treats CSS strings as complete fonts rather than merging their properties', () => {
    expect(resolveFont(undefined, defaults, 'bold 20px Inter')).toBe('bold 20px Inter');
    expect(resolveFont('italic 14px serif', defaults, { family: 'MS Gothic' })).toBe('italic 14px serif');
    expect(resolveFont({ size: 16 }, defaults, 'bold 20px Inter')).toBe('normal 16px "BIZ UDPGothic"');
  });

  it('prefers explicit font properties to mark size and preserves CSS font strings', () => {
    expect(resolveFont({ size: 18, weight: 'bold' }, { ...defaults, size: 14 })).toBe('bold 18px "BIZ UDPGothic"');
    expect(resolveFont({ size: '1.5rem', family: 'Inter, sans-serif' }, defaults)).toBe(
      'normal 1.5rem Inter, sans-serif',
    );
    expect(resolveFont('italic 500 13px Inter', defaults)).toBe('italic 500 13px Inter');
  });

  it('combines style, variant, stretch, and line height in CSS font order', () => {
    expect(
      resolveFont(
        {
          style: 'italic',
          variant: 'small-caps',
          weight: '600',
          stretch: 'condensed',
          size: 16,
          lineHeight: 1.4,
          family: 'Inter',
        },
        defaults,
      ),
    ).toBe('italic small-caps 600 condensed 16px/1.4 Inter');
    expect(resolveFont({ style: 'oblique 10deg', lineHeight: 'normal' }, defaults)).toBe(
      'oblique 10deg normal 12px/normal "BIZ UDPGothic"',
    );
  });

  it('escapes literal family names without changing quoted names or fallback lists', () => {
    expect(resolveFont({ family: 'Bob\'s "Font" \\ Mono' }, defaults)).toBe(
      'normal 12px "Bob\'s \\"Font\\" \\\\ Mono"',
    );
    expect(resolveFont({ family: 'Line\nBreak' }, defaults)).toBe('normal 12px "Line\\a Break"');
    expect(resolveFont({ family: '"A, B", sans-serif' }, defaults)).toBe('normal 12px "A, B", sans-serif');
    expect(resolveFont({ family: "Bob's Font, sans-serif" }, defaults)).toBe('normal 12px "Bob\'s Font", sans-serif');
    expect(resolveFont({ family: '"A \\"B\\"", Inter' }, defaults)).toBe('normal 12px "A \\"B\\"", Inter');
    expect(resolveFont('italic 12px "A \\"B\\""', defaults)).toBe('italic 12px "A \\"B\\""');
  });
});
