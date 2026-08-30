const $=s=>document.querySelector(s);
const U=$('#url'),A=$('#authorized'),B=$('#plan'),R=$('#result');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c));
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>({error:`HTTP ${r.status}`}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
function lane(x){return({owner_bridge_ready:'今すぐ実行可能',bridge_install_required:'OWNER BRIDGE接続が必要',provider_adapter_required:'Provider adapterが必要',manual_or_future_adapter:'手動 / 次期adapter'})[x]||x;}
function render(d){
  const p=d.plan||{},c=p.counts||{},research=d.research||{},reactor=research.security_reactor||{},senju=research.senju||{},kit=d.bridge_kit;
  const rows=(p.findings||[]).slice(0,12).map(x=>`<article class="finding"><div class="head"><span class="sev ${esc(x.severity||'info')}">${esc(x.severity||'info')}</span><div><b>${esc(x.title)}</b><small>${esc(x.finding_id)} · priority ${esc(x.priority_score)}</small></div><span class="status ${x.connected?'resolved':'actuator_missing'}">${esc(lane(x.lane))}</span></div><div class="action">${x.selected_action?`対応: <code>${esc(x.selected_action)}</code> · ${esc(x.action_class||'')}`:'自動action contractなし'}</div>${x.blocker?`<div class="notice">Blocker: ${esc(x.blocker)}</div>`:''}</article>`).join('');
  const gaps=(p.bridge_gap||[]).slice(0,8).map(x=>`<code>${esc(x.action_id)} ×${esc(x.count)}</code>`).join(' ');
  const kitText=kit?`<div class="notice"><b>OWNER BRIDGE v2接続候補</b><br>${esc((kit.recommended_actions||[]).join(', ')||'diagnostic_marker')}<br>manifest: <code>${esc(kit.manifest_path)}</code></div>`:'';
  R.innerHTML=`<section class="summary"><div><strong>ACTION FABRIC</strong><span>${esc(p.target||'')}</span><small>R&D authority=${esc(p.research_authority||'none')} / execution authority=${esc(p.authority||'')}</small></div><div class="stats"><i><small>今すぐ実行</small><b>${esc(c.executable_now||0)}</b></i><i><small>Bridge接続</small><b>${esc(c.bridge_install_required||0)}</b></i><i><small>Provider連携</small><b>${esc(c.provider_adapter_required||0)}</b></i><i><small>未契約</small><b>${esc(c.manual_or_future_adapter||0)}</b></i></div><div class="notice"><b>THE WORLD research assist</b><br>Reactor latest: ${esc(reactor.latest_track||'-')} / ${esc(reactor.latest_mode||'-')}<br>R&D preferred: ${esc(reactor.preferred_track||'-')} / next mode ${esc(reactor.recommended_next_mode||'-')}<br>Current reactor session: ${esc(reactor.current_session_rounds||0)} rounds / material ${esc(reactor.current_session_material_rounds||0)}<br>Senju: ${esc(senju.focus||'-')} · ${esc(senju.research_id||'-')}<br>Research source: ${esc(JSON.stringify(research.source_health||{}))}</div>${gaps?`<div class="notice"><b>次に増やすべき外部作用</b><br>${gaps}</div>`:''}${kitText}</section><section class="findings">${rows||'<div class="empty">Findingはありませんでした</div>'}</section>`;
}
async function plan(){
  if(!U.value.trim()){U.focus();return;}
  if(!A.checked){R.innerHTML='<div class="error"><b>所有・明示許可の確認が必要です</b></div>';return;}
  B.disabled=true;B.textContent='計画生成中…';
  try{render(await post('/api/remediation/plan',{url:U.value.trim(),authorized:true}));}
  catch(e){R.innerHTML=`<div class="error"><b>実行計画を生成できませんでした</b><span>${esc(e.message)}</span></div>`;}
  finally{B.disabled=false;B.textContent='実行計画を見る';}
}
B?.addEventListener('click',plan);
