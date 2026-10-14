"""
日本語Webフォントを「このサイトで使う文字だけ」に絞って、太さごとに1ファイルにする。

なぜ：@fontsource の日本語フォントは文字の範囲ごとに約120個へ分割されていて、
太さ5種類で約600個の @font-face になる。ブラウザがその照合に数秒かかり、
スマホでの表示と操作が詰まっていた（Lighthouse の TBT）。使う文字だけにすれば数個で済む。

使い方：文章を変えたら `npm run build` → `npm run fonts` → もう一度 `npm run build`。
（ビルドは、フォントにない文字が見つかると警告を出す：src/render/generate.ts）
必要なもの：python3、pip install fonttools brotli
元のフォント：Google Fonts（SIL Open Font License）。.font-cache/ に保存し、リポジトリには入れない。
"""
import pathlib, unicodedata, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / '.font-cache'
OUT = ROOT / 'public' / 'fonts'  # 固定URLで配信し、見出しの書体を <link rel=preload> で先に読む
CHARSET = ROOT / 'src' / 'styles' / 'fonts' / 'charset.txt'
BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl'
# 生成済みのページ（企業ごとのフォルダは src/partners から拾う。企業を足しても書き換えなくてよい）
SLUGS = sorted({l.split("'")[1] for f in (ROOT / 'src' / 'partners').glob('*.ts') for l in f.read_text(encoding='utf-8').splitlines() if l.startswith("  slug: '")})
PAGE_GLOBS = ['*.html', 'privacy/*.html', 'editorial/*.html', *[f'{s}/**/*.html' for s in SLUGS]]
FONTS = [
    ('zenoldmincho', 'ZenOldMincho-Bold.ttf', 'zen-old-mincho-700'),
    ('zenoldmincho', 'ZenOldMincho-Black.ttf', 'zen-old-mincho-900'),
    ('zenkakugothicnew', 'ZenKakuGothicNew-Regular.ttf', 'zen-kaku-gothic-new-400'),
    ('zenkakugothicnew', 'ZenKakuGothicNew-Bold.ttf', 'zen-kaku-gothic-new-700'),
    ('zenkakugothicnew', 'ZenKakuGothicNew-Black.ttf', 'zen-kaku-gothic-new-900'),
    # minka の世界観（Cominka など）の見出し。古民家の柱のような、太く端正な明朝
    ('shipporiminchob1', 'ShipporiMinchoB1-ExtraBold.ttf', 'shippori-mincho-b1-800'),
    # studio の世界観（Smartaleck など）の見出し。漫画のヒーローの吹き出しのような、ずんぐりした極太
    ('delagothicone', 'DelaGothicOne-Regular.ttf', 'dela-gothic-one-400'),
    # match の世界観（エボルグ / Empro など）の見出し。ロゴの角の丸い三角に合わせた、太い丸ゴシック
    ('zenmarugothic', 'ZenMaruGothic-Black.ttf', 'zen-maru-gothic-900'),
]


def used_chars() -> str:
    chars = set()
    # ソース（データ・テンプレート・画面に出す文言）と、生成済みのページ
    for pat in ['src/**/*.ts', 'src/**/*.css', *PAGE_GLOBS]:
        for f in ROOT.glob(pat):
            chars |= set(f.read_text(encoding='utf-8'))
    # 余裕を持たせる：ASCII、全角記号、ひらがな、カタカナ、よく使う記号
    ranges = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x206F), (0x2190, 0x21FF), (0x2460, 0x24FF), (0x25A0, 0x25FF),
              (0x3000, 0x303F), (0x3040, 0x309F), (0x30A0, 0x30FF), (0xFF00, 0xFFEF)]
    for a, b in ranges:
        chars |= {chr(c) for c in range(a, b + 1)}
    # 制御文字だけ除く（全角スペースなどの区切り文字は残す）
    return ''.join(sorted(c for c in chars if unicodedata.category(c)[0] != 'C'))


def heading_chars() -> str:
    """全ページの大見出し（h1）に使う文字。見出しの太い書体はこれだけを小さい先読みファイルに分ける"""
    import re
    chars = set()
    for pat in PAGE_GLOBS:
        for f in ROOT.glob(pat):
            html = f.read_text(encoding='utf-8')
            for m in re.findall(r'<h1[^>]*>(.*?)</h1>', html, flags=re.S):
                chars |= set(re.sub(r'<[^>]+>', '', m))
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    chars |= set('、。，．・「」『』（）！？ー〜')
    return ''.join(sorted(c for c in chars if unicodedata.category(c)[0] != 'C'))


def ranges(text: str) -> str:
    """CSS の unicode-range 用に、文字を U+XXXX の並びにする（連続は範囲にまとめる）"""
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


# 見出し（h1）の太い書体は「見出しの文字」と「それ以外」に分ける。
# 見出しの分は小さくすぐ届くので、書体の差し替えで見出しの下がずれる時間が短くなる（CLS対策）
SPLIT = {'zen-old-mincho-900', 'zen-kaku-gothic-new-900', 'shippori-mincho-b1-800', 'dela-gothic-one-400', 'zen-maru-gothic-900'}
FACES = {
    'zen-old-mincho-700': ('Zen Old Mincho', 700, 'swap'),
    'zen-old-mincho-900': ('Zen Old Mincho', 900, 'swap'),
    'zen-kaku-gothic-new-400': ('Zen Kaku Gothic New', 400, 'optional'),
    'zen-kaku-gothic-new-700': ('Zen Kaku Gothic New', 700, 'optional'),
    'zen-kaku-gothic-new-900': ('Zen Kaku Gothic New', 900, 'swap'),
    'shippori-mincho-b1-800': ('Shippori Mincho B1', 800, 'swap'),
    'dela-gothic-one-400': ('Dela Gothic One', 400, 'swap'),
    'zen-maru-gothic-900': ('Zen Maru Gothic', 900, 'swap'),
}


def face(name, file, rng=None):
    family, weight, display = FACES[name]
    r = f"\n  unicode-range: {rng};" if rng else ''
    return (f"@font-face {{\n  font-family: '{family}';\n  font-style: normal;\n  font-weight: {weight};\n"
            f"  font-display: {display};\n  src: url('/fonts/{file}') format('woff2');{r}\n}}\n")


def main():
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    text = used_chars()
    CHARSET.parent.mkdir(parents=True, exist_ok=True)
    CHARSET.write_text(text, encoding='utf-8')
    head = heading_chars()
    rest = ''.join(c for c in text if c not in set(head))
    css = {}
    for folder, name, out in FONTS:
        src = CACHE / name
        if not src.exists():
            print('download', name)
            urllib.request.urlretrieve(f'{BASE}/{folder}/{name}', src)
        if out in SPLIT:
            ka = save_subset(src, head, OUT / f'{out}-h.woff2')
            kb = save_subset(src, rest, OUT / f'{out}.woff2')
            css[out] = face(out, f'{out}-h.woff2', ranges(head)) + face(out, f'{out}.woff2', ranges(rest))
            print(f'{out}: 見出し {ka} KB ＋ 残り {kb} KB')
        else:
            k = save_subset(src, text, OUT / f'{out}.woff2')
            css[out] = face(out, f'{out}.woff2')
            print(f'{out}: {k} KB')
    note = '/* scripts/fonts.py が生成。手で編集しない（文章を変えたら npm run fonts） */\n'
    (ROOT / 'src/styles/fonts-faces.css').write_text(
        note + ''.join(css[k] for k in ['zen-old-mincho-700', 'zen-old-mincho-900', 'zen-kaku-gothic-new-400', 'zen-kaku-gothic-new-700']), encoding='utf-8')
    (ROOT / 'src/styles/fonts-faces-mono.css').write_text(note + css['zen-kaku-gothic-new-900'], encoding='utf-8')
    (ROOT / 'src/styles/fonts-faces-minka.css').write_text(note + css['shippori-mincho-b1-800'], encoding='utf-8')
    (ROOT / 'src/styles/fonts-faces-studio.css').write_text(note + css['dela-gothic-one-400'], encoding='utf-8')
    (ROOT / 'src/styles/fonts-faces-match.css').write_text(note + css['zen-maru-gothic-900'], encoding='utf-8')
    print(f'文字数: {len(text)}')


if __name__ == '__main__':
    main()
