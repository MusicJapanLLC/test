#!/usr/bin/env python3
"""Browser evidence. Stubbed audio is explicitly separate from real sound.
KOREAN_URL can point to the published page; default is the local candidate.
"""
import datetime,hashlib,json,os,re,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'music-japan-site-trace/learning/korean/index.html').read_bytes()
data=json.loads(re.search(rb'<script id="course-data" type="application/json">(.*?)</script>',source,re.S)[1])
out=ROOT/'korean-v11-evidence';out.mkdir(exist_ok=True)
url=os.environ.get('KOREAN_URL','http://127.0.0.1:8174/')
checks=[];errors=[]
def passed(label):checks.append(label);print('PASS:',label,flush=True)
def payloads(b):return re.findall(rb'<style[^>]*>(.*?)</style>',b,re.S)+re.findall(rb'<script(?: id="[^"]*")?(?: type="[^"]*")?>(.*?)</script>',b,re.S)
def identity(response):
    for payload in payloads(source):assert payload in payloads(response),'Published payload differs from tested source'
def wait_for_test(predicate,timeout=20):
    deadline=time.monotonic()+timeout
    while not predicate():
        if time.monotonic()>deadline:raise AssertionError('Timed out waiting for test transport state')
        time.sleep(.05)

audio_stub="""(()=>{window.__spoken=[];let timers=[];const stop=()=>{timers.forEach(clearTimeout);timers=[]};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Test Korean transport',lang:'ko-KR',voiceURI:'mock-ko',localService:true}],cancel:stop,addEventListener:()=>{},speak:u=>{window.__spoken.push(u.text);timers.push(setTimeout(()=>u.onstart?.(),0));timers.push(setTimeout(()=>u.onend?.(),35))}}});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}})()"""
with sync_playwright() as p:
    launch={'headless':True}
    if os.environ.get('CHROMIUM_PATH'):launch['executable_path']=os.environ['CHROMIUM_PATH']
    browser=getattr(p,os.environ.get('KOREAN_BROWSER','chromium')).launch(**launch)
    context=browser.new_context(viewport={'width':390,'height':844})
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    def tab(name):page.locator('.bottom-nav [data-tab="'+name+'"]').click()
    def close():page.locator('[data-action="close-dialog"]').click()
    def ordered(selector):
        coords=page.locator(selector).evaluate('(el)=>[...el.querySelectorAll(":scope > .kana,:scope > .ar,:scope > .ipa")].map(x=>({kind:x.className,y:x.getBoundingClientRect().y,h:x.getBoundingClientRect().height,text:x.textContent}))')
        assert [c['kind'] for c in coords]==['kana','ar','ipa'],coords
        assert coords[0]['y']+coords[0]['h']<=coords[1]['y']+1,coords
        assert coords[1]['y']+coords[1]['h']<=coords[2]['y']+1,coords
    try:
        r=page.goto(url,wait_until='load');assert r.status==200
        identity(r.body());assert page.locator('[data-course-version="1.1.0"]').count()==1
        (out/'browser-response.html').write_bytes(r.body())
        (out/'http-result.json').write_text(json.dumps({'url':r.url,'status':r.status,'headers':r.all_headers(),'responseSha256':hashlib.sha256(r.body()).hexdigest(),'sourceSha256':hashlib.sha256(source).hexdigest()},indent=2))
        passed('HTTP 200 and every inline application payload matches the candidate source')
        ordered('.hero .reading');assert page.locator('.hero .ipa').inner_text().strip()==data['pronunciation'][data['lessons'][0]['lines'][0]['forms']['polite']][1]
        assert page.locator('.hero .ipa').bounding_box()['y']<page.locator('.hero .en').bounding_box()['y']
        passed('small Katakana above Hangul and IPA below it, before English')
        for name in ['kana','ipa']:
            b=page.locator('[data-reading-toggle="'+name+'"]');assert b.get_attribute('aria-pressed')=='true';b.click()
            assert page.locator('.hero .'+name).is_hidden();page.reload(wait_until='load');assert page.locator('.hero .'+name).is_hidden()
            page.locator('[data-reading-toggle="'+name+'"]').click();assert page.locator('.hero .'+name).is_visible()
        page.locator('[data-action="settings"]').first.click();page.locator('#kana-setting').uncheck();assert page.evaluate('document.documentElement.classList.contains("hide-kana")');page.locator('#kana-setting').check();close()
        passed('independent default-on reading switches persist through reload and settings stay in sync')
        for mode in ['casual','formal','polite']:
            page.locator('[data-register="'+mode+'"]').click();text=data['lessons'][0]['lines'][0]['forms'][mode]
            assert page.locator('.hero .ar').inner_text()==text
            assert page.locator('.hero .ipa').inner_text().strip()==data['pronunciation'][text][1]
        passed('actual Korean and pronunciation switch together across all three speaking styles')
        page.screenshot(path=str(out/'mobile-home.png'),full_page=True)
        page.locator('.hero [data-lesson]').click();ordered('#main .phrase:first-of-type .reading');page.screenshot(path=str(out/'mobile-lesson.png'),full_page=True)
        tab('words');observed={}
        for topic in data['topics']:
            page.locator('#word-topic').select_option(topic['id']);page.locator('[data-action="more-words"]').click()
            assert page.locator('.word-card').count()==50
            rows=page.locator('.usage-preview').evaluate_all('(els)=>els.map(e=>({id:e.dataset.usageId,ar:e.querySelector(".ar").textContent,en:e.querySelector(".en").textContent,ja:e.querySelector(".ja-inline").textContent}))')
            for row in rows:observed[row['id']]=row
        assert len(observed)==1000
        for u in data['usageExamples']:assert observed[u['id']]=={k:u[k] for k in ['id','ar','en','ja']}
        passed('all 1000 authored usage examples are actually rendered beneath their words in the 20 topics')
        page.locator('#word-topic').select_option('music');page.screenshot(path=str(out/'mobile-word-examples.png'),full_page=True)
        page.locator('#word-topic').select_option('all');page.locator('#word-search').fill('정도');page.locator('[data-open="w1000"]').click()
        assert page.locator('#dialog [data-audio-id="u1000"]').count()==1;ordered('#dialog [data-audio-id="u1000"] .reading')
        page.locator('#dialog [data-save="u1000"]').click();close();page.reload(wait_until='load')
        assert 'u1000' in page.evaluate('JSON.parse(localStorage.getItem("wahran-korean-polite-v1")).saved')
        passed('word detail contains its full example, and a new example saves and restores after reload')
        tab('speak');assert page.locator('[data-dialogue]').count()==12;page.screenshot(path=str(out/'mobile-conversation-catalog.png'),full_page=True)
        for d in data['dialogues']:
            page.locator('[data-dialogue="'+d['id']+'"]').click()
            for i,t in enumerate(d['turns']):
                reveal=page.locator('[data-conversation-reveal]')
                if t['speaker']=='A':assert reveal.count()==1;reveal.click()
                else:assert reveal.count()==0
                assert page.locator('.conversation-step .ar').inner_text()==t['ar']
                ordered('.conversation-step .reading')
                page.locator('[data-conversation-next]').click()
            assert page.locator('.conversation-complete').count()==1
            close()
        passed('all 12 conversations and 104 turns advance, reveal, show reading hints and reach the ending')
        page.locator('[data-dialogue="first-meeting"]').click();page.locator('[data-conversation-role="B"]').click()
        assert page.locator('.conversation-step .ar').inner_text()==data['dialogues'][0]['turns'][0]['ar']
        page.locator('[data-conversation-next]').click();assert page.locator('[data-conversation-reveal]').count()==1;assert page.locator('.conversation-step .ar').count()==0
        page.locator('[data-conversation-reveal]').click();page.screenshot(path=str(out/'mobile-conversation-practice.png'),full_page=True)
        page.locator('[data-conversation-mode="transcript"]').click();assert page.locator('.conversation-turn').count()==10
        page.screenshot(path=str(out/'mobile-conversation-transcript.png'),full_page=True);close()
        passed('A/B role switching changes whose Korean is hidden, and the full conversation remains available')
        for width in [320,375,390,768,1440]:
            page.set_viewport_size({'width':width,'height':844})
            for name in ['learn','build','speak','words','culture']:
                tab(name);assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,name)
                assert page.locator('.bottom-nav button').count()==5
            tab('speak');page.locator('[data-dialogue="music-connection"]').click();page.locator('[data-conversation-mode="transcript"]').click()
            assert page.locator('#dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),width
            if width==1440:page.screenshot(path=str(out/'desktop-dialogue.png'),full_page=True)
            close()
        passed('five screens and long conversation panels fit 320, 375, 390, 768 and 1440px widths')
        assert not errors,errors
        passed('no JavaScript page errors in the tested non-audio application flows')
    finally:
        page.screenshot(path=str(out/'last-screen.png'),full_page=True)
        (out/'partial-browser-report.json').write_text(json.dumps({'passed':checks,'pageErrors':errors},indent=2))
        context.close()
    context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();page.goto(url)
    seeds={}
    for mode in ['polite','casual','formal']:
        seeds[mode]={'version':1,'course':'wahran-ko-v1','register':mode,'saved':['w001','l01-01','c09999'],'reviews':{'w001':{'streak':2,'attempts':3,'due':1792051200000}},'completed':['l01'],'lastLesson':'l02','settings':{'voice':'','rate':.85,'pause':4,'repeats':2,'latin':False},'stats':{'answers':7,'correct':5,'spoken':3},'session':None}
    page.evaluate('(seeds)=>{for(const [mode,s] of Object.entries(seeds))localStorage.setItem("wahran-korean-"+mode+"-v1",JSON.stringify(s));localStorage.setItem("wahran-korean-register","polite")}',seeds)
    page.reload(wait_until='load')
    for mode in ['polite','casual','formal']:
        page.locator('[data-register="'+mode+'"]').click();page.reload(wait_until='load')
        assert page.locator('.hero .caption').first.inner_text()=='LESSON 02'
        actual=page.evaluate('(mode)=>JSON.parse(localStorage.getItem("wahran-korean-"+mode+"-v1"))',mode);assert actual==seeds[mode]
    passed('real browser reload preserves old saved words, reviews, totals and lesson position in all three style stores')
    context.close()
    # Transport-only audio checks. These do NOT prove physical sound or accent.
    context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script(audio_stub);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url);assert page.evaluate('Array.isArray(window.__spoken)'),errors
    page.locator('.bottom-nav [data-tab="speak"]').click();page.locator('[data-dialogue="cafe-order"]').click();page.locator('[data-conversation-play]').click()
    wait_for_test(lambda:page.evaluate('window.__spoken.length')==8 and page.locator('[data-conversation-play]').get_attribute('aria-pressed')=='false')
    assert page.evaluate('window.__spoken')==[t['ar'] for t in data['dialogues'][1]['turns']]
    passed('stubbed Korean audio transport plays every conversation turn in the authored order')
    page.evaluate('window.__spoken=[]');page.locator('[data-conversation-play]').click();wait_for_test(lambda:page.evaluate('window.__spoken.length')==1);page.locator('[data-action="close-dialog"]').click();page.wait_for_timeout(1100)
    assert page.evaluate('window.__spoken.length')==1
    page.locator('[data-dialogue="first-meeting"]').click();page.locator('[data-conversation-play]').click();wait_for_test(lambda:page.evaluate('window.__spoken.length')==2);page.locator('[data-conversation-play]').click();page.wait_for_timeout(1100)
    assert page.evaluate('window.__spoken.length')==2
    passed('closing the dialog or pressing Stop cancels pending conversation audio without stale later lines (stubbed transport)')
    context.close()
    context=browser.new_context();context.add_init_script("Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel:()=>{},addEventListener:()=>{}}})");page=context.new_page();page.goto(url);page.locator('.hero [data-play]').click();page.wait_for_timeout(150)
    assert 'No Korean voice' in page.locator('#toast').inner_text();assert page.locator('.hero .ipa').is_visible()
    passed('missing Korean voice produces actionable feedback while reading practice remains usable (forced missing-voice case)')
    context.close();browser.close()
report={'url':url,'browser':os.environ.get('KOREAN_BROWSER','chromium'),'verifiedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':hashlib.sha256(source).hexdigest(),'passed':checks,'count':len(checks),'pageErrors':errors,'audioTransport':'separately tested with explicit stub; not proof of physical sound','unverified':['physical iPhone Safari audio and microphone','complete native-speaker review','fine phonetic accuracy and intonation']}
(out/'browser-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
