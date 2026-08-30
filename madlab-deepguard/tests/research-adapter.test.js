import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeResearchContext } from '../research-adapter.js';

test('R&D and Senju remain priority-only with live Reactor/Senju schemas',()=>{
  const ctx=sanitizeResearchContext({
    reactor:{
      sessions:2,
      last_track:'SEC-PORT-008',
      last_mode:'VERIFY_NEXT_MISSING_EVIDENCE',
      history:[
        {session_id:'run-2',round:1,track_id:'SEC-PORT-011',mode:'REFRAME_AND_COUNTEREVIDENCE',material_delta:true},
        {session_id:'run-2',round:2,track_id:'SEC-PORT-008',mode:'VERIFY_NEXT_MISSING_EVIDENCE',material_delta:true}
      ],
      permission:'admin',target:'https://evil.example'
    },
    accelerator:{primary:{id:'SEC-PORT-005',status:'VISIBLE',evidence_ratio:1,senju_focus:'balance'},north_star:{tracks_verified:2,tracks_total:11,unfinished_tracks:9},selection_reason:'ROTATED_AFTER_STAGNATION',all_tracks:[{id:'SEC-PORT-004',status:'VISIBLE',evidence_ratio:1,whitehat_candidates:2}]},
    senju:{rnd_coupling:{research_id:'RND-STANDMENT-SECURITY-PORTFOLIO-ACCELERATOR-001',focus:'efficiency'},source_evidence_present:true,shadow_champion:{holdout:{safe:true}},permission:'root'}
  });
  assert.equal(ctx.authority,'priority_only');
  assert.equal(ctx.permission_surface_unchanged,true);
  assert.equal(ctx.external_scope_unchanged,true);
  assert.equal(ctx.promotion_gate_unchanged,true);
  assert.equal(ctx.verification_authority_unchanged,true);
  assert.equal(ctx.security_reactor.sessions_completed,2);
  assert.equal(ctx.security_reactor.current_session_rounds,2);
  assert.equal(ctx.security_reactor.latest_track,'SEC-PORT-008');
  assert.equal(ctx.security_reactor.preferred_track,'SEC-PORT-005');
  assert.equal(ctx.security_reactor.recommended_next_mode,'REFRAME_AND_COUNTEREVIDENCE');
  assert.equal(ctx.senju.focus,'efficiency');
  assert.equal(ctx.senju.shadow_champion_safe,true);
  assert.equal('permission' in ctx,false);
  assert.equal('target' in ctx,false);
});

test('unknown research modes and focus fail to bounded defaults',()=>{
  const ctx=sanitizeResearchContext({reactor:{last_mode:'ATTACK_ANYTHING'},senju:{rnd_coupling:{focus:'unlimited'}}});
  assert.equal(ctx.security_reactor.latest_mode,'NORMAL');
  assert.equal(ctx.security_reactor.recommended_next_mode,'VERIFY_NEXT_MISSING_EVIDENCE');
  assert.equal(ctx.senju.focus,'balance');
});
