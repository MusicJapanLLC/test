import os from 'node:os';
import { join, resolve } from 'node:path';
import { readFile, open, mkdir, rm } from 'node:fs/promises';
import { parseMeetingUrl, defaultRoutes, createAuditWriter, ParticipationEngine } from './core.mjs';
import { createAdapters } from './adapters.mjs';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
function value(flag) {
  const i = argv.indexOf(flag);
  return i < 0 ? null : argv[i + 1] || null;
}
function publicJson(data) { process.stdout.write(JSON.stringify(data, null, 2) + '\n'); }
function help() {
  process.stdout.write([
    'Music Japan Meeting Participation Engine',
    '  node src/cli.mjs doctor',
    '  node src/cli.mjs plan --url-file PRIVATE_URL_FILE',
    '  node src/cli.mjs join --url-file PRIVATE_URL_FILE --authorized --consent --live',
    '       [--allow-billable] [--routes browser,recall,desktop] [--browser-channel msedge]',
    'The URL file stays on the local machine, outside Git. No actual join without 3 consent flags.',
    'Never send passwords, account tokens, or invite URLs to GitHub or issue comments.',
  ].join('\n') + '\n');
}
async function main() {
  const command = argv[0];
  if (!command || has('--help') || command === 'help') return help();
  const adapters = createAdapters();
  if (command === 'doctor') {
    const memoryMiB = Math.round(os.freemem() / 1048576);
    const checks = {};
    for (const [route, adapter] of Object.entries(adapters)) {
      checks[route] = await adapter.probe({ allowBillable: has('--allow-billable') });
    }
    publicJson({
      os: os.platform(), node: process.version,
      freeMemoryMiB: memoryMiB,
      routes: checks,
      recallKeyPresent: Boolean(process.env.RECALL_API_KEY),
      recallRegionPresent: Boolean(process.env.RECALL_REGION),
      browserModuleOverride: Boolean(process.env.MJ_PLAYWRIGHT_MODULE),
      caveat: 'Doctor never joins or records a meeting.',
    });
    return;
  }
  if (!['plan', 'join'].includes(command)) throw new Error('UNKNOWN_COMMAND');
  const urlFile = value('--url-file');
  if (!urlFile) throw new Error('PRIVATE_MEETING_URL_FILE_REQUIRED');
  const meetingUrl = (await readFile(resolve(urlFile), 'utf8')).trim();
  const meeting = parseMeetingUrl(meetingUrl);
  const routeList = value('--routes')?.split(',') || defaultRoutes(meeting.platform);
  const profile = value('--browser-profile') ||
    join(process.env.LOCALAPPDATA || os.tmpdir(), 'MusicJapan', 'MeetingRunner', 'profiles', meeting.platform);
  if (command === 'plan') {
    publicJson({ platform: meeting.platform, meetingHash: meeting.meetingHash, routes: routeList, dryRun: true });
    return;
  }
  const stateDir = join(process.env.LOCALAPPDATA || os.tmpdir(), 'MusicJapan', 'MeetingRunner', 'state');
  await mkdir(stateDir, { recursive: true });
  const lockPath = join(stateDir, meeting.meetingHash + '.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (e) { if (e?.code === 'EEXIST') throw new Error('MEETING_ALREADY_LOCKED'); throw e; }
  try {
    await lock.writeFile(JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid }));
    const runner = new ParticipationEngine({
      adapters,
      audit: createAuditWriter(join(stateDir, 'attempts.jsonl')),
    });
    const params = {
      meetingUrl,
      live: has('--live'),
      authorized: has('--authorized'),
      recordingConsentConfirmed: has('--consent'),
      allowBillable: has('--allow-billable'),
      routes: routeList,
      browserChannel: value('--browser-channel') || 'msedge',
      browserProfile: profile,
      joinTimeoutMs: Number(value('--timeout-ms')) || 90000,
    };
    let reconnects = 0;
    while (true) {
      const result = await runner.join(params);
      publicJson(result);
      if (result.status !== 'JOINED_VERIFIED') {
        process.exitCode = 2;
        break;
      }
      if (result.route !== 'browser') break; // Hosted Recall bot has its own lifecycle.
      const abort = new AbortController();
      const stop = () => abort.abort();
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      let sessionResult;
      try {
        sessionResult = await adapters.browser.maintain({ signal: abort.signal });
        publicJson({ phase: 'RESIDENT_SESSION_ENDED', ...sessionResult });
      } finally {
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
        await adapters.browser.close();
      }
      if (sessionResult?.state === 'SESSION_DISCONNECTED' && reconnects < 2 && !has('--no-reconnect')) {
        reconnects++;
        continue; // Only after the old browser has been closed.
      }
      if (sessionResult?.state !== 'OPERATOR_STOPPED') process.exitCode = 3;
      break;
    }
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
main().catch((e) => {
  // Never expose URL, key or browser exception text.
  process.stderr.write('Meeting Runner: ' + (e.code || e.message?.match(/^[A-Z_]+$/)?.[0] || 'OPERATION_FAILED') + '\n');
  process.exitCode = 1;
});
