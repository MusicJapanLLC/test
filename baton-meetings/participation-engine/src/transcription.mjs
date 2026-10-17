import { createHash } from 'node:crypto';
import { readFile, realpath, mkdir, writeFile, rename, stat, rm } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';

export class AudioPipelineError extends Error {
  constructor(code) { super(code); this.code = code; this.name = 'AudioPipelineError'; }
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(done => setTimeout(done, ms));
function cleanSpeaker(raw) {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < 10000) return String(raw);
  if (typeof raw === 'string' && /^[a-z0-9_-]{1,35}$/i.test(raw)) return raw;
  return 'UNKNOWN';
}
function segment(start, end, text, speaker, confidence) {
  if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end)) ||
      +end <= +start || +start < 0 || +end > 50000 ||
      typeof text !== 'string' || text.trim().length === 0) return null;
  return {
    start:+start, end:+end, text:text.trim().slice(0,20000), speaker:cleanSpeaker(speaker),
    confidence:Number.isFinite(Number(confidence)) && confidence !== undefined && confidence !== null
      ? Math.min(Math.max(Number(confidence),0),1) : null,
  };
}
export function normalizeOpenAI(raw) {
  return (Array.isArray(raw?.segments) ? raw.segments : [])
    .map(s => segment(s.start,s.end,s.text,s.speaker,s.confidence)).filter(Boolean);
}
export function normalizeDeepgram(raw) {
  const u = raw?.results?.utterances;
  return (Array.isArray(u) ? u : [])
    .map(s => segment(s.start,s.end,s.transcript,s.speaker,s.confidence)).filter(Boolean);
}
export function normalizeAssemblyAI(raw) {
  return (Array.isArray(raw?.utterances) ? raw.utterances : [])
    .map(s => segment(Number(s.start)/1000,Number(s.end)/1000,s.text,s.speaker,s.confidence)).filter(Boolean);
}
async function ensureHttpJson(res, provider) {
  if ([401,403].includes(res.status)) throw new AudioPipelineError(provider+'_AUTH_FAILED');
  if (res.status === 429) throw new AudioPipelineError(provider+'_RATE_LIMITED');
  if (!res.ok) throw new AudioPipelineError(provider+'_HTTP_'+String(res.status));
  try { return await res.json(); }
  catch { throw new AudioPipelineError(provider+'_INVALID_JSON'); }
}
export async function providerTranscribe({provider,bytes,filename,http=fetch,env=process.env,pause=sleep}) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 44 || bytes.length > 24000000)
    throw new AudioPipelineError('AUDIO_FILE_SIZE_INVALID');
  const params = {method:'POST',signal:AbortSignal.timeout(180000)};
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) throw new AudioPipelineError('OPENAI_API_KEY_MISSING');
    const form = new FormData();
    form.set('file',new Blob([bytes],{type:'audio/wav'}),basename(filename));
    form.set('model','gpt-4o-transcribe-diarize');
    form.set('response_format','diarized_json');
    form.set('chunking_strategy','auto');
    const data = await ensureHttpJson(await http('https://api.openai.com/v1/audio/transcriptions',{
      ...params,headers:{Authorization:'Bearer '+env.OPENAI_API_KEY},body:form,
    }),'OPENAI');
    return normalizeOpenAI(data);
  }
  if (provider === 'deepgram') {
    if (!env.DEEPGRAM_API_KEY) throw new AudioPipelineError('DEEPGRAM_API_KEY_MISSING');
    const url = new URL('https://api.deepgram.com/v1/listen');
    for (const [k,v] of Object.entries({
      diarize_model:'latest',utterances:'true',punctuate:'true',
      smart_format:'true',detect_language:'true',
    })) url.searchParams.set(k,v);
    const data = await ensureHttpJson(await http(url,{
      ...params,headers:{Authorization:'Token '+env.DEEPGRAM_API_KEY,'Content-Type':'audio/wav'},
      body:bytes,
    }),'DEEPGRAM');
    return normalizeDeepgram(data);
  }
  if (provider === 'assemblyai') {
    if (!env.ASSEMBLYAI_API_KEY) throw new AudioPipelineError('ASSEMBLYAI_API_KEY_MISSING');
    const headers = {Authorization:env.ASSEMBLYAI_API_KEY};
    const upload = await ensureHttpJson(await http('https://api.assemblyai.com/v2/upload',{
      ...params,headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes,
    }),'ASSEMBLYAI');
    if (!upload?.upload_url || !/^https:\/\/(?:.*\.)?assemblyai\.com\//i.test(upload.upload_url))
      throw new AudioPipelineError('ASSEMBLYAI_UPLOAD_INVALID');
    const created = await ensureHttpJson(await http('https://api.assemblyai.com/v2/transcript',{
      ...params,headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({audio_url:upload.upload_url,speaker_labels:true,
        speech_models:['universal-3-pro','universal-2'],language_detection:true}),
    }),'ASSEMBLYAI');
    if (typeof created?.id !== 'string' || !/^[a-zA-Z0-9_-]{8,150}$/.test(created.id))
      throw new AudioPipelineError('ASSEMBLYAI_ID_INVALID');
    for (let i=0;i<90;i++) {
      await pause(4000);
      const result = await ensureHttpJson(await http(
        'https://api.assemblyai.com/v2/transcript/'+encodeURIComponent(created.id),
        {headers,signal:AbortSignal.timeout(15000)}),'ASSEMBLYAI');
      if (result.status === 'completed') return normalizeAssemblyAI(result);
      if (result.status === 'error') throw new AudioPipelineError('ASSEMBLYAI_TRANSCRIPTION_FAILED');
    }
    throw new AudioPipelineError('ASSEMBLYAI_TIMEOUT');
  }
  throw new AudioPipelineError('UNSUPPORTED_TRANSCRIPTION_PROVIDER');
}
export function normalizeAllSegments(groups) {
  const merged=[];
  for (const {chunk,segments} of groups) {
    if (!['remote','local_mic'].includes(chunk?.source)) throw new AudioPipelineError('CHUNK_ROLE_INVALID');
    for (const s of segments) {
      const start=Number(chunk.absolute_start_s)+s.start;
      const end=Number(chunk.absolute_start_s)+s.end;
      if (!Number.isFinite(start) || !Number.isFinite(end) || !(start<end)) continue;
      const speakerId=chunk.source+'@'+chunk.chunk_id+':'+cleanSpeaker(s.speaker);
      const evidenceId='seg_'+sha(chunk.sha256+':'+start.toFixed(3)+':'+end.toFixed(3)+':'+s.text).slice(0,24);
      merged.push({
        evidence_id:evidenceId,chunk_id:chunk.chunk_id,source:chunk.source,
        start_s:Math.round(start*1000)/1000,end_s:Math.round(end*1000)/1000,
        speaker_id:speakerId,speaker_identity:'unverified',
        text:s.text,confidence:s.confidence,
      });
    }
  }
  merged.sort((a,b)=>a.start_s-b.start_s || a.end_s-b.end_s || a.source.localeCompare(b.source));
  const result=[];
  for (const row of merged) {
    const duplicate=result.some(prev=>prev.source===row.source &&
      Math.abs(prev.start_s-row.start_s)<1.15 &&
      prev.text.trim().toLowerCase()===row.text.trim().toLowerCase());
    if (!duplicate) result.push(row);
  }
  return result;
}
async function persistAtomic(path,data) {
  const temp=path+'.partial-'+process.pid;
  await writeFile(temp,data,{encoding:'utf8',mode:0o600,flag:'wx'});
  await rename(temp,path);
}
export async function buildTranscript({
  preparedManifestPath,provider,allowBillable,cloudConsent,http=fetch,env=process.env,pause=sleep,
}={}) {
  if (allowBillable !== true || cloudConsent !== true)
    throw new AudioPipelineError('EXTERNAL_STT_REQUIRES_CLOUD_CONSENT_AND_BILLING_AUTHORIZATION');
  if (!['openai','deepgram','assemblyai'].includes(provider))
    throw new AudioPipelineError('UNSUPPORTED_TRANSCRIPTION_PROVIDER');
  const manifestPath=await realpath(preparedManifestPath);
  const folder=dirname(manifestPath);
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  if (manifest.schema_version!==1 || !Array.isArray(manifest.chunks) || manifest.chunks.length===0)
    throw new AudioPipelineError('PREPARED_MANIFEST_INVALID');
  const capture=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
  if (capture.consent_confirmed_by_operator!==true) throw new AudioPipelineError('RECORDING_CONSENT_MISSING');
  const preparedDir=await realpath(join(folder,'prepared'));
  const checkpoints=join(folder,'transcription-checkpoints');
  await mkdir(checkpoints,{recursive:true});
  const groups=[];
  for (const chunk of manifest.chunks) {
    if (typeof chunk.chunk_id!=='string' || !/^(remote|local_mic)-\d{5}$/.test(chunk.chunk_id) ||
      typeof chunk.file!=='string' || basename(chunk.file)!==chunk.file)
      throw new AudioPipelineError('CHUNK_ID_INVALID');
    const audioPath=await realpath(join(preparedDir,chunk.file));
    if (dirname(audioPath)!==preparedDir) throw new AudioPipelineError('CHUNK_OUTSIDE_SESSION');
    const bytes=await readFile(audioPath);
    const digest=sha(bytes);
    if (digest!==chunk.sha256) throw new AudioPipelineError('CHUNK_HASH_MISMATCH');
    if (bytes.length>24000000) throw new AudioPipelineError('CHUNK_SIZE_EXCEEDED');
    const key=sha(provider+':'+chunk.chunk_id+':'+digest).slice(0,28);
    const done=join(checkpoints,key+'.json');
    const started=join(checkpoints,key+'.started.json');
    let segments;
    try {
      const cache=JSON.parse(await readFile(done,'utf8'));
      if (cache.chunk_id!==chunk.chunk_id || cache.audio_sha256!==digest || cache.provider!==provider ||
          !Array.isArray(cache.segments)) throw new AudioPipelineError('CHECKPOINT_MISMATCH');
      segments=cache.segments;
    } catch(error) {
      if (error instanceof AudioPipelineError) throw error;
      if (error?.code!=='ENOENT') throw new AudioPipelineError('CHECKPOINT_CORRUPT');
      try { await stat(started); throw new AudioPipelineError('UNCERTAIN_BILLABLE_JOB_REQUIRES_REVIEW'); }
      catch(err){ if (err.code!=='ENOENT') throw err; }
      await persistAtomic(started,JSON.stringify({provider,chunk_id:chunk.chunk_id,audio_sha256:digest,
        started_at:new Date().toISOString(),state:'CALL_STARTED_NOT_VERIFIED'}));
      try { segments=await providerTranscribe({provider,bytes,filename:chunk.file,http,env,pause}); }
      catch(e) {
        throw e instanceof AudioPipelineError ? e : new AudioPipelineError('PROVIDER_REQUEST_FAILED_REQUIRES_REVIEW');
      }
      if (!Array.isArray(segments) || !segments.length)
        throw new AudioPipelineError('EMPTY_TRANSCRIPTION_REQUIRES_REVIEW');
      await persistAtomic(done,JSON.stringify({
        provider,chunk_id:chunk.chunk_id,audio_sha256:digest,completed_at:new Date().toISOString(),segments,
      },null,2));
      await rm(started,{force:true});
    }
    groups.push({chunk,segments});
  }
  const normalized=normalizeAllSegments(groups);
  if (!normalized.length) throw new AudioPipelineError('NO_DIARIZED_SEGMENTS');
  const transcript={
    schema_version:1,status:'TRANSCRIBED_REQUIRES_HUMAN_REVIEW',
    created_at:new Date().toISOString(),provider,synthetic:false,
    recording_manifest_sha256:sha(await readFile(join(folder,'manifest.json'))),
    prepared_manifest_sha256:sha(await readFile(manifestPath)),
    speaker_identification:'anonymous_per_chunk_unless_confirmed',segments:normalized,
  };
  await persistAtomic(join(folder,'transcript.json'),JSON.stringify(transcript,null,2));
  return {status:transcript.status,segments:normalized.length,provider,file:join(folder,'transcript.json')};
}
