import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_PLATFORMS, evaluateThreePlatformAcceptance } from '../src/acceptance.mjs';

function evidence(platform, route='edge') {
 return {
  mode:'live-owner-authorized', route, recordingConsentVerified:true,
  joinedVerified:true, hostObservedParticipant:true,
  audioReceivedVerified:true, sessionSeconds:180,
  verifiedAt:'2026-10-18T00:00:00+09:00',
  evidenceIds:[platform+'_hostproof_001', platform+'_audio_001'],
 };
}
test('mandatory services include Zoom, Google Meet, and Teams exactly',()=>{
 assert.deepEqual(REQUIRED_PLATFORMS,['zoom','google_meet','teams']);
});
test('no evidence always fails closed',()=>{
 const result=evaluateThreePlatformAcceptance(null);
 assert.equal(result.productionReady,false);
 assert.equal(Object.values(result.platforms).filter(v=>v.accepted).length,0);
});
test('passing Zoom only cannot be called complete',()=>{
 const result=evaluateThreePlatformAcceptance({platforms:{zoom:evidence('zoom')}});
 assert.equal(result.productionReady,false);
 assert.equal(result.platforms.zoom.accepted,true);
 assert.equal(result.platforms.google_meet.accepted,false);
 assert.equal(result.platforms.teams.accepted,false);
});
test('fake mock join cannot qualify as real admission',()=>{
 const p=evidence('google_meet');p.mode='synthetic';p.joinedVerified=true;
 const r=evaluateThreePlatformAcceptance({platforms:{google_meet:p}});
 assert.equal(r.platforms.google_meet.accepted,false);
 assert.ok(r.platforms.google_meet.gaps.includes('LIVE_TEST_NOT_PROVEN'));
});
test('host visual proof and audio proof are independent mandatory conditions',()=>{
 const p=evidence('teams','chrome');p.audioReceivedVerified=false;p.hostObservedParticipant=false;
 const r=evaluateThreePlatformAcceptance({platforms:{teams:p}});
 assert.ok(r.platforms.teams.gaps.includes('HOST_VIEW_UNVERIFIED'));
 assert.ok(r.platforms.teams.gaps.includes('AUDIO_UNVERIFIED'));
});
test('all three can qualify only with explicit live evidence metadata',()=>{
 const r=evaluateThreePlatformAcceptance({platforms:{
  zoom:evidence('zoom','desktop'),
  google_meet:evidence('google_meet','chrome'),
  teams:evidence('teams','edge'),
 }});
 assert.equal(r.productionReady,true);
});
