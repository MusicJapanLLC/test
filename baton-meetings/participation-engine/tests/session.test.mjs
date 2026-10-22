import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runMeetingSession,classifySessionOutcome} from '../src/session.mjs';

const cases={
  zoom:'https://zoom.us/j/81906526578?pwd=test',
  google_meet:'https://meet.google.com/abc-defg-hij',
  teams:'https://teams.microsoft.com/l/meetup-join/test',
};
const verified={type:'IN_CALL_LEAVE_CONTROL',observedAt:'2026-10-18T00:00:00.000Z'};
function setup(url,{status='JOINED_VERIFIED',silence=false,admission='JOINED'}={}){
  const trace=[];
  let current=null;
  const adapter={
    async maintain({signal}){trace.push('maintain');return {state:'OPERATOR_STOPPED'};},
    async awaitAdmission(){trace.push('awaitAdmission');return admission==='JOINED'?{state:'JOINED',proof:verified}:{state:admission};},
    async close(){trace.push('close');},
  };
  const deps={
    meetingUrl:url,authorized:true,recordingConsentConfirmed:true,live:true,
    durationSeconds:6,routes:['edge'],getFreeBytes:()=>1024**3,
    adapters:{edge:adapter},
    engine:{async join(){trace.push('join');return {status,route:'edge',proof:verified};}},
    recordWorker:async(script,args)=>{
      trace.push('record');
      assert.equal(script,'record.py');
      assert.ok(args.includes('--authorized'));
      assert.ok(args.includes('--consent'));
      assert.ok(args.includes('--microphone'));
      return {
        child:{killed:false,exitCode:0,kill(){trace.push('killed');}},
        done:Promise.resolve({exit:0,result:{
          status:'CAPTURE_COMPLETED',tracks:[{
            source:'remote',ok:true,duration_s:6,non_silent_blocks:silence?0:10,
          }],
        }}),
      };
    },
    prepare:async()=>{trace.push('prepare');return 'MOCK_PREPARED_ONLY';},
  };
  return {deps,trace};
}
test('each platform can sequence joined, record, prepare without external API calls',async()=>{
  for(const [platform,url] of Object.entries(cases)){
    const folder=await mkdtemp(join(tmpdir(),'mj-session-'));
    try{
      const {deps,trace}=setup(url);
      const result=await runMeetingSession({...deps,privateBase:folder});
      assert.equal(result.platform,platform);
      assert.equal(result.status,'AWAITING_DIARIZED_TRANSCRIPT');
      assert.ok(trace.includes('join') && trace.includes('record') && trace.includes('prepare'));
      assert.ok(trace.includes('close'));
      const audit=await readFile(result.eventLog,'utf8');
      assert.match(audit,/JOINED_UI_VERIFIED/);
      assert.doesNotMatch(audit,/pwd=test/);
    }finally{await rm(folder,{recursive:true,force:true});}
  }
});
test('waiting for host approval does not start recording before admission',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'mj-session-'));
  try{
    const {deps,trace}=setup(cases.google_meet,{status:'WAITING_ADMISSION'});
    await runMeetingSession({...deps,privateBase:folder});
    assert.ok(trace.indexOf('awaitAdmission')<trace.indexOf('record'));
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('host denial in Teams never records or swaps to alternate identity',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'mj-session-'));
  try{
    const {deps,trace}=setup(cases.teams,{status:'WAITING_ADMISSION',admission:'HOST_DENIED'});
    await assert.rejects(runMeetingSession({...deps,privateBase:folder}),/LOBBY_NOT_ADMITTED/);
    assert.equal(trace.includes('record'),false);
    assert.equal(trace.includes('close'),true);
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('recorded silence is never certified as complete audio',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'mj-session-'));
  try{
    const {deps}=setup(cases.zoom,{silence:true});
    const result=await runMeetingSession({...deps,privateBase:folder});
    assert.equal(result.status,'AUDIO_CAPTURE_NOT_VERIFIED');
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('mock STT and synthesized minutes remain synthetic even though pipeline completes',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'mj-session-'));
  try{
    const {deps}=setup(cases.zoom);
    const fixture={
      synthetic:true,segments:[{evidence_id:'seg_test',source:'remote',speaker_id:'remote@remote-00000:A',
        start_s:0,end_s:2,text:'I will prepare the outline.'}],
    };
    const result=await runMeetingSession({...deps,privateBase:folder,sttProvider:'openai',
      transcribe:async()=>{const dir=Array.from((await import('node:fs')).readdirSync(folder)).filter(n=>n!=='locks')[0];
        const target=join(folder,dir,'capture');
        await mkdir(target,{recursive:true});
        await writeFile(join(target,'transcript.json'),JSON.stringify(fixture));
        return {segments:1};
      },
      makeMinutes:async()=>({status:'draft',synthetic:true}),
      storeMinutes:async()=>({status:'MOCK_SAVED'}),
    });
    assert.equal(result.status,'SYNTHETIC_TEST_ONLY');
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('missing permissions or low memory prevent any join',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'mj-session-'));
  try{
    const {deps,trace}=setup(cases.zoom);
    await assert.rejects(runMeetingSession({...deps,privateBase:folder,authorized:false}),/CONSENT_AND_AUTHORIZED_MEETING_REQUIRED/);
    await assert.rejects(runMeetingSession({...deps,privateBase:folder,getFreeBytes:()=>1}),/INSUFFICIENT_FREE_MEMORY/);
    assert.equal(trace.includes('join'),false);
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('session cannot be certified without actual joined, non-silent audio and draft',()=>{
  assert.equal(classifySessionOutcome({status:'JOINED_VERIFIED'},
    {tracks:[{ok:true,non_silent_blocks:2}]},{segments:[{text:'a'}]},{status:'draft',synthetic:false}),
    'MINUTES_DRAFT_READY_FOR_HUMAN_REVIEW');
  assert.equal(classifySessionOutcome({status:'JOINED_VERIFIED'},
    {tracks:[{ok:true,non_silent_blocks:2}]},{segments:[{text:'a'}],synthetic:true},
    {status:'draft',synthetic:true}),'SYNTHETIC_TEST_ONLY');
  assert.equal(classifySessionOutcome({status:'WAITING_ADMISSION'},{tracks:[]},null,null),'NOT_JOINED_VERIFIED');
});
