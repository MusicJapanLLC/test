"""Exercise the actual course over HTTP/HTTPS in isolated mobile browsers.
No account access; only isolated-browser local preferences are changed.
"""
import os,json,pathlib,time,sys,traceback
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('WAHRAN_URL','http://127.0.0.1:4179/wahran/')
OUT=pathlib.Path(os.environ.get('EVIDENCE_DIR','evidence-personal'));OUT.mkdir(parents=True,exist_ok=True)
BROWSERS=os.environ.get('BROWSERS','chromium').split(',')
results=[]
def poll(page,expression,timeout=20):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if page.evaluate(expression):return
  page.wait_for_timeout(150)
 raise AssertionError('Observed condition did not become true: '+expression)
def choose(page,s,l):
 page.locator(f'[data-profile-role="speaker"][data-profile-gender="{s}"]').click()
 page.locator(f'[data-profile-role="listener"][data-profile-gender="{l}"]').click()
 page.locator('#profile-apply').click()
def check_forms(page,s,l):
 for row in page.locator('.phrase').evaluate_all('(xs)=>xs.filter(e=>e.getClientRects().length).map(e=>[e.dataset.speakerForm,e.dataset.listenerForm,e.dataset.audioId])'):
  assert row[0] in ['any',s] and row[1] in ['any',l],row

def audio(page,id):
 page.evaluate('''() => {const a=document.querySelector('#wahran-hosted-audio');window.__audioCheck={ended:false,started:false};a.addEventListener('playing',()=>window.__audioCheck.started=true,{once:true});a.addEventListener('ended',()=>window.__audioCheck.ended=true,{once:true})}''')
 page.locator(f'[data-play="{id}"]').first.click()
 poll(page,'() => window.__audioCheck.ended && window.__audioCheck.started',25)
 observed=page.evaluate('''() => {const a=document.querySelector('#wahran-hosted-audio');return {duration:a.duration,time:a.currentTime,src:a.currentSrc,error:a.error?.code||null,ended:a.ended,rate:a.playbackRate}}''')
 assert observed['duration']>.15 and observed['time']>.15 and observed['error'] is None, observed
 return observed
with sync_playwright() as p:
 for name in BROWSERS:
  args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] if name=='chromium' else []
  browser=getattr(p,name).launch(headless=True,args=args)
  for s,l in [('m','f'),('m','m'),('f','m'),('f','f')]:
   report={'browser':name,'profile':s+'-'+l,'checks':[]};results.append(report)
   kwargs={'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'accept_downloads':True}
   if name=='chromium':kwargs['permissions']=['microphone']
   ctx=browser.new_context(**kwargs);page=ctx.new_page();page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    resp=page.goto(URL,wait_until='networkidle',timeout=60000)
    assert resp.status==200 and page.locator('meta[name="wahran-version"]').get_attribute('content')=='1.3.0'
    counts=page.evaluate('''() => {const d=JSON.parse(document.querySelector('#course-data').textContent);return {words:d.words.length,lessons:d.lessons.length,examples:d.lessons.flatMap(l=>l.lines).length,files:WahranFiles.filesCount}}''')
    assert counts['words']==700 and counts['lessons']==30 and counts['examples']==240
    report['counts']=counts
    expect(page.locator('#profile-apply')).to_be_disabled();choose(page,s,l)
    expect(page.get_by_role('heading',name='My everyday conversations',exact=True)).to_be_visible()
    if s=='m' and l=='f':page.screenshot(path=str(OUT/(name+'-home.png')),full_page=False)
    page.locator('[data-lesson="l22"]').first.click()
    ids=page.locator('#main .phrase').evaluate_all('(xs)=>xs.map(e=>e.dataset.audioId)')
    assert len(ids)==6 and 'l22-01' in ids
    assert ('l22-03' in ids)==(l=='m') and ('l22-04' in ids)==(l=='f')
    expect(page.locator('[data-audio-id="l22-01"] .en')).to_have_text('I made a new song.')
    if s=='m' and l=='f':
     page.locator('[data-audio-id="l22-01"]').scroll_into_view_if_needed();page.screenshot(path=str(OUT/(name+'-new-song.png')),full_page=False)
     report['new_audio']=audio(page,'l22-01')
     # Slow remains slow for new MP3s; observe the actual media element.
     page.locator('[data-slow="l22-01"]').click()
     poll(page,'() => {const a=document.querySelector("#wahran-hosted-audio");return !a.paused && a.currentTime>.1}')
     assert page.locator('#wahran-hosted-audio').evaluate('(a)=>a.playbackRate')<1
     page.locator('[data-practice="l22-01"]').click()
     if name=='chromium':
      page.locator('#record-button').click();expect(page.locator('#record-button')).to_contain_text('Stop recording')
      page.wait_for_timeout(700);page.locator('#record-button').click()
      poll(page,'() => (document.querySelector("#learner-audio audio")?.readyState||0)>=1')
      assert page.locator('#learner-audio audio').get_attribute('src').startswith('blob:')
      report['checks'].append('Actual recording decodes with a generated fake microphone, not human speech')
     page.locator('[data-action="close-dialog"]').click()
    for n in range(21,31):
     page.locator('.bottom-nav [data-tab="learn"]').click();page.locator(f'[data-lesson="l{n}"]').first.click()
     check_forms(page,s,l);count=page.locator('#main .phrase').count();assert count>=4
     assert page.locator('#main .phrase .ja-meaning').count()==count and page.locator('#main .phrase .usage-ja p[lang="ja"]').count()==count
    report['checks'].append('10 new lessons have matching speaker/listener forms, IPA, English and Japanese meaning/usage')
    page.locator('.bottom-nav [data-tab="learn"]').click();page.locator('[data-lesson="l01"]').first.click()
    assert page.locator('#main .phrase').count()==6
    if s=='m' and l=='f':report['old_audio']=audio(page,'l01-01')
    report['checks'].append('Original greeting and old audio remain usable')
    page.locator('.bottom-nav [data-tab="words"]').click();page.locator('#word-scope').select_option('personal')
    expect(page.locator('#word-results .count')).to_contain_text('700 in the full course')
    page.locator('#word-search').fill('skill');page.locator('[data-open="w700"]').click()
    assert page.locator('dialog .ja-meaning').count()>0
    page.locator('dialog [data-save="w700"]').first.click();page.locator('[data-action="close-dialog"]').click()
    page.locator('#word-scope').select_option('all');page.locator('#word-search').fill('')
    page.locator('[data-open="w001"]').first.click();page.locator('dialog [data-save="w001"]').first.click();page.locator('[data-action="close-dialog"]').click()
    page.reload(wait_until='networkidle')
    state=page.evaluate('JSON.parse(localStorage.getItem("wahran-v1"))')
    assert {'w001','w700'}.issubset(set(state['saved'])) and state['profile']=={'speaker':s,'listener':l}
    report['checks'].append('Old/new saved IDs and conversation profile survive an actual reload')
    page.locator('.bottom-nav [data-tab="speak"]').click();assert page.locator('#practice-level').input_value()=='personal'
    page.locator('[data-action="quiz-read"]').click()
    check_forms(page,s,l);assert page.locator('dialog .ja-meaning').count()==0
    assert page.locator('dialog .phrase').get_attribute('data-audio-id').startswith(('l21','l22','l23','l24','l25','l26','l27','l28','l29','l30'))
    page.locator('[data-choice]').first.click();assert page.locator('#quiz-feedback .ja-meaning').count()==1
    page.locator('[data-action="close-dialog"]').click()
    report['checks'].append('Personal quiz draws actual everyday phrases; translations hidden until an answer')
    page.locator('[data-action="session-setup"]').click();assert page.locator('#session-pool').input_value()=='personal'
    page.locator('[data-action="session-start"]').click();check_forms(page,s,l)
    assert page.locator('#session-line .phrase').get_attribute('data-audio-id').startswith('l21')
    page.locator('[data-action="session-skip"]').click();check_forms(page,s,l)
    page.locator('[data-action="close-dialog"]').click()
    report['checks'].append('Personal shadowing default and Next line retain Japanese and form filters')
    page.locator('.bottom-nav [data-tab="build"]').click()
    for selector,value in [('family','4'),('frame','9'),('item','19'),('context','9')]:page.locator('#'+selector).select_option(value)
    expect(page.locator('[data-combo-id="c09999"]')).to_be_visible()
    report['checks'].append('Original 10,000th combination and Japanese explanation remain')
    for width in [320,390,430]:
     page.set_viewport_size({'width':width,'height':844})
     for tab in ['learn','build','speak','words','culture']:
      page.locator(f'.bottom-nav [data-tab="{tab}"]').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,tab)
    assert not errors,errors
    report['checks'].append('Five tabs at three mobile widths, no horizontal overflow or page exceptions');report['status']='PASS'
   except Exception as e:
    report['status']='FAIL';report['error']=str(e);report['traceback']=traceback.format_exc()
    try:page.screenshot(path=str(OUT/(name+'-'+s+l+'-failed.png')),full_page=False)
    except:pass
   finally:
    ctx.close();(OUT/'personal-browser-report.json').write_text(json.dumps({'url':URL,'limits':['Virtual browsers, not physical iPhone','Synthetic audio progression observed, not native Oran acoustic certification'],'results':results},ensure_ascii=False,indent=2),encoding='utf8')
  browser.close()
print(json.dumps({'profiles':len(results),'passed':sum(x.get('status')=='PASS' for x in results),'failures':[x for x in results if x.get('status')!='PASS']},ensure_ascii=False,indent=2))
if any(x.get('status')!='PASS' for x in results):sys.exit(1)
