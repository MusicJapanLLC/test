"""Build-time reading aids, not a native-speaker phonetic annotation.

Sound-change stage: g2pk2 0.0.3 (Apache-2.0), derived from kyubyong/g2pK.
https://github.com/kyubyong/g2pK
https://pypi.org/project/g2pk2/0.0.3/
The second stage is a transparent, deliberately broad Seoul-Korean IPA guide.
It does not model pitch, intonation, vowel length, optional reductions or every
cross-word allophone. Katakana collapses distinctions: audio remains essential.
No runtime network requests, keys, personal logs or external speech services.
"""
from __future__ import annotations
import re
from functools import lru_cache

VOWELS = ['a','ɛ','ja','jɛ','ʌ','e','jʌ','je','o','wa','wɛ','we','jo','u','wʌ','we','wi','ju','ɯ','ɰi','i']
ONSETS = ['k','k͈','n','t','t͈','ɾ','m','p','p͈','s','s͈','','tɕ','tɕ͈','tɕʰ','kʰ','tʰ','pʰ','h']
CODAS = ['','k̚','k̚','k̚','n','n','n','t̚','l','k̚','m','l','l','l','p̚','l','m','p̚','p̚','t̚','t̚','ŋ','t̚','t̚','k̚','t̚','p̚','t̚']
GROUPS = ['k','k','n','t','t','r','m','p','p','s','s','','j','j','j','k','t','p','h']
BASE = {
 '':['ア','イ','ウ','エ','オ'], 'k':['カ','キ','ク','ケ','コ'], 'g':['ガ','ギ','グ','ゲ','ゴ'],
 'n':['ナ','ニ','ヌ','ネ','ノ'], 't':['タ','ティ','トゥ','テ','ト'], 'd':['ダ','ディ','ドゥ','デ','ド'],
 'r':['ラ','リ','ル','レ','ロ'], 'm':['マ','ミ','ム','メ','モ'], 'p':['パ','ピ','プ','ペ','ポ'],
 'b':['バ','ビ','ブ','ベ','ボ'], 's':['サ','シ','ス','セ','ソ'], 'j':['チャ','チ','チュ','チェ','チョ'],
 'z':['ジャ','ジ','ジュ','ジェ','ジョ'], 'h':['ハ','ヒ','フ','ヘ','ホ']
}
Y_PREFIX = {'':'','k':'キ','g':'ギ','n':'ニ','t':'ティ','d':'ディ','r':'リ','m':'ミ','p':'ピ','b':'ビ','s':'シ','j':'チ','z':'ジ','h':'ヒ'}
W_PREFIX = {'':'ウ','k':'ク','g':'グ','n':'ヌ','t':'トゥ','d':'ドゥ','r':'ル','m':'ム','p':'プ','b':'ブ','s':'ス','j':'チュ','z':'ジュ','h':'フ'}
V_KIND = ['a','e','ya','ye','o','e','yo','ye','o','wa','we','we','yo','u','wo','we','wi','yu','u','wi','i']
KODA = {'':'','k̚':'ㇰ','t̚':'ッ','p̚':'ㇷ゚','n':'ン','l':'ㇽ','m':'ㇺ','ŋ':'ン'}
SONORANTS = {0,4,8,16,21}

def split_syllable(ch: str):
    n=ord(ch)-0xAC00
    return (n//588,(n%588)//28,n%28) if 0<=n<11172 else None

def kana_syllable(group: str, v: int) -> str:
    kind=V_KIND[v]
    if kind in 'aiueo' and len(kind)==1:
        return BASE[group]['aiueo'.index(kind)]
    if kind.startswith('y'):
        tail={'ya':'ャ','yu':'ュ','yo':'ョ','ye':'ェ'}[kind]
        if not group: return {'ya':'ヤ','yu':'ユ','yo':'ヨ','ye':'イェ'}[kind]
        if kind=='ye' and group in {'t','d'}: return BASE[group][3]+'ィェ'
        return Y_PREFIX[group]+tail
    return W_PREFIX[group]+{'wa':'ァ','wo':'ォ','we':'ェ','wi':'ィ'}[kind]

def from_pronounced_hangul(text: str) -> list[str]:
    """Map already sound-changed Hangul to approximate reading aids."""
    kana=[];ipa=[];previous=None
    for at,ch in enumerate(text):
        syllable=split_syllable(ch)
        if syllable is None:
            if ch.isspace():
                kana.append(' ');ipa.append(' ')
            elif ch in ',，、;:':
                kana.append('、');ipa.append(' | ')
            elif ch in '.!?。！？…':
                kana.append(ch)
                if at+1<len(text): ipa.append(' | ')
            elif ch in '()（）「」『』“”\"\'':
                pass
            elif ch.isalpha() or ch.isdigit():
                raise ValueError('Unconverted pronunciation input: '+repr(text))
            previous=None
            continue
        onset,v,coda=syllable
        phone=ONSETS[onset];group=GROUPS[onset]
        if previous is not None and previous[2] in SONORANTS:
            voiced={0:('g','g'),3:('d','d'),7:('b','b'),12:('dʑ','z')}.get(onset)
            if voiced: phone,group=voiced
        if onset==5 and previous is not None and previous[2]==8: phone='l'
        if onset in (9,10) and (v==20 or VOWELS[v].startswith('j')):
            phone='ɕ' if onset==9 else 'ɕ͈'
        if previous is not None: ipa.append('.')
        ipa.append(phone+VOWELS[v]+CODAS[coda])
        # Katakana cannot encode all tense/aspirated contrasts. IPA keeps them.
        tight = onset in (1,4,8,10,13) and previous is not None and previous[2] in {0,1,2,3,7,17,18,19,20,22,23,24,25,26,27}
        if tight: kana.append('ッ')
        kana.append(kana_syllable(group,v))
        following=split_syllable(text[at+1]) if at+1<len(text) else None
        absorbed=CODAS[coda] in {'k̚','t̚','p̚'} and following is not None and following[0] in {1,4,8,10,13}
        if not absorbed: kana.append(KODA[CODAS[coda]])
        previous=syllable
    k=re.sub(r'\s+',' ',''.join(kana)).strip()
    p=re.sub(r'\s+',' ',''.join(ipa)).strip(' |')
    if not k or not p: raise ValueError('Empty pronunciation: '+repr(text))
    return [k,'['+p+']']

class Pronouncer:
    def __init__(self):
        from g2pk2 import G2p
        self.g2p=G2p()

    @lru_cache(maxsize=40000)
    def __call__(self,text: str) -> tuple[str,str]:
        spoken=self.g2p(text)
        return tuple(from_pronounced_hangul(spoken))

if __name__=='__main__':
    p=Pronouncer()
    for word in ['안녕하세요.','감사합니다.','학교','같이','읽다','한국어','저는 음악을 만들어요.']:
        print(word,p(word))
