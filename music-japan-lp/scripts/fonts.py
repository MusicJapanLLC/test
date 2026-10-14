"""
日本語フォントを、使う文字だけに絞って書き出す（scripts/fonts.mjs から呼ばれる）。

  Zen Old Mincho 700 / 900 … 見出し（900 はトップの h1 だけ）
  Zen Kaku Gothic New 400 / 700 … 本文

引数：文字の一覧（.font-cache/chars.json。キーは zom-700 / zom-700-h / zom-900-h / zkg-400 / zkg-700 など）
出力：public/fonts/<名前>.<ハッシュ>.woff2、src/styles/fonts-jp.css、src/render/fonts.json（先読みするファイル名）
元のフォント：Google Fonts（SIL Open Font License）。.font-cache/ に保存し、リポジトリには入れない。
"""
import hashlib, json, pathlib, sys, urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / '.font-cache'
OUT = ROOT / 'public' / 'fonts'
CSS = ROOT / 'src' / 'styles' / 'fonts-jp.css'
MANIFEST = ROOT / 'src' / 'render' / 'fonts.json'
GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl'
FAMILY = {
    'zom': ('Zen Old Mincho', 'zenoldmincho', 'ZenOldMincho', {700: 'Bold', 900: 'Black'}),
    'zkg': ('Zen Kaku Gothic New', 'zenkakugothicnew', 'ZenKakuGothicNew', {400: 'Regular', 700: 'Bold'}),
}
# どの書体にも入れておく文字（JSで変わる数字や、記号のため）
BASIC = {chr(c) for c in range(0x20, 0x7F)} | set('、。，．・ー「」『』（）！？：／〜…')


def source(fam: str, weight: int) -> pathlib.Path:
    _, folder, stem, names = FAMILY[fam]
    name = f'{stem}-{names[weight]}.ttf'
    path = CACHE / name
    if not path.exists():
        print('download', name)
        urllib.request.urlretrieve(f'{GF}/{folder}/{name}', path)
    return path


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


def save(src: pathlib.Path, text: str, stem: str) -> str:
    font = TTFont(src, recalcTimestamp=False)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.hinting = False
    opts.desubroutinize = True
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = 'woff2'
    tmp = OUT / f'{stem}.tmp'
    font.save(tmp)
    digest = hashlib.sha256(tmp.read_bytes()).hexdigest()[:8]
    name = f'{stem}.{digest}.woff2'
    tmp.rename(OUT / name)
    print(f'{name}: {len(text)}字 {(OUT / name).stat().st_size // 1024} KB')
    return name


def face(family: str, weight: int, file: str, rng: str | None) -> str:
    r = f'\n  unicode-range: {rng};' if rng else ''
    return (f"@font-face {{\n  font-family: '{family}';\n  font-style: normal;\n  font-weight: {weight};\n"
            f"  font-display: swap;\n  src: url('/fonts/{file}') format('woff2');{r}\n}}\n")


def main():
    chars: dict[str, str] = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.woff2'):
        old.unlink()
    css = '/* scripts/fonts.py が生成。手で編集しない（文章を変えたら npm run build → npm run fonts → npm run build） */\n'
    manifest = {}
    for fam, (family, _, _, names) in FAMILY.items():
        for w in names:
            head = set(chars.get(f'{fam}-{w}-h', ''))
            used = set(chars.get(f'{fam}-{w}', ''))
            src = source(fam, w)
            if head:
                # 見出しの文字だけの小さいファイル（先読みする）と、それ以外
                h = save(src, ''.join(sorted(head)), f'{fam}-{w}-h')
                css += face(family, w, h, ranges(''.join(head)))
                manifest['top' if w == 900 else 'page'] = f'/fonts/{h}'
                if not used:
                    continue  # 見出しにしか使っていない太さ（900 はトップの h1 だけ）
            rest = (used | BASIC) - head
            r = save(src, ''.join(sorted(rest)), f'{fam}-{w}')
            css += face(family, w, r, ranges(''.join(rest)) if head else None)
    CSS.write_text(css, encoding='utf-8')
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('fonts.json:', manifest)


main()
