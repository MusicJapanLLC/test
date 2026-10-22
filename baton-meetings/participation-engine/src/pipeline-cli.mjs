#!/usr/bin/env node
/** Local-only operator CLI for Music Japan recording -> diarization -> minutes. */
import {spawn} from 'node:child_process';
import {readFile, stat, writeFile, rename} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTranscript,AudioPipelineError} from './transcription.mjs';
import {generateMinutes,saveMinutes,validateMinutes} from './minutes.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const findOpt=name=>{const p=args.indexOf(name);return p<0?null:args[p+1]||null;};
const has=name=>args.includes(name);
const output=data=>console.log(JSON.stringify(data,null,2));
async function exists(p){try{await stat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function py(script,params=[]){
  const executable=process.env.MJ_PYTHON || 'python';
  const cmd=join(root,'src',script);
  const child=spawn(executable,[cmd,...params],{cwd:root,stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true});
  let stdout='',stderr='';
  child.stdout.on('data',data=>{if(stdout.length<200000)stdout+=data.toString();});
  child.stderr.on('data',data=>{if(stderr.length<200000)stderr+=data.toString();});
  const exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);});
  const result=stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  let json;try{json=JSON.parse(result);}catch{throw new Error('PYTHON_WORKER_INVALID_RESPONSE');}
  if(exit!==0 || json.status==='ERROR')throw new Error(json.code||'PYTHON_WORKER_FAILED');
  return json;
}
function required(name){const val=findOpt(name);if(!val)throw new Error('MISSING_'+name.slice(2).toUpperCase().replace(/-/g,'_'));return val;}
const mandatory=["--authorized","--consent"];
function confirmed(flags=mandatory) {return flags.every(flag=>has(flag));}
async function prepare(manifest){
  const folder=dirname(resolve(manifest));
  const outfile=join(folder,'prepared-manifest.json');
  if(await exists(outfile))return outfile;
  const r=await py('audio_prepare.py',['--manifest',resolve(manifest)]);
  if(r.status!=='PREPARED')throw new Error('AUDIO_PREPARATION_FAILED');
  return resolve(r.prepared_manifest);
}
async function processAudio(manifest) {
  if(!confirmed())throw new Error('RECORDING_AUTHORIZATION_AND_CONSENT_REQUIRED');
  const prepared=await prepare(manifest);
  const folder=dirname(resolve(manifest));
  const transcriptFile=join(folder,'transcript.json');
  let transcript;
  if(await exists(transcriptFile)){
    transcript=JSON.parse(await readFile(transcriptFile,'utf8'));
    if(transcript.synthetic || transcript.status!=='TRANSCRIBED_REQUIRES_HUMAN_REVIEW') throw new Error('EXISTING_TRANSCRIPT_INVALID');
  }else{
    const out=await buildTranscript({
      preparedManifestPath:prepared,provider:required('--provider'),
      allowBillable:has('--allow-billable'),
      cloudConsent:has('--cloud-consent'),
    });
    output({step:'TRANSCRIPTION',...out});
    transcript=JSON.parse(await readFile(transcriptFile,'utf8'));
  }
  if(await exists(join(folder,'minutes.draft.json'))) {
    output({status:'DRAFT_ALREADY_EXISTS',folder});
    return;
  }
  const minuteProvider=findOpt('--minutes-provider')||'extractive';
  const minutes=await generateMinutes({
    transcript,provider:minuteProvider,
    allowBillable:has('--allow-billable'),
    cloudConsent:has('--cloud-consent'),
  });
  output(await saveMinutes({sessionFolder:folder,minutes,transcript}));
}
async function status(manifest){
  const folder=dirname(resolve(manifest));
  const paths=['manifest.json','prepared-manifest.json','transcript.json','minutes.draft.json','minutes.approved.json'];
  const available={};
  for(const name of paths)available[name]=await exists(join(folder,name));
  let tracks=null,utterances=null,minutesStatus=null;
  if(available['manifest.json']){
    const data=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
    tracks=(data.tracks||[]).map(t=>({source:t.source,ok:t.ok,duration_s:t.duration_s,non_silent_blocks:t.non_silent_blocks}));
  }
  if(available['transcript.json'])utterances=(JSON.parse(await readFile(join(folder,'transcript.json'),'utf8')).segments||[]).length;
  if(available['minutes.draft.json'])minutesStatus='draft';
  if(available['minutes.approved.json'])minutesStatus='approved';
  output({status:'LOCAL_SESSION_STATUS',files:available,tracks,utterances,minutesStatus});
}
async function approve(folder) {
  if(!has('--human-reviewed-and-approved') || !has('--authorized'))throw new Error('HUMAN_APPROVAL_REQUIRED');
  const approver=required('--approver');
  if(!/^[\p{L}\p{N} _-]{2,80}$/u.test(approver))throw new Error('APPROVER_ID_INVALID');
  const draftFile=join(folder,'minutes.draft.json');
  const original=JSON.parse(await readFile(draftFile,'utf8'));
  const transcript=JSON.parse(await readFile(join(folder,'transcript.json'),'utf8'));
  if(original.status!=='draft' || original.synthetic || transcript.synthetic)
    throw new Error('SYNTHETIC_OR_NON_DRAFT_CANNOT_APPROVE');
  const checked=validateMinutes(original,transcript);
  if(JSON.stringify(checked.warnings)!=='[]' || checked.decisions.length!==original.decisions.length ||
     checked.action_items.length!==original.action_items.length)
    throw new Error('DRAFT_EVIDENCE_VALIDATION_FAILED');
  const final={...original,status:'approved',approved_at:new Date().toISOString(),approved_by:approver};
  const dest=join(folder,'minutes.approved.json');
  await writeFile(dest+'.partial',JSON.stringify(final,null,2),{flag:'wx',mode:0o600});
  await rename(dest+'.partial',dest);
  output({status:'APPROVED_BY_OPERATOR',file:dest});
}
async function fixture() {
  const fixturePath=resolve(required('--transcript-fixture'));
  const folder=resolve(required('--session-dir'));
  const transcript=JSON.parse(await readFile(fixturePath,'utf8'));
  if(transcript.synthetic!==true || !Array.isArray(transcript.segments))
    throw new Error('EXPLICIT_SYNTHETIC_FIXTURE_REQUIRED');
  const minutes=await generateMinutes({transcript,provider:'extractive'});
  // Fixture outputs always have a distinct name and cannot be approved commercially.
  const draftPath=join(folder,'minutes.synthetic.draft.json');
  await writeFile(draftPath,JSON.stringify(minutes,null,2),{mode:0o600,flag:'wx'});
  output({status:'SYNTHETIC_TEST_ONLY_NOT_A_REAL_MEETING',minutes:minutes,output:draftPath});
}
async function main() {
  const cmd=args[0];
  if(cmd==='doctor'){
    output({status:'READY_FOR_TESTS_NOT_LIVE_CERTIFIED',
      captureVendorAvailable:await exists(join(root,'vendor','pyaudiowpatch')),
      providers:{
        openai:Boolean(process.env.OPENAI_API_KEY),
        deepgram:Boolean(process.env.DEEPGRAM_API_KEY),
        assemblyai:Boolean(process.env.ASSEMBLYAI_API_KEY),
      },anyApiPaymentHasOccurred:false,
      requiredFlags:['--authorized','--consent','--cloud-consent','--allow-billable']});
    return;
  }
  if(cmd==='capture'){
    if(!confirmed())throw new Error('RECORDING_AUTHORIZATION_AND_CONSENT_REQUIRED');
    const params=['--output-dir',resolve(required('--output-dir')),'--duration',required('--duration'),
      '--authorized','--consent'];
    if(has('--microphone'))params.push('--microphone');
    if(findOpt('--loopback-index'))params.push('--loopback-index',findOpt('--loopback-index'));
    if(findOpt('--mic-index'))params.push('--mic-index',findOpt('--mic-index'));
    output(await py('record.py',params));return;
  }
  if(cmd==='prepare'){output({status:'PREPARED_OR_PRESENT',file:await prepare(required('--manifest'))});return;}
  if(cmd==='process'){await processAudio(required('--manifest'));return;}
  if(cmd==='minutes'){
    const transcriptFile=resolve(required('--transcript'));
    const transcript=JSON.parse(await readFile(transcriptFile,'utf8'));
    const minutes=await generateMinutes({
      transcript,provider:findOpt('--minutes-provider')||'extractive',
      allowBillable:has('--allow-billable'),cloudConsent:has('--cloud-consent'),
    });
    output(await saveMinutes({sessionFolder:dirname(transcriptFile),minutes,transcript}));return;
  }
  if(cmd==='approve'){await approve(resolve(required('--session-dir')));return;}
  if(cmd==='status'){await status(required('--manifest'));return;}
  if(cmd==='synthetic-test'){await fixture();return;}
  output({usage:[
    'node src/pipeline-cli.mjs doctor',
    'node src/pipeline-cli.mjs capture --output-dir PRIVATE_DIR --duration 120 --authorized --consent [--microphone]',
    'node src/pipeline-cli.mjs prepare --manifest PRIVATE_DIR/manifest.json',
    'node src/pipeline-cli.mjs process --manifest PRIVATE_DIR/manifest.json --provider openai --minutes-provider extractive --authorized --consent --cloud-consent --allow-billable',
    'node src/pipeline-cli.mjs minutes --transcript PRIVATE_DIR/transcript.json --minutes-provider extractive',
    'node src/pipeline-cli.mjs approve --session-dir PRIVATE_DIR --human-reviewed-and-approved --authorized --approver OWNER_ID',
    'node src/pipeline-cli.mjs status --manifest PRIVATE_DIR/manifest.json'
  ]});
}
main().catch(error=>{
  // Never print audio, auth tokens, local meeting links or transcript text.
  const code=error instanceof AudioPipelineError?error.code:
    /^[A-Z0-9_]{3,120}$/.test(error?.message||'')?error.message:'PIPELINE_OPERATION_FAILED';
  console.error(JSON.stringify({status:'ERROR',code}));
  process.exitCode=2;
});
