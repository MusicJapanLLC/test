import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemediationPlan, executionReceipt } from '../action-fabric.js';

const scan={target:'https://owned.example',risk_score:40,findings:[
  {id:'hsts-missing',severity:'medium',confidence:'high',title:'HSTS missing',action_candidates:['hsts_profile'],evidence:'missing',fix:'add'},
  {id:'dns-caa-missing',severity:'low',confidence:'high',title:'CAA missing',action_candidates:['dns_tls_profile'],evidence:'missing',fix:'add'},
  {id:'unknown-gap',severity:'info',confidence:'medium',title:'Unknown',action_candidates:[],evidence:'x',fix:'manual'}
]};

test('planner executes only target-advertised owner actions',()=>{
  const plan=buildRemediationPlan(scan,{available:true,target:scan.target,actions:[{id:'hsts_profile'}]},{authority:'priority_only',planner_bias:{favor_connected_actions:true},security_reactor:{next_track:'SEC-PORT-011',next_mode:'SWITCH_EVIDENCE_PATH'},senju:{focus:'efficiency'}});
  assert.deepEqual(plan.execution_batch,['hsts_profile']);
  assert.equal(plan.counts.executable_now,1);
  assert.equal(plan.counts.provider_adapter_required,1);
  assert.equal(plan.counts.manual_or_future_adapter,1);
  assert.equal(plan.permission_surface_unchanged,true);
  assert.equal(plan.external_scope_unchanged,true);
});

test('research can reprioritize but cannot make an unadvertised action executable',()=>{
  const plan=buildRemediationPlan(scan,{available:false,target:scan.target,actions:[]},{authority:'priority_only',planner_bias:{favor_connected_actions:true,favor_retest:true}});
  assert.deepEqual(plan.execution_batch,[]);
  assert.equal(plan.findings.find(x=>x.finding_id==='hsts-missing').lane,'bridge_install_required');
  assert.equal(plan.findings.find(x=>x.finding_id==='dns-caa-missing').lane,'provider_adapter_required');
});

test('receipt separates accepted mutations from verified resolution',()=>{
  const plan=buildRemediationPlan(scan,{available:true,target:scan.target,actions:[{id:'hsts_profile'}]},{authority:'priority_only'});
  const after={risk_score:32,findings:[scan.findings[1],scan.findings[2]]};
  const receipt=executionReceipt({plan,before:scan,after,executions:[{action_id:'hsts_profile',accepted:true}]});
  assert.equal(receipt.actions_accepted,1);
  assert.equal(receipt.findings_resolved,1);
  assert.equal(receipt.verification_claimed,false);
  assert.equal(receipt.risk_delta,8);
});
