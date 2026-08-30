const DEFAULT_REPO='MusicJapanLLC/test';
const DEFAULT_BRANCH='claude/employee-onboarding-setup-udm86';
const CACHE_MS=Number(process.env.MADLAB_RESEARCH_CACHE_MS||60000);
const TIMEOUT_MS=Number(process.env.MADLAB_RESEARCH_TIMEOUT_MS||2500);
let cache={at:0,value:null};

const SAFE_MODES=new Set(['NORMAL','VERIFY_NEXT_MISSING_EVIDENCE','REFRAME_AND_COUNTEREVIDENCE','INDEPENDENT_RETEST','SWITCH_EVIDENCE_PATH']);
const SAFE_FOCUS=new Set(['robustness','learning','balance','efficiency']);

function cleanString(v,max=120){return typeof v==='string'?v.slice(0,max):'';}
function cleanInt(v,min=0,max=100000){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):0;}
function cleanRatio(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}

export function sanitizeResearchContext({reactor={},accelerator={},senju={}}={}){
  const nextMode=SAFE_MODES.has(String(reactor.next_mode||''))?String(reactor.next_mode):'NORMAL';
  const primary=accelerator.primary&&typeof accelerator.primary==='object'?accelerator.primary:{};
  const north=accelerator.north_star&&typeof accelerator.north_star==='object'?accelerator.north_star:{};
  const senjuFocus=SAFE_FOCUS.has(String(senju.focus||senju.selected_focus||primary.senju_focus||''))
    ?String(senju.focus||senju.selected_focus||primary.senju_focus)
    :'balance';
  const preferredTrack=cleanString(reactor.next_track||primary.id,40);
  const gaps=(Array.isArray(accelerator.all_tracks)?accelerator.all_tracks:[])
    .filter(x=>x&&typeof x==='object'&&x.status!=='VERIFIED')
    .map(x=>({
      id:cleanString(x.id,40),
      status:cleanString(x.status,32),
      evidence_ratio:cleanRatio(x.evidence_ratio),
      whitehat_candidates:cleanInt(x.whitehat_candidates,0,1000)
    }))
    .filter(x=>x.id)
    .sort((a,b)=>(a.evidence_ratio-b.evidence_ratio)||(b.whitehat_candidates-a.whitehat_candidates))
    .slice(0,5);

  return {
    schema:'madlab-research-context/v1',
    authority:'priority_only',
    permission_surface_unchanged:true,
    external_scope_unchanged:true,
    promotion_gate_unchanged:true,
    verification_authority_unchanged:true,
    security_reactor:{
      sessions_completed:cleanInt(reactor.sessions_completed||reactor.sessions,0,100000),
      rounds_completed:cleanInt(reactor.rounds_completed||reactor.rounds,0,100000),
      next_track:preferredTrack,
      next_mode:nextMode,
      material_rounds:cleanInt(reactor.material_rounds,0,100000),
      strategy_rotations:cleanInt(reactor.strategy_rotations,0,100000)
    },
    portfolio:{
      primary_track:cleanString(primary.id,40),
      primary_status:cleanString(primary.status,32),
      evidence_ratio:cleanRatio(primary.evidence_ratio),
      verified:cleanInt(north.tracks_verified,0,1000),
      total:cleanInt(north.tracks_total,0,1000),
      unfinished:cleanInt(north.unfinished_tracks,0,1000),
      evidence_gaps:gaps
    },
    senju:{focus:senjuFocus},
    planner_bias:{
      favor_retest:nextMode==='INDEPENDENT_RETEST'||senjuFocus==='robustness',
      favor_connected_actions:senjuFocus==='efficiency'||nextMode==='SWITCH_EVIDENCE_PATH',
      favor_counterevidence:nextMode==='REFRAME_AND_COUNTEREVIDENCE'||senjuFocus==='learning',
      favor_low_risk:senjuFocus!=='efficiency'
    },
    limitations:[
      'R&D/Senju context may change prioritization only.',
      'It cannot authorize a target, add permissions, widen external scope, change pass/fail rules, or claim VERIFIED.',
      'All actual mutations still require an owner-advertised same-origin action contract and approval code.'
    ]
  };
}

async function fetchJson(url,fetchImpl){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const res=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'MADLAB-Research-Adapter/3.0'},signal:controller.signal,redirect:'error'});
    if(!res.ok)throw new Error(`HTTP_${res.status}`);
    const body=await res.json();
    return body&&typeof body==='object'?body:{};
  }finally{clearTimeout(timer);}
}

export async function loadResearchContext(fetchImpl=fetch){
  const now=Date.now();
  if(cache.value&&now-cache.at<CACHE_MS)return cache.value;
  const repo=process.env.MADLAB_RESEARCH_REPO||DEFAULT_REPO;
  const branch=process.env.MADLAB_RESEARCH_BRANCH||DEFAULT_BRANCH;
  const base=`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}`;
  const sources={
    reactor:`${base}/standment-security/state/security-reactor.json`,
    accelerator:`${base}/standment-security/state/portfolio-accelerator.json`,
    senju:`${base}/senju/state/last-evolution-summary.json`
  };
  const settled=await Promise.allSettled([
    fetchJson(sources.reactor,fetchImpl),
    fetchJson(sources.accelerator,fetchImpl),
    fetchJson(sources.senju,fetchImpl)
  ]);
  const raw={
    reactor:settled[0].status==='fulfilled'?settled[0].value:{},
    accelerator:settled[1].status==='fulfilled'?settled[1].value:{},
    senju:settled[2].status==='fulfilled'?settled[2].value:{}
  };
  const value={
    ...sanitizeResearchContext(raw),
    source_health:{
      security_reactor:settled[0].status==='fulfilled',
      portfolio_accelerator:settled[1].status==='fulfilled',
      senju:settled[2].status==='fulfilled'
    },
    fetched_at:new Date().toISOString()
  };
  cache={at:now,value};
  return value;
}
