import test from "node:test";
import assert from "node:assert/strict";
import {normalizeTranscript,InMemoryMeetings} from "../src/engine.mjs";
import {createApp} from "../src/server.mjs";
const tokenA="local-only-synthetic-tenant-A-test-credential";
const tokenB="local-only-synthetic-tenant-B-test-credential";
function sample(workspace_id="tenant-a"){
  return {provider:"google_meet",workspace_id,meeting_id:"mtg-20261018-01",
   consent:{authorized:true,participants_notified:true},
   turns:[
    {source_event_id:"entry-001",speaker_ref:"Speaker A",start:"2026-10-18T00:00:00Z",end:"2026-10-18T00:00:04Z",text:"Please prepare the outline."},
    {source_event_id:"entry-002",speaker_ref:"Speaker B",start:"2026-10-18T00:00:05Z",end:"2026-10-18T00:00:08Z",text:"I will prepare the outline."},
    {source_event_id:"entry-003",speaker_ref:"Speaker A",start:"2026-10-18T00:00:10Z",end:"2026-10-18T00:00:13Z",text:"The due date is undecided."}
   ]};
}
test("evidence-linked draft and unknown due date",()=>{
 const r=normalizeTranscript(sample());
 assert.equal(r.evidence.length,3);
 assert.equal(r.draft.action_candidates.length,1);
 assert.equal(r.draft.action_candidates[0].owner_ref,"Speaker B");
 assert.equal(r.draft.action_candidates[0].due_date,null);
 assert.deepEqual(r.draft.action_candidates[0].evidence_turn_ids,[r.evidence[1].turn_id]);
 assert.equal(r.draft.due_date_status,"explicitly_undecided");
 assert.deepEqual(r.draft.decisions,[]);
 assert.equal(r.provenance.speaker_diarization,"not_performed");
});
test("same data regardless of turn order",()=>{
 const a=sample(),b=sample();b.turns.reverse();
 assert.equal(normalizeTranscript(a).source_sha256,normalizeTranscript(b).source_sha256);
});
test("no consent means no transcript processing",()=>{
 const a=sample();a.consent.authorized=false;assert.throws(()=>normalizeTranscript(a),/CONSENT/);
});
test("duplicate event IDs are rejected",()=>{
 const a=sample();a.turns[1].source_event_id="entry-001";
 assert.throws(()=>normalizeTranscript(a),/DUPLICATE/);
});
test("ambiguous timezones rejected",()=>{
 const a=sample();a.turns[0].start="2026-10-18T00:00:00";
 assert.throws(()=>normalizeTranscript(a),/TIMEZONE/);
});
test("impossible calendar dates rejected",()=>{
 const a=sample();
 a.turns[0].start="2026-02-30T00:00:00Z";
 a.turns[0].end="2026-02-30T00:00:04Z";
 assert.throws(()=>normalizeTranscript(a),/TIMESTAMP_INVALID/);
});
test("no ungrounded action on uncertain language",()=>{
 const a=sample();a.turns[1].text="Maybe I can do something";
 assert.equal(normalizeTranscript(a).draft.action_candidates.length,0);
});
test("duplicate replay and changed meeting are separate",()=>{
 const db=new InMemoryMeetings(),a=sample();
 assert.equal(db.importArtifact(a).status,"DRAFT_CREATED");
 assert.equal(db.importArtifact(a).status,"ALREADY_EXISTS");
 a.turns[1].text="I will prepare another outline";
 assert.equal(db.importArtifact(a).status,"CONFLICT");
 assert.equal(db.count(),1);
});
test("server refuses missing tenant credentials",()=>assert.throws(()=>createApp({tenantTokens:new Map()}),/AUTH/));
test("HTTP authenticated workspaces cannot read each other's draft",async()=>{
 const api=createApp({tenantTokens:new Map([["tenant-a",tokenA],["tenant-b",tokenB]])});
 await new Promise(r=>api.listen(0,"127.0.0.1",r));
 const url="http://127.0.0.1:"+api.address().port;
 const get=async(path,token)=>fetch(url+path,{headers:{"Authorization":"Bearer "+token}});
 const post=async(data,token)=>fetch(url+"/api/meetings/import-transcript",{
   method:"POST",headers:{"Authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(data)
 });
 try{
   assert.equal((await post(sample(),"wrong")).status,401);
   assert.equal((await post(sample(),tokenB)).status,403);
   const created=await post(sample(),tokenA);
   assert.equal(created.status,201);
   assert.equal((await created.json()).meeting.draft.status,"review_required");
   assert.equal((await post(sample(),tokenA)).status,200);
   assert.equal((await get("/api/meetings/mtg-20261018-01",tokenB)).status,404);
   assert.equal((await get("/api/meetings/mtg-20261018-01",tokenA)).status,200);
 }finally{await new Promise(r=>api.close(r))}
});
