"""Make a small Timescope font with ASCII, subscript digits, and superscripts."""

import base64
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont


BASE = Path(__file__).resolve().parent.parent / "src" / "assets" / "fonts"
SUBSCRIPT_SCALE = 0.90
SUBSCRIPT_WIDTH = 0.95
SUBSCRIPT_DROP = 0  # em units; positive values place the digits below the baseline
SUPERSCRIPT_SCALE = 0.70
SUPERSCRIPT_BIAS = 0.45  # em units; positive values raise the glyphs


def make_font(source: Path, output: Path) -> None:
    font = TTFont(source)
    if "glyf" not in font:
        raise ValueError("Expected a TrueType font with a 'glyf' table")

    # The source's layout tables are not needed for ASCII or the new digits.
    # Dropping them before subsetting also avoids carrying broken GPOS classes.
    for table in ("GDEF", "GPOS", "GSUB", "kern", "STAT", "FFTM", "PfEd"):
        if table in font:
            del font[table]

    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=range(0x20, 0x7F))
    subsetter.subset(font)

    cmap = font.getBestCmap()
    digit_names = [cmap[ord("0") + digit] for digit in range(10)]
    tabular_advance = max(font["hmtx"][name][0] for name in digit_names)
    glyphs = font.getGlyphSet()
    for name in digit_names:
        advance, bearing = font["hmtx"][name]
        shift = round((tabular_advance - advance) / 2)
        pen = TTGlyphPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, 1, shift, 0)))
        font["glyf"][name] = pen.glyph()
        font["hmtx"][name] = (tabular_advance, bearing + shift)

    glyphs = font.getGlyphSet()
    glyph_order = list(font.getGlyphOrder())
    drop = round(font["head"].unitsPerEm * SUBSCRIPT_DROP)
    for digit in range(10):
        base = digit_names[digit]
        subscript = f"uni{0x2080 + digit:04X}"
        advance, bearing = font["hmtx"][base]
        scaled_advance = round(advance * SUBSCRIPT_SCALE)
        subscript_advance = round(scaled_advance * SUBSCRIPT_WIDTH)
        inset = round((scaled_advance - subscript_advance) / 2)
        pen = TTGlyphPen(glyphs)
        glyphs[base].draw(TransformPen(pen, (SUBSCRIPT_SCALE, 0, 0, SUBSCRIPT_SCALE, -inset, -drop)))
        font["glyf"][subscript] = pen.glyph()
        font["hmtx"][subscript] = (subscript_advance, round(bearing * SUBSCRIPT_SCALE) - inset)
        glyph_order.append(subscript)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[0x2080 + digit] = subscript

    superscript_bias = round(font["head"].unitsPerEm * SUPERSCRIPT_BIAS)
    for character, codepoint in zip("0123456789-", map(ord, "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")):
        base = cmap[ord(character)]
        superscript = f"uni{codepoint:04X}"
        advance, bearing = font["hmtx"][base]
        pen = TTGlyphPen(glyphs)
        glyphs[base].draw(
            TransformPen(pen, (SUPERSCRIPT_SCALE, 0, 0, SUPERSCRIPT_SCALE, 0, superscript_bias))
        )
        font["glyf"][superscript] = pen.glyph()
        font["hmtx"][superscript] = (
            round(advance * SUPERSCRIPT_SCALE),
            round(bearing * SUPERSCRIPT_SCALE),
        )
        glyph_order.append(superscript)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[codepoint] = superscript

    font.setGlyphOrder(glyph_order)
    font["maxp"].numGlyphs = len(glyph_order)
    names = font["name"]
    names.names = [
        entry
        for entry in names.names
        if entry.nameID not in (1, 2, 3, 4, 6, 16, 17)
        and (entry.nameID != 0 or entry.toUnicode().lower().startswith("copyright"))
    ]
    for name_id, value in {
        1: "Timescope",
        2: "Regular",
        3: "Timescope Regular",
        4: "Timescope Regular",
        6: "Timescope-Regular",
        16: "Timescope",
        17: "Regular",
    }.items():
        names.setName(value, name_id, 3, 1, 0x409)
    font.flavor = "woff2" if output.suffix.lower() == ".woff2" else None
    font.save(output)
    if font.flavor == "woff2":
        output.with_suffix(".woff2.json").write_text(
            json.dumps(base64.b64encode(output.read_bytes()).decode("ascii")) + "\n"
        )


if __name__ == "__main__":
    make_font(
        Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "Inter_18pt-Regular.ttf",
        Path(sys.argv[2]) if len(sys.argv) > 2 else BASE / "Timescope.woff2",
    )
