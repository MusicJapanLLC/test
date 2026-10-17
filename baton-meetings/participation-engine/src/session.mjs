import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {open,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {parseMeetingUrl,ParticipationEngine} from './core.mjs';
import {createAdapters} from './adapters.mjs';
import {buildTranscript} from './transcription.mjs';
import {generateMinutes,saveMinutes} from './minutes.mjs';

const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function worker(script,args,{cwd=base,python=process.env.MJ_PYTHON||'python'}={}) {
  const child=spawn(python,[join(base,'src',script),...args],{cwd,stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true});
  let stdout='',stderr='';
  child.stdout.on('data',data=>{if(stdout.length<10000)stdout+=data.toString();});
  child.stderr.on('data',data=>{if(stderr.length<10000)stderr+=data.toString();});
  const done=new Promise((resolveDone,rejectDone)=>{
    child.once('error',rejectDone);
    child.once('exit',code=>{
      try {
        const json=JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
        resolveDone({exit:code,result:json});
      } catch {rejectDone(new Error('AUDIO_WORKER_INVALID_JSON'));}
    });
  });
  return {child,done};
}
async function prepareAudio(manifestPath) {
  const workerInfo=await worker('audio_prepare.py',['--manifest',manifestPath]);
  const result=await workerInfo.done;
  if(result.exit!==0 || result.result.status!=='PREPARED')throw new Error(result.result.code||'PREPARATION_FAILED');
  return result.result.prepared_manifest;
}
export function classifySessionOutcome(joined,capture,transcript,minutes) {
  if(joined?.status!=='JOINED_VERIFIED')return 'NOT_JOINED_VERIFIED';
  if(!capture?.tracks?.some(t=>t.ok && (t.non_silent_blocks||0)>0))return 'AUDIO_CAPTURE_NOT_VERIFIED';
  if(!transcript || !Array.isArray(transcript.segments) || transcript.segments.length===0)return 'AWAITING_DIARIZED_TRANSCRIPT';
  if(!minutes || minutes.status!=='draft')return 'AWAITING_MINUTES_DRAFT';
  return 'MINUTES_DRAFT_READY_FOR_HUMAN_REVIEW';
}
export async function runMeetingSession({
  meetingUrl,authorized,recordingConsentConfirmed,live,minutesProvider='extractive',
  cloudConsent=false,allowBillable=false,sttProvider=null,durationSeconds=1800,
  includeMicrophone=true,routes=['edge','chrome'],privateBase=join(base,'private','sessions'),
  adapters=createAdapters(),engine=null,recordWorker=worker,
  prepare=prepareAudio,transcribe=buildTranscript,makeMinutes=generateMinutes,storeMinutes=saveMinutes,
  now=()=>new Date(),
}={}) {
  const meeting=parseMeetingUrl(meetingUrl);
  if(authorized!==true || recordingConsentConfirmed!==true || live!==true)
    throw new Error('CONSENT_AND_AUTHORIZED_MEETING_REQUIRED');
  if(!Number.isFinite(durationSeconds) || durationSeconds<5 || durationSeconds>28800)
    throw new Error('MEETING_DURATION_OUT_OF_RANGE');
  if(!Array.isArray(routes) || routes.length===0 || routes.some(r=>!['edge','chrome'].includes(r)))
    throw new Error('RESIDENT_AUDIO_REQUIRES_APPROVED_BROWSER_ROUTE');
  if(os.freemem() < 450*1024*1024)throw new Error('INSUFFICIENT_FREE_MEMORY_FOR_MEETING');
  const dir=resolve(privateBase);
  const locks=join(dir,'locks');
  await mkdir(locks,{recursive:true});
  const lockpath=join(locks,meeting.meetingHash+'.lock');
  let lock;
  try {lock=await open(lockpath,'wx',0o600);}
  catch(e){if(e.code==='EEXIST')throw new Error('SAME_MEETING_ALREADY_RUNNING');throw e;}
  let session=null;
  let captureWorker=null;
  let adapter=null;
  let monitorAbort=null;
  let stopped=false;
  const emit=async(state,extra={})=>{
    if(!session)return;
    const entry={at:now().toISOString(),meetingHash:meeting.meetingHash,state,...extra};
    await writeFile(join(session,'events.jsonl'),JSON.stringify(entry)+'\n',{flag:'a',mode:0o600});
  };
  try {
    await lock.writeFile(JSON.stringify({pid:process.pid,started_at:now().toISOString()}));
    const performer=engine || new ParticipationEngine({adapters});
    const joined=await performer.join({
      meetingUrl,authorized,recordingConsentConfirmed,live,
      routes,allowBillable:false,joinTimeoutMs:90000,
      displayName:'Music Japan AI (meeting notetaker)',
    });
    adapter=adapters[joined.route]||null;
    let admitted=joined;
    if(joined.status==='WAITING_ADMISSION') {
      if(typeof adapter?.awaitAdmission!=='function')throw new Error('ADMISSION_WATCHER_UNAVAILABLE');
      const outcome=await adapter.awaitAdmission({maxLobbyMs:20*60*1000});
      if(outcome.state==='JOINED' && outcome.proof?.type==='IN_CALL_LEAVE_CONTROL'){
        admitted={...joined,status:'JOINED_VERIFIED',proof:outcome.proof};
      } else throw new Error('LOBBY_NOT_ADMITTED');
    }
    if(admitted.status!=='JOINED_VERIFIED')throw new Error('JOIN_NOT_VERIFIED');
    if(typeof adapter?.maintain!=='function')throw new Error('NO_RESIDENT_SESSION_MONITOR');
    session=join(dir,meeting.meetingHash+'-'+randomUUID().slice(0,8));
    await emit('JOINED_UI_VERIFIED',{route:admitted.route});
    const stopFile=join(dir,'record-stop-'+meeting.meetingHash+'.flag');
    try{await rm(stopFile,{force:true});}catch{}
    const recordArgs=['--output-dir',session,'--duration',String(durationSeconds),'--stop-file',stopFile,'--authorized','--consent'];
    if(includeMicrophone)recordArgs.push('--microphone');
    captureWorker=await recordWorker('record.py',recordArgs);
    monitorAbort=new AbortController();
    const monitored=adapter.maintain({signal:monitorAbort.signal,maxSessionMs:durationSeconds*1000})
      .then(value=>({kind:'monitor',value}),()=>({kind:'monitor',value:{state:'MONITOR_ERROR'}}));
    const recorded=captureWorker.done.then(value=>({kind:'recording',value}),()=>({kind:'recording',value:{exit:2}}));
    const first=await Promise.race([monitored,recorded]);
    if(first.kind==='monitor'){
      await writeFile(stopFile,'STOP\n',{flag:'wx',mode:0o600});
    } else monitorAbort.abort();
    const recordedResult=first.kind==='recording'?first.value:
      await Promise.race([captureWorker.done,delay(18000).then(()=>({exit:99}))]);
    if(recordedResult.exit===99){
      captureWorker.child.kill();
      throw new Error('RECORDING_STOP_TIMEOUT');
    }
    monitorAbort.abort();
    const capture=recordedResult.result;
    await emit('RECORDER_FINISHED',{status:capture?.status});
    if(recordedResult.exit!==0 || capture?.status!=='CAPTURE_COMPLETED')
      throw new Error('AUDIO_CAPTURE_FAILED');
    const manifest=join(session,'manifest.json');
    const prepared=await prepare(manifest);
    await emit('AUDIO_PREPARED');
    let transcript=null,minutes=null;
    if(sttProvider){
      const res=await transcribe({
        preparedManifestPath:prepared,provider:sttProvider,
        allowBillable,cloudConsent,
      });
      await emit('TRANSCRIPTION_COMPLETE',{segmentCount:res.segments});
      transcript=JSON.parse(await readFile(join(session,'transcript.json'),'utf8'));
      minutes=await makeMinutes({transcript,provider:minutesProvider,cloudConsent,allowBillable});
      await storeMinutes({sessionFolder:session,transcript,minutes});
      await emit('MINUTES_DRAFT_CREATED',{provider:minutesProvider});
    } else await emit('AWAITING_STT_CONFIGURATION');
    return {
      status:classifySessionOutcome(admitted,capture,transcript,minutes),
      session,meetingHash:meeting.meetingHash,platform:meeting.platform,
      audioTracks:capture.tracks,sttProvider:sttProvider||null,
      draftFile:minutes?join(session,'minutes.draft.json'):null,
      caveat:'UI admission alone is not proof of microphone and remote speech quality.',
    };
  } finally {
    if(monitorAbort)monitorAbort.abort();
    if(captureWorker?.child && !captureWorker.child.killed && captureWorker.child.exitCode===null){
      try {captureWorker.child.kill();}catch{}
    }
    if(adapter?.close)await adapter.close().catch(()=>{});
    await lock?.close();
    await rm(lockpath,{force:true});
  }
}
