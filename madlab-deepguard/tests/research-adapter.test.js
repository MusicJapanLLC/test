import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeResearchContext } from '../research-adapter.js';

test('R&D and Senju remain priority-only',()=>{
  const ctx=sanitizeResearchContext({
    reactor:{sessions_completed:9,rounds_completed:108,next_track:'SEC-PORT-011',next_mode:'INDEPENDENT_RETEST',material_rounds:40,strategy_rotations:20,permission:'admin',target:'https://evil.example'},
    accelerator:{primary:{id:'SEC-PORT-011',status:'BUILDING',evidence_ratio:.8,senju_focus:'robustness'},north_star:{tracks_verified:3,tracks_total:11,unfinished_tracks:8},all_tracks:[{id:'SEC-PORT-004',status:'BUILDING',evidence_ratio:.4,whitehat_candidates:2}]},
    senju:{focus:'robustness',permission:'root'}
  });
  assert.equal(ctx.authority,'priority_only');
  assert.equal(ctx.permission_surface_unchanged,true);
  assert.equal(ctx.external_scope_unchanged,true);
  assert.equal(ctx.promotion_gate_unchanged,true);
  assert.equal(ctx.verification_authority_unchanged,true);
  assert.equal(ctx.security_reactor.next_track,'SEC-PORT-011');
  assert.equal(ctx.senju.focus,'robustness');
  assert.equal('permission' in ctx,false);
  assert.equal('target' in ctx,false);
});

test('unknown research modes and focus fail to bounded defaults',()=>{
  const ctx=sanitizeResearchContext({reactor:{next_mode:'ATTACK_ANYTHING'},senju:{focus:'unlimited'}});
  assert.equal(ctx.security_reactor.next_mode,'NORMAL');
  assert.equal(ctx.senju.focus,'balance');
});
