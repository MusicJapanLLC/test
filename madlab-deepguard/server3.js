import express from 'express';
import * as dns from 'node:dns/promises';
import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';
import { scan } from './scanner-fixed.js';
import { ACTIONS, ALLOWED_ACTIONS } from './contracts.js';
import { loadResearchContext } from './research-adapter.js';
import { buildRemediationPlan, executionReceipt } from './action-fabric.js';
import { buildBridgeKit } from './bridge-kit.js';

const app=express();
const PORT=Number(process.env.PORT||10000);
const UA='MADLAB-Action-Fabric/3.0';
const researchRuntime={plans:0,remediation_runs:0,actions_attempted:0,actions_accepted:0,findings_resolved:0,bridge_gaps:new Map(),started_at:new Date().toISOString()};

app.disable('x-powered-by');
app.use(express.json({limit:'48kb'}));
app.use(express.static(new URL('./public',import.meta.url).pathname,{maxAge:0}));

function isPrivateV4(ip){
  const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
  const[a,b,c]=p;
  return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19))||(a===192&&b===0&&c===2)||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113);
}
function isPublicIp(ip){
  const k=isIP(ip);if(k===4)return!isPrivateV4(ip);if(k===6){const x=ip.toLowerCase();return!(x==='::'||x==='::1'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe8')||x.startsWith('fe9')||x.startsWith('fea')||x.startsWith('feb')||x.startsWith('ff')||x.startsWith('2001:db8:'));}return false;
}
async function publicHttps(raw){
  let s=String(raw||'').trim();if(!/^https?:\/\//i.test(s))s='https://'+s;
  let u;try{u=new URL(s);}catch{throw new Error('invalid_url');}
  if(u.protocol!=='https:')throw new Error('https_required_for_actions');
  if(u.username||u.password||u.hash)throw new Error('userinfo_or_fragment_not_allowed');
  if(u.port&&u.port!=='443')throw new Error('https_443_only');
  const host=u.hostname.toLowerCase();if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal'))throw new Error('private_target_blocked');
  if(isIP(host)){if(!isPublicIp(host))throw new Error('private_target_blocked');}
  else{const rows=await dns.lookup(host,{all:true,verbatim:true});if(!rows.length||rows.some(r=>!isPublicIp(r.address)))throw new Error('private_target_blocked');}
  return u;
}
async function readLimited(res,max=65536){
  if(!res.body)return'';const reader=res.body.getReader(),decoder=new TextDecoder();let out='',n=0;
  while(n<max){const r=await reader.read();if(r.done)break;const x=r.value.slice(0,max-n);n+=x.byteLength;out+=decoder.decode(x,{stream:true});if(n>=max){await reader.cancel();break;}}
  out+=decoder.decode();return out;
}
async function noFollow(url,init){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const res=await fetch(url,{...init,redirect:'manual',signal:controller.signal,headers:{'User-Agent':UA,...(init.headers||{})}});if([301,302,303,307,308].includes(res.status))throw new Error('action_redirect_blocked');return{res,text:await readLimited(res)};}
  finally{clearTimeout(timer);}
}
async function discover(raw){
  const target=await publicHttps(raw),manifestUrl=new URL('/.well-known/madlab-action.json',target.origin);
  const{res,text}=await noFollow(manifestUrl.toString(),{method:'GET',headers:{Accept:'application/json'}});
  if(res.status===404)return{available:false,target:target.origin,reason:'manifest_not_found',schema:'',actions:[]};
  if(!res.ok)return{available:false,target:target.origin,reason:`manifest_http_${res.status}`,schema:'',actions:[]};
  let m;try{m=JSON.parse(text);}catch{return{available:false,target:target.origin,reason:'invalid_action_manifest',schema:'',actions:[]};}
  if(!['madlab-safe-action/v1','madlab-safe-action/v2'].includes(m?.schema)||m?.enabled!==true||m?.owner_only!==true||typeof m?.endpoint!=='string')return{available:false,target:target.origin,reason:'invalid_action_manifest_or_owner_lock',schema:String(m?.schema||''),actions:[]};
  let endpoint;try{endpoint=new URL(m.endpoint,target.origin);}catch{return{available:false,target:target.origin,reason:'invalid_action_endpoint',schema:m.schema,actions:[]};}
  if(endpoint.origin!==target.origin||endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash)return{available:false,target:target.origin,reason:'action_endpoint_not_same_origin',schema:m.schema,actions:[]};
  const actions=(Array.isArray(m.actions)?m.actions:[]).flatMap(x=>{if(!x||typeof x!=='object')return[];const id=String(x.id||''),label=String(x.label||ACTIONS[id]?.label||id);if(!ALLOWED_ACTIONS.has(id)||!label||label.length>100)return[];return[{id,label,description:String(x.description||'').slice(0,240),reversible:typeof x.reversible==='boolean'?x.reversible:null}];}).slice(0,40);
  return{available:actions.length>0,target:target.origin,manifest_url:manifestUrl.toString(),endpoint:endpoint.toString(),schema:m.schema,protocol:String(m.protocol||''),actions,reason:actions.length?'':'no_supported_actions'};
}
async function executeAction(channel,actionId,approvalCode,{findingIds=[]}={}){
  if(!channel.available||!channel.endpoint)throw new Error('action_channel_unavailable');
  if(!ALLOWED_ACTIONS.has(actionId))throw new Error('action_not_allowed');
  if(!/^[A-Za-z0-9._~\-]{6,160}$/.test(String(approvalCode||'')))throw new Error('invalid_approval_code_format');
  if(!channel.actions.some(x=>x.id===actionId))throw new Error('action_not_advertised');
  const started=Date.now(),requestId=randomUUID();
  const body=channel.schema==='madlab-safe-action/v2'
    ?{schema:'madlab-safe-action-request/v2',mode:'apply',action_id:actionId,target_origin:channel.target,approval_code:approvalCode,request_id:requestId,finding_ids:findingIds.slice(0,20),requested_by:'MADLAB DeepGuard v3',requested_at:new Date().toISOString()}
    :{schema:'madlab-safe-action-request/v1',action_id:actionId,target_origin:channel.target,approval_code:approvalCode,requested_by:'MADLAB DeepGuard v3',requested_at:new Date().toISOString()};
  const{res,text}=await noFollow(channel.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});
  let payload={};try{payload=JSON.parse(text);}catch{payload={message:text.slice(0,500)};}
  return{request_id:requestId,action_id:actionId,label:ACTIONS[actionId]?.label||actionId,accepted:res.ok&&payload.accepted!==false,http_status:res.status,duration_ms:Date.now()-started,message:String(payload.message||payload.status||(res.ok?'action accepted':'action rejected')).slice(0,500),evidence:String(payload.evidence||`HTTP ${res.status}`).slice(0,1200),reversible:typeof payload.reversible==='boolean'?payload.reversible:null};
}
function findingResults(before,after,cap,executions){
  const afterIds=new Set((after?.findings||[]).map(x=>x.id));
  return(before.findings||[]).map(f=>{
    const candidates=Array.isArray(f.action_candidates)?f.action_candidates:[],selected=candidates.find(x=>cap.has(x))||candidates[0]||null,connected=Boolean(selected&&cap.has(selected)),execution=selected?executions.find(x=>x.action_id===selected):null,resolved=Boolean(after&&execution?.accepted&&!afterIds.has(f.id)),status=resolved?'resolved':execution?.accepted?'changed_but_still_present':connected?'ready':selected?'actuator_missing':'diagnosis_only';
    return{...f,selected_action:selected,connected,execution,resolved,status};
  });
}
function recordPlan(plan){
  researchRuntime.plans++;
  for(const gap of plan.bridge_gap||[]){researchRuntime.bridge_gaps.set(gap.action_id,(researchRuntime.bridge_gaps.get(gap.action_id)||0)+Number(gap.count||1));}
}
function recordRun(receipt){
  researchRuntime.remediation_runs++;researchRuntime.actions_attempted+=Number(receipt.actions_attempted||0);researchRuntime.actions_accepted+=Number(receipt.actions_accepted||0);researchRuntime.findings_resolved+=Number(receipt.findings_resolved||0);
}
async function makePlan(url){
  const before=await scan(url);
  let channel;try{channel=await discover(before.target);}catch(e){channel={available:false,target:before.target,reason:e instanceof Error?e.message:'action_discovery_failed',schema:'',actions:[]};}
  let research;try{research=await loadResearchContext();}catch{research={authority:'none',planner_bias:{},source_health:{},security_reactor:{},senju:{},limitations:['Research feed unavailable; deterministic local plan used.']};}
  const plan=buildRemediationPlan(before,channel,research);recordPlan(plan);
  return{before,channel,research,plan};
}

app.get('/api/health',(req,res)=>res.json({ok:true,version:'madlab-deepguard-v3.0',action_fabric:true,research_adapter:true,owner_bridge:['v1','v2']}));
app.get('/api/research/context',async(req,res)=>{try{return res.json(await loadResearchContext());}catch(e){return res.status(503).json({error:e instanceof Error?e.message:'research_context_unavailable'});}});
app.get('/api/research/handoff',(req,res)=>res.json({schema:'madlab-research-handoff/v1',authority:'priority_only',permission_surface_unchanged:true,external_scope_unchanged:true,verification_claimed:false,started_at:researchRuntime.started_at,plans:researchRuntime.plans,remediation_runs:researchRuntime.remediation_runs,actions_attempted:researchRuntime.actions_attempted,actions_accepted:researchRuntime.actions_accepted,findings_resolved:researchRuntime.findings_resolved,top_bridge_gaps:[...researchRuntime.bridge_gaps.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([action_id,count])=>({action_id,count})),note:'Aggregate runtime learning only; no target URLs, approval codes, credentials or request payloads are exposed.'}));
app.post('/api/scan',async(req,res)=>{if(req.body?.authorized!==true)return res.status(400).json({error:'authorization_confirmation_required'});try{return res.json(await scan(req.body?.url));}catch(e){return res.status(400).json({error:e instanceof Error?e.message:'scan_failed'});}});
app.post('/api/action/discover',async(req,res)=>{if(req.body?.owned!==true)return res.status(400).json({error:'owned_target_confirmation_required'});try{return res.json(await discover(req.body?.url));}catch(e){return res.status(400).json({error:e instanceof Error?e.message:'action_discovery_failed'});}});
app.post('/api/remediation/plan',async(req,res)=>{if(req.body?.authorized!==true)return res.status(400).json({error:'authorization_confirmation_required'});try{const x=await makePlan(req.body?.url);return res.json({schema:'madlab-remediation-planning-run/v3',before:x.before,channel:{available:x.channel.available,reason:x.channel.reason||'',schema:x.channel.schema||'',advertised_actions:(x.channel.actions||[]).map(a=>a.id)},research:x.research,plan:x.plan,bridge_kit:x.channel.available?null:buildBridgeKit(x.plan)});}catch(e){return res.status(400).json({error:e instanceof Error?e.message:'remediation_plan_failed'});}});
app.post('/api/action/bridge-kit',async(req,res)=>{if(req.body?.owned!==true)return res.status(400).json({error:'owned_target_confirmation_required'});try{const x=await makePlan(req.body?.url);return res.json(buildBridgeKit(x.plan));}catch(e){return res.status(400).json({error:e instanceof Error?e.message:'bridge_kit_failed'});}});
app.post('/api/action/execute',async(req,res)=>{if(req.body?.owned!==true)return res.status(400).json({error:'owned_target_confirmation_required'});try{const channel=await discover(req.body?.url);return res.json(await executeAction(channel,String(req.body?.action_id||''),String(req.body?.approval_code||''),{findingIds:Array.isArray(req.body?.finding_ids)?req.body.finding_ids:[]}));}catch(e){return res.status(400).json({error:e instanceof Error?e.message:'action_execute_failed'});}});
app.post('/api/diagnose-and-remediate',async(req,res)=>{
  if(req.body?.authorized!==true)return res.status(400).json({error:'authorization_confirmation_required'});
  const code=String(req.body?.approval_code||'');if(!code)return res.status(400).json({error:'approval_code_required'});
  try{
    const x=await makePlan(req.body?.url),before=x.before,channel=x.channel,plan=x.plan,cap=new Set((channel.actions||[]).map(a=>a.id)),executions=[];
    for(const id of plan.execution_batch||[]){
      const findingIds=(plan.findings||[]).filter(f=>f.selected_action===id&&f.connected).map(f=>f.finding_id);
      try{const r=await executeAction(channel,id,code,{findingIds});executions.push(r);if(!r.accepted&&[401,403].includes(r.http_status))break;}
      catch(e){const message=e instanceof Error?e.message:'execution_failed';executions.push({action_id:id,label:ACTIONS[id]?.label||id,accepted:false,http_status:0,duration_ms:0,message,evidence:'',reversible:null});if(/approval|owner|code/i.test(message))break;}
    }
    let after=null;try{after=await scan(before.target);}catch{}
    const findings=findingResults(before,after,cap,executions),receipt=executionReceipt({plan,before,after,executions});recordRun(receipt);
    return res.json({schema:'madlab-remediation-run/v3',target:before.target,before,after,channel:{available:channel.available,reason:channel.reason||'',schema:channel.schema||'',advertised_actions:[...cap]},research:x.research,plan,bridge_kit:channel.available?null:buildBridgeKit(plan),executions,receipt,findings,summary:{findings:findings.length,with_action_contract:findings.filter(x=>x.selected_action).length,connected:findings.filter(x=>x.connected).length,actions_attempted:executions.length,actions_accepted:executions.filter(x=>x.accepted).length,resolved:findings.filter(x=>x.resolved).length,still_present:findings.filter(x=>x.status==='changed_but_still_present').length,actuator_missing:findings.filter(x=>x.status==='actuator_missing').length,bridge_install_required:plan.counts.bridge_install_required,provider_adapter_required:plan.counts.provider_adapter_required}});
  }catch(e){return res.status(400).json({error:e instanceof Error?e.message:'remediation_run_failed'});}
});
app.get('*',(req,res)=>res.sendFile(new URL('./public/index.html',import.meta.url).pathname));
app.listen(PORT,'0.0.0.0',()=>console.log(`MADLAB DeepGuard v3 Action Fabric listening on ${PORT}`));
