#!/usr/bin/env python3
"""Reproducibly build the requested Korean upgrade from the exact v1.0 source.
Run from repository root. Writes only Korean HTML, its publisher digest, and its
publication test digest. Does not deploy or push. Fails rather than overwrite a
changed baseline. npm tests and browser checks are separate release gates.
"""
from __future__ import annotations
import hashlib,json,re,time
from pathlib import Path
from phonetics import Pronouncer

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
SITE=ROOT/'music-japan-site-trace'
HTML=SITE/'learning/korean/index.html'
BASE_SHA='3da5e732b47401cea010b64ded1086d9af773688f1b1c03f88e50dd5e90650c3'
DATA_RE=re.compile(r'(<script id="course-data" type="application/json">)([\s\S]*?)(</script>)')

def replace_once(text:str,old:str,new:str,count:int=1)->str:
    actual=text.count(old)
    if actual!=count: raise ValueError(f'Expected {count} occurrence(s), found {actual}: {old[:120]}')
    return text.replace(old,new)

def replace_line(text:str,prefix:str,new:str)->str:
    lines=text.splitlines()
    indices=[i for i,line in enumerate(lines) if line.startswith(prefix)]
    if len(indices)!=1: raise ValueError(f'Expected one source line: {prefix}')
    lines[indices[0]]=new
    return '\n'.join(lines)

def build_data(d:dict)->dict:
    original_ids=[w['id'] for w in d['words']]
    examples={}
    for file in sorted(HERE.glob('examples-*.tsv')):
        for line in file.read_text(encoding='utf-8').splitlines():
            if not line.strip():continue
            fields=line.split('|')
            if len(fields)!=4:raise ValueError(f'Bad example in {file.name}: {line}')
            n=int(fields[0]);ko,en,ja=fields[1:]
            if n in examples or not 1<=n<=1000 or not all((ko,en,ja)):raise ValueError(f'Invalid or duplicate example {n}')
            examples[n]={'id':f'u{n:03d}','wordId':f'w{n:03d}','ar':ko,'en':en,'ja':ja,'latin':'','ipa':'','register':'casual' if n in {1,5,25,26,27} else 'polite','kind':'usage','provenance':'Usage example · AI-authored draft'}
    if set(examples)!=set(range(1,1001)):raise ValueError('Exactly one authored example per word is required')
    d['usageExamples']=[examples[i] for i in range(1,1001)]
    for i,w in enumerate(d['words'],1):
        if w['id']!=examples[i]['wordId']:raise ValueError('Original word identity mismatch')
        w['usageId']=examples[i]['id']
    dialogues=json.loads((HERE/'dialogues.json').read_text(encoding='utf-8'))
    for n,scene in enumerate(dialogues,1):
        turns=[]
        for i,turn in enumerate(scene['turns'],1):
            speaker,ko,en,ja,*style=turn
            if speaker not in scene['roles']:raise ValueError('Unknown conversation speaker')
            register=style[0] if style else scene['register']
            if register not in {'casual','polite','formal'}:raise ValueError('Explicit register is required for mixed scenes')
            turns.append({'id':f'd{n:02d}-{i:02d}','speaker':speaker,'ar':ko,'en':en,'ja':ja,'ipa':'','latin':'','register':register,'kind':'dialogue','provenance':f'Conversation {n:02d} · {speaker}','note':scene['situation']})
        scene['turns']=turns
    d['dialogues']=dialogues
    texts={w['ar'] for w in d['words']}
    texts.update(x['ar'] for x in d['usageExamples'])
    texts.update(t['ar'] for scene in dialogues for t in scene['turns'])
    texts.update(text for lesson in d['lessons'] for x in lesson['lines'] for text in x['forms'].values())
    contexts=set()
    for family in d['families']:
        for item in family['items']:texts.add(item['ar'])
        for context in family['contexts']:contexts.add(context['ar']);texts.add(context['ar'])
        for frame in family['frames']:
            for template in frame['forms'].values():
                if not template.startswith('{c} '):raise ValueError('Generated context order changed')
                texts.add(template.replace('{x}','…').replace('{c}','…'))
                for item in family['items']:texts.add(template.replace('{c}','').replace('{x}',item['ar']).strip())
    d['readingContexts']=sorted(contexts,key=lambda s:(-len(s),s))
    p=Pronouncer();start=time.monotonic();pronunciation={}
    for i,text in enumerate(sorted(texts),1):
        pronunciation[text]=list(p(text))
        if i%500==0:print(f'Generated {i}/{len(texts)} reading guides in {time.monotonic()-start:.1f}s',flush=True)
    d['pronunciation']=pronunciation
    # The original app used the legacy ipa field as a Japanese gloss. Japanese
    # remains in ja; fixed IPA fields now carry pronunciation, not translations.
    fixed=[*d['words'],*d['usageExamples'],*(x for l in d['lessons'] for x in l['lines']),*(t for c in dialogues for t in c['turns'])]
    for x in fixed:x['kana'],x['ipa']=pronunciation[x['ar']]
    for f in d['families']:
        for x in [*f['frames'],*f['items'],*f['contexts']]:x['ipa']=''
    d['meta'].update(version='1.1.0',built='2026-10-15',nativeReviewed=False,ipaStatus='Automatically generated approximate Katakana and broad IPA using g2pk2 0.0.3 sound changes. Not native-speaker reviewed. Generated combinations join chunk guides; cross-chunk changes and intonation are not modelled.',usageExampleCount=len(d['usageExamples']),dialogueCount=len(dialogues),dialogueTurnCount=sum(len(c['turns']) for c in dialogues),readingEntryCount=len(pronunciation))
    d['sources'].append({'id':'reading-method','title':'Reading method: g2pK / g2pk2','url':'https://github.com/kyubyong/g2pK','scope':'Build-time Korean sound-change processing (g2pk2 0.0.3 fork), then an original approximate Katakana / broad IPA mapping. These methods do not establish native-speaker accuracy for this course.'})
    if original_ids!=[w['id'] for w in d['words']]:raise ValueError('Existing vocabulary IDs changed')
    return d

def patch_app(text:str)->str:
    scripts=re.findall(r'<script>([\s\S]*?)</script>',text)
    main=next(s for s in scripts if 'const D=JSON.parse(' in s)
    original_main=main
    main=replace_once(main,'const memoryStates={};',(HERE/'upgrade-ui.js').read_text(encoding='utf-8')+'\nconst memoryStates={};')
    main=replace_once(main,'function stopEverything(){pauseSession();','function stopEverything(){stopConversationPlayback();conversation=null;pauseSession();')
    main=replace_once(main,'if(a.register){changeRegister(a.register);return}',"if(a.readingToggle){setReadingPreference(a.readingToggle,!readingPreferences[a.readingToggle]);return}if(handleConversationClick(b))return;if(a.register){changeRegister(a.register);return}")
    main=replace_once(main,'if(a.play){hear(a.play);return}if(a.slow){hear(a.slow,true);return}', 'if(a.play){stopConversationPlayback();hear(a.play);return}if(a.slow){stopConversationPlayback();hear(a.slow,true);return}')
    main=replace_once(main,"case'stop-audio':pauseSession();stopAudio();break;","case'stop-audio':stopConversationPlayback();pauseSession();stopAudio();break;")
    main=replace_once(main,"if(document.hidden){pauseSession();stopAudio();recorder.abort()}","if(document.hidden){stopConversationPlayback();pauseSession();stopAudio();recorder.abort()}")
    main=replace_once(main,"const el=e.target;try{if(el.id==='practice-level')","const el=e.target;try{if(el.id==='kana-setting'||el.id==='ipa-setting'){setReadingPreference(el.id.split('-')[0],el.checked);return}if(el.id==='practice-level')")
    main=replace_line(main,'function renderWordResults(){','function renderWordResults(){return renderWordResultsV11()}')
    main=replace_line(main,'function openWord(id){','function openWord(id){return openWordV11(id)}')
    # The original remaining Korean renderers use these exact small templates.
    for old,new in [
      ('<div class="ar" lang="ko-KR" dir="ltr">${esc(x.ar)}</div>','${koreanMarkup(x.ar)}'),
      ('<div class="ar" lang="ko-KR">${esc(l.lines[0].ar)}</div>','${koreanMarkup(l.lines[0].ar)}'),
      ('<div class="ar" lang="ko-KR">${esc(x.ar)}</div>','${koreanMarkup(x.ar)}'),
      ('<div class="ar">${esc(q.x.ar)}</div>','${koreanMarkup(q.x.ar)}'),
      ('<div class="chunk-preview" lang="ko-KR">${esc(arr[v].ar.replace(\'{x}\',\'…\').replace(\'{c}\',\'…\'))}</div>','<div class="chunk-preview">${koreanMarkup(arr[v].ar.replace(\'{x}\',\'…\').replace(\'{c}\',\'…\'),true)}</div>')
    ]: main=replace_once(main,old,new)
    main=main.replace('esc(l.lines[0].ipa)','esc(l.lines[0].ja)').replace('esc(x.ipa)','esc(x.ja)').replace('esc(q.x.ipa)','esc(q.x.ja)').replace("x.ja||x.ipa||''","x.ja||''")
    main=replace_once(main,"${x.forms?`<div class=\"register-tag\">${esc(REGISTERS[REGISTER].label)}</div>`:''}","${x.forms?`<div class=\"register-tag\">${esc(REGISTERS[REGISTER].label)}</div>`:x.register?`<div class=\"register-tag\">${esc(REGISTERS[x.register].label)} · example context</div>`:''}")
    main=replace_once(main,'<section class="section"><div class="section-title"><h2>Real situations</h2>','${conversationCatalog()}<section class="section"><div class="section-title"><h2>Real situations</h2>')
    main=replace_once(main,'</div>`}\nfunction changeRegister','</div>${readingToolbar()}`}\nfunction changeRegister')
    main=replace_once(main,'<div class="fields"><div><label for="voice-select">','${readingSettings()}<div class="fields"><div><label for="voice-select">')
    main=main.replace('Hangul, meaning and optional device audio.','Reading hints, meaning and a usage example for every word.')
    main=main.replace('Japanese help is a meaning aid, not phonetic transcription.','Katakana and IPA are approximate reading aids; English and Japanese lines give the meaning.')
    main=main.replace('1,000 distinct headwords · 160 lesson examples with 3 authored speaking styles','1,000 distinct headwords · 1,000 added usage examples · 12 conversations / 104 turns · 160 lesson meanings with 3 authored speaking styles')
    main=main.replace('No raw chats, contact lists, message identifiers, tokens, analytics or app-side uploads are included.','No raw chats, contact lists, message identifiers, secrets or app-side uploads are included. The public hosting provider may add analytics independently of this offline app.')
    main=main.replace('未公開のHTML版　公開URLやiPhone実機での動作は未確認','読み方と例文を追加した公開版　iPhone実機の音声・マイク、全教材の母語話者校閲は未確認')
    main=replace_once(main,'for(const l of D.lessons)for(const x of l.lines)x.ar=x.forms[mode];','for(const l of D.lessons)for(const x of l.lines){x.ar=x.forms[mode];x.ipa=D.pronunciation[x.ar]?.[1]||\'\';}')
    text=replace_once(text,'<script>'+original_main+'</script>','<script>'+(HERE/'reading-engine.js').read_text(encoding='utf-8')+'</script><script>'+main+'</script>')
    text=replace_once(text,'const fixed=new Map([...data.words,...data.lessons.flatMap(l=>l.lines)].map(x=>[x.id,x]));','const fixed=new Map([...data.words,...data.lessons.flatMap(l=>l.lines),...(data.usageExamples||[]),...(data.dialogues||[]).flatMap(d=>d.turns)].map(x=>[x.id,x]));')
    text=text.replace('s.saved.length>11160','s.saved.length>fixed.size+10000').replace('Object.keys(s.reviews).length>11160','Object.keys(s.reviews).length>fixed.size+10000')
    text=replace_once(text,'</style>',(HERE/'upgrade.css').read_text(encoding='utf-8')+'\n</style>')
    text=replace_once(text,'data-testid="app-ready"','data-testid="app-ready" data-course-version="1.1.0"')
    text=text.replace('Korean practice with your own words: 1,000 words, three speaking styles.','Korean practice: Katakana and IPA reading hints, 1,000 words with examples and 12 conversations.')
    text=text.replace('Open the app in a browser using the local launcher included in the ZIP.','Open music-japan.com/korean/ in Safari or Chrome with JavaScript enabled.')
    return text

def main():
    source=HTML.read_bytes()
    if hashlib.sha256(source).hexdigest()!=BASE_SHA:raise SystemExit('Baseline changed. Inspect the current Korean source; do not overwrite it.')
    original=source.decode('utf-8');match=DATA_RE.search(original)
    data=build_data(json.loads(match[2]))
    text=DATA_RE.sub(lambda m:m[1]+json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+m[3],original,count=1)
    result=patch_app(text).encode('utf-8')
    digest=hashlib.sha256(result).hexdigest()
    # Validate every publisher pin before making any output write.
    pinned=[]
    for file in [SITE/'scripts/publish-korean.mjs',SITE/'tests/korean-publication.test.mjs']:
        old=file.read_text(encoding='utf-8')
        if BASE_SHA not in old:raise ValueError('Publication pin changed: '+str(file))
        pinned.append((file,old.replace(BASE_SHA,digest)))
    HTML.write_bytes(result)
    for file,value in pinned:file.write_text(value,encoding='utf-8')
    report={'sourceSha256':BASE_SHA,'resultSha256':digest,'bytes':len(result),'words':len(data['words']),'usageExamples':len(data['usageExamples']),'dialogues':len(data['dialogues']),'dialogueTurns':sum(len(x['turns']) for x in data['dialogues']),'readingEntries':len(data['pronunciation']),'nativeReviewed':False,'deployed':False}
    out=ROOT/'korean-v11-evidence';out.mkdir(exist_ok=True)
    (out/'build-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__':main()
