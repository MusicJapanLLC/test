"""Bounded external-API capture benchmark, NOT a deployed job service.
This independent harness records live API evidence for later replay through the
Node reference implementation. Passing here is not Node live-E2E certification.
Only explicit CC-BY/CC0 abstracts are retained; all other bodies are omitted.
"""
import collections, datetime as dt, hashlib, html, json, pathlib, re, sqlite3, sys, time
import urllib.parse, urllib.request, urllib.error
API='https://www.ebi.ac.uk/europepmc/webservices/rest'
TERMS=['validation','failure','external validation','reproducibility','bias','generalizability','dataset','data quality','retraction','calibration','benchmark','prospective','data leakage','sample size','selection bias','uncertainty','prediction','multi-center','replication','measurement','missing data','reporting','performance','clinical utility']
COUNTER={'failure','bias','retraction','data leakage','replication'}
NOW=lambda:dt.datetime.now(dt.timezone.utc).isoformat()
def digest(s):return hashlib.sha256(s.encode()).hexdigest()
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def screen(r):
 right=r.get('isOpenAccess')=='Y' and re.fullmatch(r'(cc by|cc-by|cc0|cc zero)(?:\s+[1-4]\.0)?',r.get('license','').strip().lower())
 text=html.unescape(re.sub('<[^>]*>',' ',r.get('abstractText','')));text=' '.join(text.split()) if right else ''
 reasons=[]
 if not right:reasons.append('license_not_accepted')
 if len(text)<600:reasons.append('no_substantive_excerpt')
 try:
  d=dt.date.fromisoformat(r.get('firstPublicationDate',''));valid=dt.date(2016,1,1)<=d<=dt.date(2026,10,10)
 except (ValueError,TypeError):valid=False
 if not valid:reasons.append('date_invalid_or_outside_scope')
 if not re.search('machine learning|deep learning|artificial intelligence',text+' '+r.get('title',''),re.I) or not re.search('validat|reproduc|performance|replicat|bias|benchmark|calibrat|generaliz|uncertainty|predict',text,re.I):reasons.append('topic_relevance_not_established')
 return not reasons,text,reasons

def new_plan(rows,revision):
 counts={t:sum(t in s['text'].lower() for s in rows) for t in TERMS}
 ordered=sorted(TERMS,key=lambda t:((2 if t in COUNTER else 1)/(1+counts[t])),reverse=True)
 scarce=[t for t in ordered if t not in COUNTER][:2]
 year_counts=collections.Counter(s['record'].get('firstPublicationDate','')[:4] for s in rows)
 years=sorted([str(y) for y in range(2016,2027)],key=lambda y:(year_counts[y],-int(y)))[:3]
 return [{'term':t,'query_term':t if revision==0 or t in COUNTER else t+' '+scarce[(i+revision)%2] if t not in scarce and i%5==revision%5 else t,'priority':round((2 if t in COUNTER else 1)/(1+counts[t]),6),'reason':'observed keyword coverage deficit; heuristic, not estimated probability','revision':revision, 'from':(years[i%len(years)]+'-01-01') if revision else '2016-01-01', 'to':min((years[i%len(years)]+'-12-31'),'2026-10-10') if revision else '2026-10-10'} for i,t in enumerate(ordered)]

def select_query(options,logs,explore):
 def history(q):return [x for x in logs if x.get('kind')=='search' and x.get('key')==q['key']]
 if explore:return min(options,key=lambda q:len(history(q)))
 def score(q):
  h=history(q); accepted=sum(x.get('accepted_count',0) for x in h); returned=sum(x.get('returned_count',0) for x in h)
  return (accepted+5)/(returned+20)*(1+min(1,q['priority']))
 return max(options,key=score)

def coverage(rows):
 def dist(f):return dict(collections.Counter(f(s) or 'unknown' for s in rows))
 return {'documents':len(rows),'language':dist(lambda s:s['record'].get('language')),'publisher_family':dist(lambda s:s['record'].get('journalInfo',{}).get('journal',{}).get('title')),'year':dist(lambda s:s['record'].get('firstPublicationDate','')[:4]),'evidence_tier':dist(lambda s:'review' if any('review' in t.lower() for t in s['record'].get('pubTypeList',{}).get('pubType',[])) else 'original_status_unverified'),'tags':{t:sum(t in s['text'].lower() for s in rows) for t in TERMS},'unanswered':['population/unit/denominator not extracted','study geography unknown; author affiliation is not a substitute','shared source datasets may remain unidentified','counterevidence keyword matches are not verified contradictions','review-to-primary-data agreement not verified','two-hop bibliographic links are not causal explanations'],'primary_data_comparison_verified':0,'human_eligibility_verified':False}

class Capture:
 def __init__(self,mode,out,max_requests=160,max_seconds=420):
  self.mode=mode;self.out=pathlib.Path(out);self.out.mkdir(parents=True,exist_ok=True);self.max_requests=max_requests;self.max_seconds=max_seconds;self.start=time.monotonic();self.used=0;self.rows=[];self.seen=set();self.logs=[];self.gates=[];self.edges=[];self.candidates=[]
  self.db=sqlite3.connect(self.out/'capture.sqlite');self.db.execute('create table if not exists receipts(seq integer primary key,kind text,body text)');self.state='running';self.previous=None
 def save(self,kind,value):
  self.db.execute('insert into receipts(kind,body) values(?,?)',(kind,canonical(value)));self.db.commit()
 def request(self,path,params,wave,kind,term):
  if self.used>=self.max_requests or time.monotonic()-self.start>=self.max_seconds:raise RuntimeError('BUDGET_EXHAUSTED')
  self.used+=1;url=API+path+'?'+urllib.parse.urlencode(params);log={'request_id':f'{self.mode}-{self.used}','wave':wave,'kind':kind,'term':term,'started_at':NOW(),'public_request_url':url,'status':'started','execution_mode':'live_api_capture'};self.save('request_started',log);began=time.monotonic()
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'RESEARCH1500/0.1 (bounded public academic benchmark)'})
   with urllib.request.urlopen(req,timeout=20) as response:
    raw=response.read(8_000_001)
    if len(raw)>8_000_000:raise RuntimeError('RESPONSE_TOO_LARGE')
    data=json.loads(raw);log.update(status='success',http_status=response.status,raw_response_sha256=hashlib.sha256(raw).hexdigest(),returned_count=len(data.get('resultList',{}).get('result',[])),provider_version=data.get('version'))
  except Exception as exc:
   log.update(status='error',error=str(exc)[:300]);raise
  finally:
   log.update(finished_at=NOW(),duration_ms=round((time.monotonic()-began)*1000));self.logs.append(log);self.save('request_finished',log);time.sleep(.6)
  return data,log
 def references(self,wave):
  source=next((s for s in self.rows if s['wave']==wave and s['record'].get('hasReferences')=='Y'),None)
  if not source:return
  pmid=source['record'].get('id','');parent=source['source_id']
  for depth in (1,2):
   if not re.fullmatch('[0-9]+',str(pmid)):return
   try:data,log=self.request('/MED/'+str(pmid)+'/references',{'format':'json','pageSize':25,'page':1},wave,'bibliographic_reference',str(depth))
   except Exception:return
   refs=data.get('referenceList',{}).get('reference',[]);next_ref=None
   for r in refs:
    entry={k:r.get(k) for k in ('id','source','title','authorString','pubYear')};eid=digest(canonical(entry));edge={'source':parent,'target':'epmc:'+str(r.get('source','MED'))+':'+str(r.get('id','')),'depth':depth,'relation':'context_for' if depth==1 else 'context_of_context','evidence':entry,'evidence_sha256':eid,'request_id':log['request_id'],'semantic_relation_verified':False,'content_retrieved':False};self.edges.append(edge);self.save('bibliographic_edge',edge)
    if not next_ref and r.get('source','MED')=='MED' and re.search('learn|model|data|validat|reproduc',r.get('title',''),re.I):next_ref=r
   if not next_ref:return
   parent='epmc:MED:'+str(next_ref.get('id',''));pmid=next_ref.get('id','')
 def run(self):
  plan=new_plan([],0);cursors={};errors=collections.Counter();attempts=collections.Counter();self.save('contract',{'topic':'Machine learning validation, evaluation and reproducibility','target_sources':1500,'mode':self.mode,'max_requests':self.max_requests,'max_seconds':self.max_seconds,'direct_paid_api_budget_usd':0,'time_range':['2016-01-01','2026-10-10'],'accepted_licenses':['CC-BY','CC0'],'independent_harness_not_node_live_e2e':True})
  try:
   for wave in range(1,7):
    wave_logs=[]
    while len(self.rows)<wave*250:
     if self.mode=='single_shot' and self.used: self.state='single_request_finished';return
     options=[dict(q,key=q['query_term']+'|'+q['from']+'|'+q['to']) for q in plan]
     if self.mode!='adaptive':options=[{'query_term':'validation','term':'validation','priority':1,'from':'2016-01-01','to':'2026-10-10','key':'validation|2016-01-01|2026-10-10'}]
     options=[q for q in options if cursors.get(q['key'],'*') is not None and errors[q['key']]<3]
     if not options: self.state='query_portfolio_exhausted';return
     need_counter=self.mode=='adaptive' and not any(x.get('counterevidence_search') and x.get('status')=='success' for x in wave_logs)
     choice=[q for q in options if q['term'] in COUNTER] if need_counter else options
     if not choice:choice=options
     q=select_query(choice,self.logs,len(wave_logs)%5==4);term=q['query_term'];key=q['key'];attempts[(wave,key)]+=1
     expression='("machine learning" OR "deep learning") AND ('+' AND '.join(term.split())+') AND OPEN_ACCESS:Y AND FIRST_PDATE:['+q['from']+' TO '+q['to']+']'
     limit=min(100,wave*250-len(self.rows));params={'query':expression,'format':'json','resultType':'core','pageSize':limit,'cursorMark':cursors.get(key,'*')}
     try:data,log=self.request('/search',params,wave,'search',term)
     except RuntimeError:raise
     except Exception:errors[key]+=1;continue
     records=data.get('resultList',{}).get('result',[]);next_cursor=data.get('nextCursorMark');cursors[key]=next_cursor if records and next_cursor!=params['cursorMark'] else None
     log['key']=key;log['query_window']={'from':q['from'],'to':q['to']};accepted=0
     for r in records:
      good,text,reasons=screen(r);doi=re.sub(r'^https?://(?:dx\.)?doi\.org/','',r.get('doi',''),flags=re.I).strip().lower();sid='doi:'+doi if doi else 'epmc:'+r.get('source','MED')+':'+str(r.get('id',''))
      root=re.search(r'\b(?:NCT\d{8}|ISRCTN\d{8}|GSE\d{4,}|UK Biobank|MIMIC-IV|MIMIC-III|ADNI|TCGA)\b',text,re.I);origin='dataset:'+root[0].lower().replace(' ','_') if root else sid
      keys={sid,'text:'+digest(text),origin};dup=bool(keys&self.seen) if text else False
      projection={k:r.get(k) for k in ('id','pmid','pmcid','doi','source','title','firstPublicationDate','language','isOpenAccess','license','authorString','pubTypeList','hasReferences')};projection['abstractText']=r.get('abstractText','') if text else '';projection['journalInfo']={'journal':{k:r.get('journalInfo',{}).get('journal',{}).get(k) for k in ('title','issn')}}
      s={'source_id':sid,'origin_id':origin,'wave':wave,'record':projection,'text':text,'content_sha256':digest(text) if text else None,'eligible_screen':good,'accepted':good and not dup,'duplicate':dup,'exclusion_reasons':reasons,'request_id':log['request_id'],'observed_at':NOW(),'independence_verified':False,'deep_analyzed':False};self.candidates.append(s);self.save('candidate',s)
      if s['accepted']:self.rows.append(s);self.seen.update(keys);accepted+=1
     log['accepted_count']=accepted;log['counterevidence_search']=q['term'] in COUNTER;wave_logs.append(log);self.save('ingestion',{'request_id':log['request_id'],'accepted':accepted,'cumulative':len(self.rows)});print(canonical({'mode':self.mode,'wave':wave,'accepted':len(self.rows),'requests':self.used}),flush=True)
    if self.mode=='adaptive':self.references(wave)
    gaps=coverage(self.rows);next_plan=new_plan(self.rows,wave) if self.mode=='adaptive' else plan
    gate={'wave':wave,'unique_eligible':len(self.rows),'source_ids':[s['source_id'] for s in self.rows if s['wave']==wave],'source_hashes':{s['source_id']:s['content_sha256'] for s in self.rows if s['wave']==wave},'coverage_and_gaps':gaps,'counterevidence_searches':[x['request_id'] for x in wave_logs if x.get('counterevidence_search')],'previous_checkpoint_hash':self.previous,'next_query_portfolio':next_plan,'replan_reason':'Observed year gaps select three least-covered in-scope years; observed unique-yield penalizes duplicate queries; 20 percent exploration retained. No semantic truth claims.' if self.mode=='adaptive' else 'Fixed-query benchmark control; unchanged deliberately','committed_at':NOW(),'gate_passed':True,'execution_mode':'live_api_capture'}
    gate['checkpoint_hash']=digest(canonical(gate));self.save('gate',gate);self.gates.append(gate);self.previous=gate['checkpoint_hash'];plan=next_plan
   self.state='screened_target_reached'
  except Exception as exc:self.state='partial';self.save('failure',{'error':str(exc)[:400]})
  finally:self.export()
 def export(self):
  for name,rows in [('accepted',self.rows),('candidates',self.candidates),('searches',self.logs),('gates',self.gates),('bibliographic_edges',self.edges)]:
   (self.out/(name+'.jsonl')).write_text(''.join(canonical(x)+'\n' for x in rows),encoding='utf8')
  result={'algorithm_version':'capture-v2-year-yield','mode':self.mode,'status':self.state,'target':1500,'records_observed':len(self.candidates),'distinct_candidate_ids':len({s['source_id'] for s in self.candidates}),'reusable_substantive_unique_screened':len(self.rows),'gates':len(self.gates),'requests':self.used,'elapsed_seconds':round(time.monotonic()-self.start,3),'paid_api_calls':0,'infrastructure_cost_measured':False,'full_text':0,'deep_analyzed':0,'human_relevance_precision':None,'human_refutation_recall':None,'verified_dataset_independence':0,'adaptive_advantage_established':False,'extraction':'licensed abstracts, not full paper reading','bibliographic_edges':len(self.edges),'coverage':coverage(self.rows),'execution_environment':'GitHub Actions' if 'GITHUB_ACTIONS' in __import__('os').environ else 'local','node_reference_pipeline_live_e2e':False}
  (self.out/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');self.db.close();print(json.dumps(result),flush=True)
if __name__=='__main__':
 mode=sys.argv[1] if len(sys.argv)>1 else 'adaptive'
 if mode not in ('adaptive','fixed','single_shot'):raise SystemExit('invalid mode')
 Capture(mode,sys.argv[2] if len(sys.argv)>2 else 'capture-'+mode).run()
