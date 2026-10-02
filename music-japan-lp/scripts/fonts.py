"""
日本語フォント（Zen Kaku Gothic New）を「このページで使う文字だけ」に絞る。

使い方：文章を変えたら `npm run build`（index.html を作る）→ `npm run fonts` → もう一度 `npm run build`。
必要なもの：python3、pip install fonttools brotli
元のフォント：Google Fonts（SIL Open Font License）。.font-cache/ に保存し、リポジトリには入れない。
欧文（Archivo / JetBrains Mono）は @fontsource-variable から読む（src/styles/fonts.css）。
"""
import pathlib, re, unicodedata, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / '.font-cache'
OUT = ROOT / 'public' / 'fonts'
CSS = ROOT / 'src' / 'styles' / 'fonts-jp.css'
BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew'
FONTS = [('ZenKakuGothicNew-Regular.ttf', 400), ('ZenKakuGothicNew-Bold.ttf', 700), ('ZenKakuGothicNew-Black.ttf', 900)]


def used_chars() -> str:
    chars = set()
    for pat in ['src/**/*.ts', 'src/**/*.css', 'index.html']:
        for f in ROOT.glob(pat):
            chars |= set(f.read_text(encoding='utf-8'))
    for a, b in [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x206F), (0x2190, 0x21FF), (0x25A0, 0x25FF), (0x3000, 0x303F), (0x3040, 0x309F), (0x30A0, 0x30FF), (0xFF00, 0xFFEF)]:
        chars |= {chr(c) for c in range(a, b + 1)}
    return ''.join(sorted(c for c in chars if unicodedata.category(c)[0] != 'C'))


def heading_chars() -> str:
    """ファーストビューの見出し（h1 と、その上の一文）だけの文字。先読みする小さいファイルにする"""
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    chars = set()
    for m in re.findall(r'<h1[^>]*>(.*?)</h1>', html, flags=re.S) + re.findall(r'class="hero-pre"[^>]*>(.*?)</p>', html, flags=re.S):
        chars |= set(re.sub(r'<[^>]+>', '', m))
    chars |= {chr(c) for c in range(0x20, 0x7F)} | set('、。「」・ー')
    return ''.join(sorted(c for c in chars if unicodedata.category(c)[0] != 'C'))


def ranges(text: str) -> str:
    cps = sorted({ord(c) for c in text})
    out, start, prev = [], None, None
    for cp in cps:
        if start is None:
            start = prev = cp
        elif cp == prev + 1:
            prev = cp
        else:
            out.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
            start = prev = cp
    if start is not None:
        out.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
    return ', '.join(out)


def save_subset(src, text, dest):
    font = TTFont(src)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.hinting = False
    opts.desubroutinize = True
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(dest)
    return dest.stat().st_size // 1024


def face(weight, file, rng=None):
    r = f"\n  unicode-range: {rng};" if rng else ''
    return (f"@font-face {{\n  font-family: 'Zen Kaku Gothic New';\n  font-style: normal;\n  font-weight: {weight};\n"
            f"  font-display: swap;\n  src: url('/fonts/{file}') format('woff2');{r}\n}}\n")


def main():
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    text = used_chars()
    head = heading_chars()
    rest = ''.join(c for c in text if c not in set(head))
    css = '/* scripts/fonts.py が生成。手で編集しない（文章を変えたら npm run fonts） */\n'
    for name, w in FONTS:
        src = CACHE / name
        if not src.exists():
            print('download', name)
            urllib.request.urlretrieve(f'{BASE}/{name}', src)
        if w == 900:
            ka = save_subset(src, head, OUT / 'zkg-900-h.woff2')
            kb = save_subset(src, rest, OUT / 'zkg-900.woff2')
            css += face(900, 'zkg-900-h.woff2', ranges(head)) + face(900, 'zkg-900.woff2', ranges(rest))
            print(f'zkg-900: 見出し {ka} KB ＋ 残り {kb} KB')
        else:
            k = save_subset(src, text, OUT / f'zkg-{w}.woff2')
            css += face(w, f'zkg-{w}.woff2')
            print(f'zkg-{w}: {k} KB')
    CSS.write_text(css, encoding='utf-8')
    print('文字数:', len(text))


main()
