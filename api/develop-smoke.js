import { Sandbox } from '@vercel/sandbox';

const WORKDIR = '/vercel/sandbox';

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function commandResult(result) {
  return {
    exitCode: Number(result.exitCode ?? -1),
    stdout: String(await result.stdout() || '').trim(),
    stderr: String(await result.stderr() || '').trim(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET required' });
  let sandbox;
  try {
    sandbox = await Sandbox.create({ timeout: 60_000 });
    const markerPath = `${WORKDIR}/foundry-smoke.txt`;
    await sandbox.writeFile(markerPath, 'AI FOUNDRY SANDBOX OK');
    const fileWriteRead = await commandResult(await sandbox.runCommand('cat', [markerPath]));
    const commandExecution = await commandResult(await sandbox.runCommand('node', ['-e', "console.log('executor-node-ok:' + process.version)"]));
    const ok = fileWriteRead.exitCode === 0 && commandExecution.exitCode === 0 && fileWriteRead.stdout.includes('AI FOUNDRY SANDBOX OK');
    return send(res, ok ? 200 : 500, {
      ok,
      profile: 'sandbox-infrastructure-smoke-v1',
      fileWriteRead,
      commandExecution,
    });
  } catch (err) {
    console.error('AI FOUNDRY sandbox smoke error', err);
    return send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'sandbox smoke failed' });
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
}
