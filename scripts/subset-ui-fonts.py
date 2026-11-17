#!/usr/bin/env python3
"""Rebuild the site UI subsets so every character used in the repo is covered.

The checked-in woff2 files are subsets of:

- Noto Sans CJK SC variable, Version 2.004
  https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/Variable/TTF/NotoSansCJKsc-VF.ttf
- Noto Serif CJK SC variable, Version 2.003
  https://github.com/notofonts/noto-cjk/raw/Serif2.003/Serif/Variable/TTF/NotoSerifCJKsc-VF.ttf

YJ Title is YouSheBiaoTiHei 1.00. Its full source is not in this repo.
If fonts/src/YouSheBiaoTiHei.ttf is present, this script subsets that too.

Place the source files in fonts/src/ (that directory is not committed) and run:

    python3 scripts/subset-ui-fonts.py

The script keeps every codepoint already in the current subset and adds any
non-ASCII character found in the site text, so existing outlines stay and new
copy does not fall through to Songti / system fonts.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get("FONT_SRC", ROOT / "fonts" / "src"))
OUT = ROOT / "fonts"
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".svg"}
SKIP = {".git", "fonts", "node_modules"}

JOBS = [
    ("yj-sans.woff2", "NotoSansCJKsc-VF.ttf"),
    ("yj-serif.woff2", "NotoSerifCJKsc-VF.ttf"),
    ("yj-title.woff2", "YouSheBiaoTiHei.ttf"),
]


def site_codepoints() -> set[int]:
    found: set[int] = set()
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXT:
            continue
        if any(part in SKIP for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeError:
            continue
        for ch in text:
            if ord(ch) > 127:
                found.add(ord(ch))
    return found


def subset(src: Path, dest: Path, unicodes: set[int]) -> None:
    font = TTFont(src)
    options = Options()
    options.layout_features = ["*"]
    options.hinting = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.desubroutinize = False
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    tool = Subsetter(options=options)
    tool.populate(unicodes=unicodes)
    tool.subset(font)
    font.flavor = "woff2"
    font.save(dest)


def main() -> int:
    extra = site_codepoints()
    for out_name, src_name in JOBS:
        src = SRC / src_name
        dest = OUT / out_name
        if not src.exists():
            print(f"skip {out_name}: missing {src}")
            continue
        current = TTFont(dest) if dest.exists() else None
        keep = set(current.getBestCmap()) if current else set()
        unicodes = keep | extra
        before = len(keep)
        subset(src, dest, unicodes)
        after = TTFont(dest)
        cmap = after.getBestCmap() or {}
        missing = [chr(cp) for cp in sorted(extra) if cp not in cmap and "\u4e00" <= chr(cp) <= "\u9fff"]
        print(f"{out_name}: {before} -> {len(cmap)} glyphs, han still missing {len(missing)} {''.join(missing[:40])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
