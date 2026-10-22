import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  normalizeOpenAI,normalizeDeepgram,normalizeAssemblyAI,normalizeAllSegments,
  providerTranscribe,buildTranscript,AudioPipelineError
} from '../src/transcription.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const audio=Buffer.alloc(240,'a');
function ok(json){return {ok:true,status:200,json:async()=>json};}

test('OpenAI diarized_json normalizes speaker and interval',()=>{
  const actual=normalizeOpenAI({segments:[
    {start:0,end:3.2,speaker:'A',text:'Please prepare the outline.'},
    {start:3.4,end:5,speaker:'B',text:'I will prepare the outline.'},
  ]});
  assert.equal(actual.length,2);
  assert.equal(actual[1].speaker,'B');
  assert.equal(actual[1].start,3.4);
});
test('Deepgram diarize_model latest maps utterances to speaker segments',()=>{
  const actual=normalizeDeepgram({results:{utterances:[
    {start:0.1,end:2.0,speaker:0,transcript:'Hello there',confidence:0.9},
    {start:2.1,end:3.0,speaker:1,transcript:'Good morning',confidence:0.8},
  ]}});
  assert.equal(actual.length,2);
  assert.equal(actual[1].speaker,'1');
});
test('AssemblyAI diarized timestamps convert milliseconds to seconds',()=>{
  const actual=normalizeAssemblyAI({utterances:[{start:500,end:1250,speaker:'A',text:'We will review',confidence:0.5}]});
  assert.equal(actual[0].start,.5);
  assert.equal(actual[0].end,1.25);
});
test('OpenAI request sends diarization parameters and never assumes API success',async()=>{
  const urls=[];
  const http=async(url,opts)=>{
    urls.push({url,opts});
    return ok({segments:[{start:0,end:1,text:'A statement',speaker:'A'}]});
  };
  const out=await providerTranscribe({provider:'openai',bytes:audio,filename:'test.wav',http,
    env:{OPENAI_API_KEY:'test-key-do-not-use'}});
  assert.equal(out[0].speaker,'A');
  assert.equal(urls.length,1);
  assert.equal(urls[0].url,'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(urls[0].opts.body.get('model'),'gpt-4o-transcribe-diarize');
  assert.equal(urls[0].opts.body.get('response_format'),'diarized_json');
  assert.equal(urls[0].opts.body.get('chunking_strategy'),'auto');
});
test('Deepgram call uses current diarize_model, not deprecated diarize toggle',async()=>{
  const calls=[];
  const http=async(url,opts)=>{
    calls.push({url:String(url),opts});
    return ok({results:{utterances:[{start:0,end:1,transcript:'hello',speaker:0}]}});
  };
  await providerTranscribe({provider:'deepgram',bytes:audio,filename:'test.wav',http,
    env:{DEEPGRAM_API_KEY:'not-real'}});
  assert.match(calls[0].url,/diarize_model=latest/);
  assert.doesNotMatch(calls[0].url,/diarize=true/);
});
test('AssemblyAI upload -> create -> poll -> transcript produces speaker labels',async()=>{
  const urls=[];
  const http=async(url,options)=>{
    urls.push(String(url));
    if(String(url).endsWith('/upload'))return ok({upload_url:'https://cdn.assemblyai.com/test.wav'});
    if(String(url).endsWith('/transcript'))return ok({id:'TESTID12345'});
    return ok({status:'completed',utterances:[{start:100,end:1500,text:'Hello',speaker:'A'}]});
  };
  const r=await providerTranscribe({provider:'assemblyai',bytes:audio,filename:'test.wav',http,
    pause:async()=>{},env:{ASSEMBLYAI_API_KEY:'fake'}});
  assert.equal(urls.length,3);
  assert.equal(r[0].end,1.5);
});
test('no API key means fail closed without calling any external host',async()=>{
  let calls=0;
  await assert.rejects(providerTranscribe({provider:'openai',bytes:audio,filename:'a.wav',
    http:async()=>{calls++;return ok({});},env:{}}),/OPENAI_API_KEY_MISSING/);
  assert.equal(calls,0);
});
test('normalization preserves independent source and chunk speaker identity',()=>{
  const groups=[
    {chunk:{source:'remote',chunk_id:'remote-00000',absolute_start_s:0,sha256:'a'.repeat(64)},
      segments:[{start:0,end:2,text:'Hi',speaker:'A'},{start:3,end:4,text:'Hello',speaker:'B'}]},
    {chunk:{source:'local_mic',chunk_id:'local_mic-00000',absolute_start_s:0.1,sha256:'b'.repeat(64)},
      segments:[{start:0,end:1,text:'Welcome',speaker:'A'}]},
    {chunk:{source:'remote',chunk_id:'remote-00001',absolute_start_s:3.2,sha256:'c'.repeat(64)},
      segments:[{start:0,end:0.8,text:'Hello',speaker:'B'}]},
  ];
  const out=normalizeAllSegments(groups);
  assert.equal(out.length,3,'overlap should be deduplicated');
  assert.notEqual(out[0].speaker_id,out[1].speaker_id);
  assert.ok(out.every(s=>s.speaker_identity==='unverified' && s.evidence_id.startsWith('seg_')));
});
async function makeFixture() {
  const folder=await mkdtemp(join(tmpdir(),'mj-audio-test-'));
  await mkdir(join(folder,'prepared'));
  const name='remote-00000.wav';
  await writeFile(join(folder,'prepared',name),audio);
  const capture={schema_version:1,consent_confirmed_by_operator:true,test_fixture:true,tracks:[]};
  const captureBytes=Buffer.from(JSON.stringify(capture));
  await writeFile(join(folder,'manifest.json'),captureBytes);
  const prepared={schema_version:1,source_capture_manifest_sha256:hash(captureBytes),chunks:[
    {source:'remote',chunk_id:'remote-00000',file:name,sha256:hash(audio),absolute_start_s:0},
  ]};
  await writeFile(join(folder,'prepared-manifest.json'),JSON.stringify(prepared));
  return folder;
}
test('audio-to-diarized transcript E2E from verified fixture with mock provider; marked synthetic',async()=>{
  const folder=await makeFixture();
  let calls=0;
  try {
    const http=async()=>{calls++;return ok({segments:[
      {start:0,end:1,text:'Please prepare the outline.',speaker:'A'},
      {start:1,end:2,text:'I will prepare the outline.',speaker:'B'},
    ]});};
    const opts={preparedManifestPath:join(folder,'prepared-manifest.json'),
      provider:'openai',allowBillable:true,cloudConsent:true,
      env:{OPENAI_API_KEY:'not-real'},http};
    const response=await buildTranscript(opts);
    assert.equal(response.segments,2);
    const result=JSON.parse(await readFile(join(folder,'transcript.json'),'utf8'));
    assert.equal(result.synthetic,true,'fixture content must never become real minutes');
    assert.equal(result.status,'TRANSCRIBED_REQUIRES_HUMAN_REVIEW');
    assert.equal(calls,1);
    await buildTranscript(opts);
    assert.equal(calls,1,'resume from checkpoint, never charge twice');
  } finally {await rm(folder,{recursive:true,force:true});}
});
test('cloud consent and auth failures leave no billable job receipt',async()=>{
  const folder=await makeFixture();
  try {
    const opts={preparedManifestPath:join(folder,'prepared-manifest.json'),provider:'openai',http:async()=>{throw Error('MUST_NOT_SEND');}};
    await assert.rejects(buildTranscript({...opts,allowBillable:false,cloudConsent:false}),/EXTERNAL_STT_REQUIRES/);
    await assert.rejects(buildTranscript({...opts,allowBillable:true,cloudConsent:true,env:{}}),/STT_PROVIDER_KEY_MISSING/);
    assert.equal((await readdir(folder)).includes('transcription-checkpoints'),false);
  } finally {await rm(folder,{recursive:true,force:true});}
});
test('transcription refuses tampered original consent manifest',async()=>{
  const folder=await makeFixture();
  try{
    await writeFile(join(folder,'manifest.json'),JSON.stringify({schema_version:1,consent_confirmed_by_operator:false}));
    await assert.rejects(buildTranscript({preparedManifestPath:join(folder,'prepared-manifest.json'),
      provider:'openai',allowBillable:true,cloudConsent:true,env:{OPENAI_API_KEY:'test'}}),/RECORDING_CONSENT_MISSING/);
  }finally{await rm(folder,{recursive:true,force:true});}
});
