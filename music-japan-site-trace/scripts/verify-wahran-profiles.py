"""Local visual checks use an explicit memory storage adapter; CI uses real HTTP storage/media."""
import os,json,pathlib,sys,re
from playwright.sync_api import sync_playwright,expect
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('EVIDENCE_DIR',str(ROOT/'docs/browser')));OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('WAHRAN_URL');HTML=pathlib.Path(os.environ.get('WAHRAN_HTML',str(ROOT.parent/'preview/local-test.html')))
BROWSERS=os.environ.get('BROWSERS','chromium').split(',')
all_results=[];failures=[]
def within_profile(page,s,l):
 for row in page.locator('[data-speaker-form]').evaluate_all('(els)=>els.filter(e=>e.getClientRects().length).map(e=>({speaker:e.dataset.speakerForm,listener:e.dataset.listenerForm,id:e.dataset.audioId}))'):
  assert row['speaker'] in ['any',s],row
  assert row['listener'] in ['any',l],row

def choose(page,s,l):
 page.locator(f'[data-profile-role="speaker"][data-profile-gender="{s}"]').click()
 page.locator(f'[data-profile-role="listener"][data-profile-gender="{l}"]').click()
 page.locator('#profile-apply').click()
 expect(page.locator('#conversation-bar')).to_contain_text(('Man' if s=='m' else 'Woman')+' → '+('Man' if l=='m' else 'Woman'))

def load(page):
 if URL:
  r=page.goto(URL,wait_until='networkidle',timeout=60000);assert r and r.status==200
 else:
  page.evaluate("window.__testStorage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__testStorage[k]??null,setItem:(k,v)=>window.__testStorage[k]=String(v),removeItem:k=>delete window.__testStorage[k]}})")
  page.set_content(HTML.read_text())

with sync_playwright() as p:
 for name in BROWSERS:
  launch={'headless':True}
  if not URL:launch.update(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  b=getattr(p,name).launch(**launch)
  for s,l in [('m','f'),('m','m'),('f','m'),('f','f')]:
   r={'browser':name,'profile':s+'-'+l,'checks':[]};all_results.append(r)
   ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
   page=ctx.new_page();page.set_default_timeout(8000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   # Observe the actual native Audio objects. Do not replace playback with a fake.
   if URL:ctx.add_init_script("window.__media=[];const NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);window.__media.push(a);return a};window.Audio.prototype=NativeAudio.prototype;")
   try:
    load(page)
    expect(page.locator('#profile-apply')).to_be_disabled()
    page.locator(f'[data-profile-role="speaker"][data-profile-gender="{s}"]').click()
    expect(page.locator('#profile-apply')).to_be_disabled()
    if s=='m' and l=='f':page.screenshot(path=str(OUT/f'{name}-choose.png'))
    choose(page,s,l);r['checks'].append('Two independent choices required; English controls and portrait illustrations')
    page.get_by_role('button',name='Start speaking',exact=False).click()
    ids=page.locator('.phrase').evaluate_all('(els)=>els.map(e=>e.dataset.audioId)')
    assert len(ids)==6,ids
    assert ('l01-03' in ids)==(l=='m') and ('l01-04' in ids)==(l=='f')
    assert ('l01-05' in ids)==(s=='m') and ('l01-06' in ids)==(s=='f')
    assert 'l01-01' in ids and 'l01-02' in ids
    within_profile(page,s,l)
    assert page.locator('.phrase .ja-meaning').count()==6
    assert page.locator('.phrase .usage-ja p[lang="ja"]').count()==6
    page.locator('.phrase').first.scroll_into_view_if_needed()
    if s=='m' and l=='f':page.screenshot(path=str(OUT/f'{name}-first-phrase.png'))
    r['checks'].append('Correct greeting/response gender; 6 matching lines; Japanese meanings and usage for every line')
    if URL and s=='m' and l=='f':
     page.locator('[data-play="l01-01"]').first.click()
     # Poll via the browser protocol; wait_for_function injects eval blocked by the app's CSP.
     for attempt in range(100):
      if page.evaluate('() => window.__media.some(a=>a.ended && a.duration>0.2 && !a.error)'):break
      page.wait_for_timeout(200)
     else:raise AssertionError('Included audio did not reach an ended state within 20 seconds')
     r['audio']=page.evaluate('window.__media.filter(a=>a.duration>0).map(a=>({duration:a.duration,time:a.currentTime,ended:a.ended,error:a.error?.code||null,rate:a.playbackRate,src:a.src}))')
     assert r['audio'];r['checks'].append('Included audio reached ended state with actual duration/time; no voice installation')
    for n in range(1,21):
     page.locator('.bottom-nav [data-tab="learn"]').click()
     page.locator(f'[data-lesson="l{n:02}"]').first.click();within_profile(page,s,l)
     count=page.locator('.phrase').count();assert count>0
     assert page.locator('.phrase .ja-meaning').count()==count
     assert page.locator('.phrase .usage-ja p[lang="ja"]').count()==count
    r['checks'].append('All 20 lessons contain only matching forms, all with Japanese meaning and explanation')
    page.locator('.bottom-nav [data-tab="learn"]').click();page.locator('[data-lesson="l05"]').first.click()
    assert page.locator('[data-audio-id="l05-01"]').count()==1 and page.locator('[data-audio-id="l05-02"]').count()==1
    r['checks'].append('Third-party male/female friends are not incorrectly removed')
    page.locator('.bottom-nav [data-tab="words"]').click();page.locator('#word-search').fill('水');assert page.locator('.word-row').count()>0
    page.locator('#word-search').fill('');page.locator('#word-topic').select_option('food');assert page.locator('.word-row').count()==25
    page.locator('[data-open="w201"]').click();assert page.locator('dialog .usage-ja p[lang="ja"]').count()>0;page.locator('[data-action="close-dialog"]').click()
    page.locator('#word-topic').select_option('all');page.locator('[data-open="w001"]').click();page.locator('dialog [data-save="w001"]').first.click();page.locator('[data-action="close-dialog"]').click()
    page.locator('#word-scope').select_option('saved');assert page.locator('.word-row').count()==1
    if URL:
     page.reload(wait_until='networkidle');assert not page.locator('#profile-apply').count()
     assert page.evaluate('JSON.parse(localStorage.getItem("wahran-v1")).saved.includes("w001")')
     assert page.evaluate('JSON.parse(localStorage.getItem("wahran-v1")).profile')=={'speaker':s,'listener':l}
    r['checks'].append('Japanese word search, 25-item topic filter and saved word; '+('actual reload persistence' if URL else 'explicit memory adapter only'))
    page.locator('.bottom-nav [data-tab="build"]').click()
    frame_values=page.locator('#frame option').evaluate_all('(els)=>els.map(e=>e.value)')
    assert ('7' in frame_values)==(l=='m');assert ('8' in frame_values)==(l=='f')
    for sel,val in [('family','4'),('frame','9'),('item','19'),('context','9')]:page.locator('#'+sel).select_option(val)
    expect(page.locator('[data-combo-id="c09999"]')).to_be_visible()
    assert page.locator('#main .phrase .ja-meaning').inner_text();assert page.locator('#main .phrase .usage-ja').inner_text()
    page.locator('[data-action="chunk-current"]').click()
    for i in range(3):page.locator(f'[data-pick="{i}"]').click()
    page.locator('[data-action="check-chunks"]').click();expect(page.locator('#chunk-feedback')).to_contain_text('You built it')
    assert page.locator('#chunk-feedback .ja-meaning').count()==1
    page.locator('[data-action="close-dialog"]').click();r['checks'].append('Filtered frame choices retain original IDs; combination 10000 and chunk-answer feedback work')
    page.locator('.bottom-nav [data-tab="speak"]').click();page.locator('[data-action="quiz-read"]').click()
    assert page.locator('dialog .ja-meaning').count()==0 and page.locator('dialog .usage-ja').count()==0
    within_profile(page,s,l);page.locator('[data-choice]').first.click()
    assert page.locator('#quiz-feedback .ja-meaning').count()==1 and page.locator('#quiz-feedback .usage-ja').count()==1
    page.locator('[data-action="quiz-next"]').click();within_profile(page,s,l);assert page.locator('dialog .ja-meaning').count()==0
    page.locator('[data-action="close-dialog"]').click();r['checks'].append('Quiz translations/usage hidden before answering, shown in feedback')
    for sn in range(8):
     page.locator(f'[data-scene="{sn}"]').click()
     for _ in range(4):
      if not page.locator('[data-action="scene-model"]').count():break
      page.locator('[data-action="scene-model"]').click();within_profile(page,s,l);assert page.locator('#scene-model .ja-meaning').count()==1
      page.locator('[data-action="scene-next"]').click()
     within_profile(page,s,l);page.locator('[data-action="close-dialog"]').first.click()
    r['checks'].append('Eight guided scenes choose only matching existing model replies')
    page.locator('[data-action="session-setup"]').click();page.locator('#session-pool').select_option('l01');page.locator('#session-minutes').select_option('5');page.locator('[data-action="session-start"]').click()
    for _ in range(6):
     within_profile(page,s,l);assert page.locator('#session-line .ja-meaning').count()==1
     page.locator('[data-action="session-skip"]').click()
    page.locator('[data-action="close-dialog"]').click();r['checks'].append('Shadowing/Next line stays in matching pool and displays Japanese')
    for width in [320,375,390,430]:
     page.set_viewport_size({'width':width,'height':844})
     for tab in ['learn','words','build','speak','culture']:
      page.locator(f'.bottom-nav [data-tab="{tab}"]').click()
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow:{width}:{tab}'
      within_profile(page,s,l)
    assert page.locator('.culture-card').count()==14
    assert page.locator('.culture-card .translation-panel p[lang="ja"]').count()==14
    r['checks'].append('5 tabs at 4 phone widths; 14 culture explanations in Japanese')
    page.locator('[data-action="conversation-profile"]').click();choose(page,'f' if s=='m' else 'm','f' if l=='m' else 'm')
    assert page.evaluate('JSON.parse(localStorage.getItem("wahran-v1")).saved.includes("w001")')
    r['checks'].append('Switching conversation preserves saved words')
    assert not errors,errors;r['status']='PASS'
   except Exception as e:
    r['status']='FAIL';r['error']=str(e);failures.append(r)
    try:page.screenshot(path=str(OUT/f'{name}-{s}-{l}-failed.png'),full_page=False)
    except:pass
   finally:
    ctx.close();OUT.joinpath('report.json').write_text(json.dumps({'mode':'live HTTP' if URL else 'local renderer, memory adapter','results':all_results},ensure_ascii=False,indent=2))
  b.close()
print(json.dumps({'profiles':len(all_results),'passed':sum(r.get('status')=='PASS' for r in all_results),'failures':failures},ensure_ascii=False,indent=2))
if failures:sys.exit(1)
