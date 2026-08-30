import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBridgeKit } from '../bridge-kit.js';

test('bridge kit advertises only planned fixed actions and no credentials',()=>{
  const kit=buildBridgeKit({target:'https://owned.example',execution_batch:['hsts_profile'],bridge_gap:[{action_id:'dns_tls_profile',count:2}],next_best_expansion:{action_id:'dns_tls_profile',count:2}});
  assert.equal(kit.manifest.schema,'madlab-safe-action/v2');
  assert.equal(kit.manifest.owner_only,true);
  assert.deepEqual(kit.recommended_actions,['hsts_profile','dns_tls_profile']);
  const text=JSON.stringify(kit);
  assert.equal(text.includes('REAL_OWNER_SECRET'),false);
  assert.equal(kit.endpoint_contract.arbitrary_payload_allowed,false);
  assert.equal(kit.endpoint_contract.same_origin_required,true);
});
