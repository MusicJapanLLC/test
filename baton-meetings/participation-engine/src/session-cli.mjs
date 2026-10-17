#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runMeetingSession} from './session.mjs';

const args=process.argv.slice(2);
const option=name=>{const p=args.indexOf(name);return p<0?null:args[p+1]||null;};
const has=name=>args.includes(name);
async function main() {
  if(args[0]!=='run') {
    console.log(JSON.stringify({
      usage:'node src/session-cli.mjs run --url-file PRIVATE_MEETING_URL_FILE --duration 3600 --authorized --consent --routes edge,chrome --stt-provider openai --cloud-consent --allow-billable --microphone',
      note:'Actual hosted meeting with participant notice/consent only. Never logs invite URL or credentials.',
    },null,2));
    return;
  }
  const file=option('--url-file');
  if(!file)throw Error('PRIVATE_MEETING_URL_FILE_REQUIRED');
  const meetingUrl=(await readFile(resolve(file),'utf8')).trim();
  const routes=option('--routes')?.split(',').filter(Boolean)||['edge','chrome'];
  const result=await runMeetingSession({
    meetingUrl,authorized:has('--authorized'),
    recordingConsentConfirmed:has('--consent'),live:has('--live'),
    routes,
    durationSeconds:Number(option('--duration')||1800),
    includeMicrophone:!has('--no-microphone'),
    sttProvider:option('--stt-provider'),
    minutesProvider:option('--minutes-provider')||'extractive',
    cloudConsent:has('--cloud-consent'),
    allowBillable:has('--allow-billable'),
  });
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='MINUTES_DRAFT_READY_FOR_HUMAN_REVIEW')process.exitCode=3;
}
main().catch(e=>{
  // Don't print third-party meeting URL, audio or untrusted exception details.
  const code=/^[A-Z0-9_]{3,140}$/.test(e?.message||'')?e.message:'SESSION_FAILED';
  console.error(JSON.stringify({status:'ERROR',code}));
  process.exitCode=2;
});
