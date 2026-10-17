import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {makeExtractiveDraft,validateMinutes,generateMinutes,minutesMarkdown,saveMinutes} from '../src/minutes.mjs';

const transcript={
  schema_version:1,status:'TRANSCRIBED_REQUIRES_HUMAN_REVIEW',synthetic:true,
  segments:[
    {evidence_id:'seg_a0',speaker_id:'remote@remote-00000:A',start_s:0,end_s:3,text:'Please prepare the outline.'},
    {evidence_id:'seg_b0',speaker_id:'remote@remote-00000:B',start_s:5,end_s:8,text:'I will prepare the outline.'},
    {evidence_id:'seg_a1',speaker_id:'remote@remote-00000:A',start_s:10,end_s:14,text:'The due date is undecided.'},
  ]
};
test('original anonymous three-speaker-utterance transcript makes an evidence-linked draft',async()=>{
  const result=await generateMinutes({transcript});
  assert.equal(result.status,'draft');
  assert.equal(result.synthetic,true);
  assert.equal(result.decisions.length,0);
  assert.equal(result.action_items.length,1);
  assert.equal(result.action_items[0].owner_speaker_id,transcript.segments[1].speaker_id);
  assert.equal(result.action_items[0].due_date,null);
  assert.equal(result.open_questions.length,1);
  assert.deepEqual(result.action_items[0].evidence_ids,['seg_b0']);
  assert.equal(result.approved_at,null);
});
test('fabricated agreement and date in LLM output are rejected',()=>{
  const forged={
    title:'Fictional approval',
    summary:{text:'Please prepare the outline.',evidence_ids:['seg_a0']},
    decisions:[{text:'We decided to pay a million dollars',evidence_ids:['seg_a0']}],
    action_items:[{text:'I will prepare the outline.',owner_speaker_id:'remote@remote-00000:B',
      due_date:'2026-11-30',evidence_ids:['seg_b0']}],
    open_questions:[],
  };
  const result=validateMinutes(forged,transcript);
  assert.equal(result.decisions.length,0);
  assert.equal(result.action_items[0].due_date,null);
  assert.ok(result.warnings.some(x=>x.includes('decisions')));
});
test('claims without exact segment IDs are excluded',()=>{
  const forged={
    title:'Unsupported',summary:{text:'all settled',evidence_ids:['missing']},
    decisions:[{text:'We agreed',evidence_ids:['fabricated']}],
    action_items:[],open_questions:[],
  };
  const out=validateMinutes(forged,transcript);
  assert.equal(out.decisions.length,0);
  assert.equal(out.summary.evidence_ids[0],'seg_a0');
});
test('explicit final decision can be included with its evidence',async()=>{
  const t={...transcript,segments:[...transcript.segments,
    {evidence_id:'seg_d0',speaker_id:'remote@remote-00000:A',start_s:16,end_s:20,text:'We decided to proceed with the prototype.'}]};
  const out=await generateMinutes({transcript:t});
  assert.equal(out.decisions.length,1);
  assert.equal(out.decisions[0].evidence_ids[0],'seg_d0');
});
test('minutes Markdown includes time, speaker and original evidence ID',async()=>{
  const minutes=await generateMinutes({transcript});
  const md=minutesMarkdown(minutes,transcript);
  assert.match(md,/DRAFT/);
  assert.match(md,/seg_b0/);
  assert.match(md,/0:05/);
  assert.match(md,/remote@remote-00000:B/);
});
test('cloud LLM requires explicit consent and cost authorization',async()=>{
  let called=0;
  await assert.rejects(generateMinutes({
    transcript,provider:'openai',http:async()=>{called++;return{};},
    env:{OPENAI_API_KEY:'fake'},
  }),/MINUTES_CLOUD_CONSENT_AND_BILLING_REQUIRED/);
  assert.equal(called,0);
});
test('OpenAI schema-structured draft can be generated and validated against cited segments',async()=>{
  let requestBody=null;
  const result=await generateMinutes({
    transcript,provider:'openai',allowBillable:true,cloudConsent:true,
    env:{OPENAI_API_KEY:'fake'},
    http:async(url,opts)=>{
      assert.equal(url,'https://api.openai.com/v1/chat/completions');
      requestBody=JSON.parse(opts.body);
      return {status:200,ok:true,json:async()=>({
        choices:[{message:{content:JSON.stringify({
          title:'Outline planning',
          summary:{text:'Please prepare the outline.',evidence_ids:['seg_a0']},
          decisions:[],
          action_items:[{text:'I will prepare the outline.',
            owner_speaker_id:'remote@remote-00000:B',due_date:null,evidence_ids:['seg_b0']}],
          open_questions:[{text:'The due date is undecided.',evidence_ids:['seg_a1']}],
        })}}],
      })};
    },
  });
  assert.equal(result.generator,'openai');
  assert.equal(requestBody.response_format.type,'json_schema');
  assert.equal(requestBody.response_format.json_schema.strict,true);
  assert.equal(result.action_items.length,1);
  assert.equal(result.open_questions.length,1);
});
test('minutes draft persists JSON and Markdown without approved status',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'mj-minutes-'));
  try {
    const minutes=await generateMinutes({transcript});
    const saved=await saveMinutes({sessionFolder:temp,minutes,transcript});
    assert.equal(saved.status,'DRAFT_PERSISTED');
    const stored=JSON.parse(await readFile(saved.json,'utf8'));
    assert.equal(stored.status,'draft');
    assert.equal(stored.synthetic,true);
    const md=await readFile(saved.markdown,'utf8');
    assert.match(md,/Raw utterances/);
    await assert.rejects(saveMinutes({sessionFolder:temp,minutes,transcript}),/EEXIST|file already exists/);
  } finally {await rm(temp,{recursive:true,force:true});}
});
