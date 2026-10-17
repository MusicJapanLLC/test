"""Record every card in a natural neural voice, one MP3 "sprite" per record.

Voice model: Kokoro-82M (Apache-2.0), run locally with kokoro-onnx. Nothing is sent to an online service.
    pip install kokoro-onnx soundfile
    KOKORO_MODEL=/path/kokoro-v1.0.onnx KOKORO_VOICES=/path/voices.npz python scripts/audio.py [record ...] [--workers 2]
voices.npz holds af_heart, am_michael, af_bella and am_puck as (510, 1, 256) float32 arrays.

Output (committed, because the site build cannot run the model):
    public/audio/<record>.<n>.<hash>.mp3  ~45 s chunks of the record's clips, 0.25 s of silence between clips
    public/audio/<record>.json            {"f": [chunk file names], "c": {"<card id>:<clip>": [chunk, start_s, dur_s], ...}}
The hash in the file name changes whenever a chunk's audio changes, so browsers can cache chunks forever.
Small chunks keep the decoded audio small on phones; the app decodes one chunk at a time.
Clip keys: h = headword/phrase, hs = the same, slow; l0..l3 = example or dialogue lines; v0 = the natural version.
Clips are cached in .cache/tts/ by text + voice + speed, so re-running only records what changed.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'public/data'
OUT = ROOT / 'public/audio'
CACHE = ROOT / '.cache/tts'
SR = 24000
GAP = 0.25
VOICE = {'A': 'af_heart', 'B': 'am_michael', 'C': 'af_bella', 'D': 'am_puck'}

# How to say things the phonemizer gets wrong (only for the voice; the card text is unchanged)
SAY = {
    'rizz': 'riz', 'lowkey': 'low-key', 'highkey': 'high-key', 'deadass': 'dead-ass', 'doomscroll': 'doom-scroll',
    'doomscrolling': 'doom-scrolling', 'situationship': 'situation-ship', 'bussin': "bussin'", 'FOMO': 'foe-moe',
    'YOLO': 'yoe-loe', 'af': 'A.F.', 'smh': 'S.M.H.', 'ikr': 'I.K.R.', 'jk': 'J.K.', 'nvm': 'N.V.M.', 'np': 'N.P.',
    'gg': 'G.G.', 'afk': 'A.F.K.', 'brb': 'B.R.B.', 'wtf': 'W.T.F.', 'btw': 'B.T.W.', 'imo': 'I.M.O.', 'ty': 'T.Y.',
    'tbh': 'T.B.H.', 'omw': 'O.M.W.', 'lol': 'L.O.L.', 'ngl': 'N.G.L.', 'idk': 'I.D.K.', 'lmk': 'L.M.K.',
    'hmu': 'H.M.U.', 'rn': 'right now', 'pls': 'please', 'thx': 'thanks', 'u': 'you', 'ur': 'your', 'W': 'dub',
    'sb': 'someone', 'sth': 'something', 'EOD': 'E.O.D.', 'KPI': 'K.P.I.', 'B2B': 'B. to B.', 'NPC': 'N.P.C.',
    'TMI': 'T.M.I.', 'IRL': 'I.R.L.', 'DM': 'D.M.', 'DMs': 'D.M.s', 'ASAP': 'A.S.A.P.', 'FYI': 'F.Y.I.', 'ROI': 'R.O.I.',
    'SEO': 'S.E.O.', 'CEO': 'C.E.O.', 'OG': 'O.G.', 'gonna': 'gonna', 'entrée': 'on-tray',
}
SAY_RE = re.compile(r"(?<![\w'])(" + '|'.join(re.escape(k) for k in sorted(SAY, key=len, reverse=True)) + r")(?![\w'])")


def speakable(text):
    t = re.sub(r'\([^)]*\)', ' ', text)          # stage directions: (raising a glass)
    t = t.replace('…', ', ').replace('~', ' something ').replace('&', ' and ')
    t = re.sub(r'\s*/\s*', ', or ', t)
    t = re.sub(r'[“”"]', '', t)
    t = SAY_RE.sub(lambda m: SAY[m.group(1)], t)
    t = re.sub(r'\s+', ' ', t).strip(' ,')
    return t if re.search(r'[A-Za-z]', t) else ''


def clips_for(c, n):
    """(key, text, voice, speed) for one card."""
    out = []
    head = speakable(c['h'])
    if head:
        out.append(('h', head, 'af_heart', 1.0))
        out.append(('hs', head, 'af_heart', 0.78))
    for i, (who, line) in enumerate((c.get('l') or [])[:4]):
        t = speakable(line)
        if t:
            out.append((f'l{i}', t, VOICE.get(who) or ('am_michael' if (n + i) % 2 == 0 else 'af_heart'), 1.0))
    if c.get('v') and c.get('re') in ('textbook', 'cringe'):
        t = speakable(c['v'][0][0])
        if t:
            out.append(('v0', t, 'am_michael', 1.0))
    return out


def cache_path(text, voice, speed):
    h = hashlib.sha1(f'{voice}|{speed}|{text}'.encode()).hexdigest()
    return CACHE / h[:2] / f'{h}.flac'


_kokoro = None


def synth(text, voice, speed):
    global _kokoro
    if _kokoro is None:
        import onnxruntime as ort
        from kokoro_onnx import Kokoro
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = int(os.environ.get('KOKORO_THREADS', '2'))
        sess = ort.InferenceSession(os.environ['KOKORO_MODEL'], opts, providers=['CPUExecutionProvider'])
        _kokoro = Kokoro.from_session(sess, os.environ['KOKORO_VOICES'])
    audio, sr = _kokoro.create(text, voice=voice, speed=speed, lang='en-us')
    assert sr == SR
    # trim silence but keep a short tail so words don't sound clipped
    loud = np.where(np.abs(audio) > 0.01)[0]
    if len(loud):
        audio = audio[max(0, loud[0] - int(0.03 * SR)): min(len(audio), loud[-1] + int(0.08 * SR))]
    return audio.astype(np.float32)


CHUNK = 45.0


def encode(parts, rec_id, n):
    pcm = (np.clip(np.concatenate(parts), -1, 1) * 32767).astype('<i2').tobytes()
    name = f'{rec_id}.{n}.{hashlib.sha1(pcm).hexdigest()[:8]}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '32k', str(OUT / name)], input=pcm, check=True)
    return name


def record(rec_id):
    items = [c for f in ('cards.json', 'words.json') for c in json.loads((DATA / f).read_text()) if c.get('rec') == rec_id]
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob(f'{rec_id}.*mp3'):
        old.unlink()
    silence = np.zeros(int(GAP * SR), np.float32)
    index, chunk, parts, t, made, total, files = {}, 0, [silence], GAP, 0, 0.0, []
    for n, c in enumerate(items):
        if t > CHUNK:  # chunks only break between cards
            files.append(encode(parts, rec_id, chunk))
            chunk, parts, t = chunk + 1, [silence], GAP
        for key, text, voice, speed in clips_for(c, n):
            p = cache_path(text, voice, speed)
            if p.exists():
                audio, _ = sf.read(p, dtype='float32')
            else:
                audio = synth(text, voice, speed)
                p.parent.mkdir(parents=True, exist_ok=True)
                sf.write(p, audio, SR, subtype='PCM_16')
                made += 1
            index[f"{c['id']}:{key}"] = [chunk, round(t, 3), round(len(audio) / SR, 3)]
            parts += [audio, silence]
            t += len(audio) / SR + GAP
            total += len(audio) / SR
    files.append(encode(parts, rec_id, chunk))
    (OUT / f'{rec_id}.json').write_text(json.dumps({'f': files, 'c': index}, separators=(',', ':')))
    return rec_id, len(index), made, round(total)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    workers = int(sys.argv[sys.argv.index('--workers') + 1]) if '--workers' in sys.argv else 1
    if '--workers' in sys.argv:
        args = [a for a in args if a != str(workers)]
    recs = args or [r['id'] for r in json.loads((DATA / 'meta.json').read_text())['records']]
    with ProcessPoolExecutor(workers) as pool:
        for rec_id, clips, made, secs in pool.map(record, recs):
            print(f'{rec_id}: {clips} clips ({made} new), {secs}s', flush=True)


if __name__ == '__main__':
    main()
