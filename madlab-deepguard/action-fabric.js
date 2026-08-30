const SEVERITY={critical:100,high:72,medium:44,low:20,info:8};
const CONFIDENCE={high:18,medium:10,low:4};

export const ACTION_CLASS={
  provider:new Set(['dns_mail_profile','dns_tls_profile','tls_certificate_renew','tls_minimum_profile','cache_refresh']),
  browser:new Set(['hsts_profile','security_headers_profile','csp_report_only_profile','csp_enforce_profile','frame_ancestors_profile','nosniff_enable','referrer_policy_profile','permissions_policy_profile','cookie_security_profile','cors_allowlist_profile','mixed_content_rewrite','cache_control_private_profile','auth_form_hardening','sri_profile']),
  app:new Set(['strip_server_banner','method_allowlist_profile','source_map_disable','dependency_upgrade_profile','security_txt_refresh','robots_txt_refresh','sitemap_refresh','enforce_https']),
};

function classOf(id){
  if(ACTION_CLASS.provider.has(id))return'provider';
  if(ACTION_CLASS.browser.has(id))return'browser';
  if(ACTION_CLASS.app.has(id))return'app';
  return'generic';
}
function safeArr(v){return Array.isArray(v)?v:[];}
function scoreFinding(f,connected,research){
  let score=(SEVERITY[String(f.severity||'').toLowerCase()]||10)+(CONFIDENCE[String(f.confidence||'').toLowerCase()]||0);
  if(connected)score+=26;
  if(safeArr(f.action_candidates).length)score+=10;
  const bias=research?.planner_bias||{};
  if(bias.favor_connected_actions&&connected)score+=18;
  if(bias.favor_retest&&connected)score+=8;
  if(bias.favor_counterevidence&&!connected)score+=5;
  if(bias.favor_low_risk&&String(f.severity||'').toLowerCase()==='info')score-=4;
  return Math.max(0,Math.round(score));
}

export function buildRemediationPlan(scan,channel={},research={}){
  const advertised=new Set(safeArr(channel.actions).map(x=>typeof x==='string'?x:x?.id).filter(Boolean));
  const rows=[];
  const missingCounts=new Map();
  for(const f of safeArr(scan?.findings)){
    const candidates=safeArr(f.action_candidates).map(String);
    const selected=candidates.find(id=>advertised.has(id))||candidates[0]||null;
    const connected=Boolean(selected&&advertised.has(selected));
    let lane='manual_or_future_adapter';
    let blocker='no_supported_action_contract';
    if(connected){lane='owner_bridge_ready';blocker='';}
    else if(selected&&classOf(selected)==='provider'){
      lane='provider_adapter_required';blocker=channel.available?'action_not_advertised':'owner_bridge_or_provider_adapter_missing';
    }else if(selected){
      lane='bridge_install_required';blocker=channel.available?'action_not_advertised':'owner_bridge_missing';
    }
    if(selected&&!connected)missingCounts.set(selected,(missingCounts.get(selected)||0)+1);
    rows.push({
      finding_id:String(f.id||''),
      title:String(f.title||''),
      severity:String(f.severity||'info'),
      confidence:String(f.confidence||''),
      selected_action:selected,
      action_class:selected?classOf(selected):null,
      lane,
      connected,
      blocker,
      priority_score:scoreFinding(f,connected,research),
      expected_verification:selected?`rerun scan and verify finding ${String(f.id||'')} is absent or explicitly reduced`:'manual evidence required',
      evidence:String(f.evidence||'').slice(0,800),
      fix:String(f.fix||'').slice(0,800)
    });
  }
  rows.sort((a,b)=>b.priority_score-a.priority_score||a.finding_id.localeCompare(b.finding_id));
  const batch=[];
  for(const row of rows){if(row.connected&&row.selected_action&&!batch.includes(row.selected_action))batch.push(row.selected_action);}
  const gaps=[...missingCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([action_id,count])=>({action_id,count,action_class:classOf(action_id)}));
  const counts={
    findings:rows.length,
    executable_now:rows.filter(x=>x.lane==='owner_bridge_ready').length,
    bridge_install_required:rows.filter(x=>x.lane==='bridge_install_required').length,
    provider_adapter_required:rows.filter(x=>x.lane==='provider_adapter_required').length,
    manual_or_future_adapter:rows.filter(x=>x.lane==='manual_or_future_adapter').length,
    unique_actions_ready:batch.length,
    unique_missing_actions:gaps.length
  };
  return {
    schema:'madlab-remediation-plan/v3',
    target:String(scan?.target||channel.target||''),
    generated_at:new Date().toISOString(),
    authority:'owner_contract_only',
    research_authority:research?.authority==='priority_only'?'priority_only':'none',
    permission_surface_unchanged:true,
    external_scope_unchanged:true,
    counts,
    execution_batch:batch,
    findings:rows,
    bridge_gap:gaps.slice(0,12),
    research_context:{
      security_latest_track:String(research?.security_reactor?.latest_track||''),
      security_latest_mode:String(research?.security_reactor?.latest_mode||''),
      security_preferred_track:String(research?.security_reactor?.preferred_track||''),
      security_recommended_next_mode:String(research?.security_reactor?.recommended_next_mode||''),
      senju_focus:String(research?.senju?.focus||''),
      senju_research_id:String(research?.senju?.research_id||''),
      source_health:research?.source_health||{}
    },
    next_best_expansion:gaps[0]||null,
    limitations:[
      'A plan never grants permission to mutate a target.',
      'Only actions advertised by the target owner bridge are executable.',
      'Provider and bridge gaps are surfaced as integration work, not bypassed.'
    ]
  };
}

export function executionReceipt({plan,before,after,executions=[]}){
  const afterIds=new Set(safeArr(after?.findings).map(x=>String(x.id||'')));
  const resolved=plan.findings.filter(x=>x.connected&&executions.some(e=>e.action_id===x.selected_action&&e.accepted)&&!afterIds.has(x.finding_id));
  const accepted=executions.filter(x=>x.accepted);
  return {
    schema:'madlab-action-receipt/v3',
    generated_at:new Date().toISOString(),
    target:plan.target,
    before_risk:Number(before?.risk_score||0),
    after_risk:after?Number(after.risk_score||0):null,
    risk_delta:after?Number(before?.risk_score||0)-Number(after.risk_score||0):null,
    findings_before:safeArr(before?.findings).length,
    findings_after:after?safeArr(after.findings).length:null,
    actions_attempted:executions.length,
    actions_accepted:accepted.length,
    findings_resolved:resolved.length,
    resolved_finding_ids:resolved.map(x=>x.finding_id),
    permission_surface_unchanged:true,
    verification_claimed:false,
    note:'Action acceptance and security resolution are measured separately. A mutation is not treated as verified unless the post-action scan supports the claim.'
  };
}
