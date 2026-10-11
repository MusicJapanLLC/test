"""One-time exact migration of the reviewed mobile HTML to hosted audio."""
from pathlib import Path
import hashlib
OLD_SHA='996f48eb35ed437ad7656c960938aff717e0c10181fd041aafcde7c13e98c4e4'

def patch_html(s):
    assert 'src="./hosted-audio.js?v=2"' not in s, 'Audio migration already applied'
    def replace(old,new,count=None):
        nonlocal s
        hits=s.count(old)
        assert hits and (count is None or hits==count), 'Expected source text missing or ambiguous: '+old[:80]
        s=s.replace(old,new)
    replace("script-src 'unsafe-inline';","script-src 'self' 'unsafe-inline';",1)
    replace('media-src blob: data:;',"media-src 'self' blob: data:;",1)
    replace('<script>/* Wahran: a private, transcript-first learning app.', '<script src="./audio-manifest.js?v=2"></script><script src="./hosted-audio.js?v=2"></script><script>/* Wahran: a transcript-first learning app.',1)
    replace('Device TTS · ${v.lang} · approximate', "${v.hosted?'Included audio':'Device TTS'} · ${v.lang} · synthetic",1)
    replace('Device Arabic TTS · approximate, not a native Oran model','Included Algerian Arabic audio · synthetic; combinations use chunks')
    replace('Device Arabic TTS · approximate','Included Algerian Arabic audio · synthetic')
    replace('Audio uses your device’s Arabic voice, not verified Oran recordings. IPA and course sentences are a learning draft.', 'Audio is included — no voice installation. It is synthetic Algerian Arabic, not verified Oran recordings. Combinations play as chunks; IPA and sentences remain a learning draft.',1)
    replace('Device voices are <strong>not Oran-native recordings</strong>.','Included synthetic voices are <strong>not Oran-native recordings</strong>.',1)
    start=s.index('<div><label for="voice-select">')
    end=s.index('<div><label for="speech-rate">',start)
    s=s[:start]+'<div class="try"><strong>Included audio</strong>500 words + 160 examples. All 10,000 combinations have spoken chunks. No device voice installation or account is needed.</div>'+s[end:]
    replace('Test Arabic audio','Play an audio sample',1)
    replace('Open this website in Safari or Chrome. No computer or ZIP file is needed. On iPhone, tap Share → Add to Home Screen to keep Wahran beside your apps. If Arabic audio is unavailable, look in Accessibility → Read & Speak or Spoken Content → Voices for an Arabic voice; menu names vary. Relaunch Safari and refresh voices after downloading one.', 'Open this website in Safari or Chrome and tap Listen. No computer, ZIP file or Arabic voice installation is needed. On iPhone, tap Share → Add to Home Screen to keep Wahran beside your apps. Keep the app visible during practice; tap Listen again if your phone interrupts playback.',1)
    replace('Device voices may require a network connection. This app makes no external content requests itself.','Included audio loads from this website. No speech-generation API is called by your phone.',1)
    replace('Speech is provided by your device or an imported recording. A voice provider may use the network.','Synthetic audio files are served from this website, or you can play an imported recording. Your recordings are not sent to a speech provider.',1)
    replace('This item will use device TTS.','This item will use the included audio.',1)
    replace('Listening uses the selected voice; no speech recognition is running.','Listening uses included audio; no speech recognition is running.',1)
    replace('Wahran ${D.meta.version} · Course built','Wahran 1.1 · Included audio · Course built',1)
    return s

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    target=root/'next/public/wahran/index.html'
    original=target.read_bytes()
    assert hashlib.sha256(original).hexdigest()==OLD_SHA, 'Unreviewed source version'
    updated=patch_html(original.decode()).encode()
    sha=hashlib.sha256(updated).hexdigest()
    target.write_bytes(updated)
    helper=root/'scripts/publish-wahran.mjs'
    h=helper.read_text();assert OLD_SHA in h
    h=h.replace(OLD_SHA,sha).replace('readFileSync, writeFileSync, mkdirSync','readFileSync, writeFileSync, mkdirSync, cpSync')
    old="writeFileSync(join(output,'wahran/index.html'),source);"
    assert old in h
    h=h.replace(old,"cpSync(join(root,'next/public/wahran'),join(output,'wahran'),{recursive:true});")
    helper.write_text(h)
    workflow=root.parent/'.github/workflows/wahran-publication.yml'
    h=workflow.read_text();assert OLD_SHA in h;workflow.write_text(h.replace(OLD_SHA,sha))
    print('HOSTED_HTML_READY',len(updated),sha)
