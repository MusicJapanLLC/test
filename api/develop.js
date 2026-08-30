import { generateText, stepCountIs, tool } from 'ai';
import { Sandbox } from '@vercel/sandbox';
import { z } from 'zod';
import path from 'node:path';

const MODEL = 'openai/gpt-5.6-sol';
const WORKDIR = '/vercel/sandbox';
const MAX_OUTPUT = 12000;
const MAX_FILE_BYTES = 220000;

const EXECUTOR_SYSTEM = `You are AI FOUNDRY EXECUTOR, an execution-capable coding agent running inside an isolated development sandbox.

Your job is to turn a software-development request into verified working changes, not merely describe code.

OPERATING LOOP
1. Inspect the task and current workspace.
2. Create or edit the minimum necessary files.
3. Run the relevant install/build/test/lint/smoke commands.
4. Debug failures to root cause and retry.
5. Never claim a build/test succeeded unless the command actually ran and returned evidence.
6. Prefer small complete vertical slices over broad unfinished scaffolding.
7. Keep all filesystem work inside the provided workspace.
8. You may install packages and use the network from the sandbox when useful.
9. Do not ask the user to run commands you can run yourself inside the sandbox.
10. Finish with: what changed, commands actually executed, verification result, and any remaining blocker.

Use tools aggressively when execution is useful. A response consisting only of suggested code when tools could verify it is a failure.`;

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function safeRelative(input) {
  const raw = String(input || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('path must stay inside the sandbox workspace');
  }
  return normalized;
}

function trimOutput(value, max = MAX_OUTPUT) {
  const text = String(value || '');
  return text.length > max ? `...<truncated>\n${text.slice(-max)}` : text;
}

async function commandResult(result) {
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  return {
    exitCode: Number(result.exitCode ?? -1),
    stdout: trimOutput(stdout),
    stderr: trimOutput(stderr),
  };
}

async function ensureParent(sandbox, fullPath) {
  const dir = path.posix.dirname(fullPath);
  const result = await sandbox.runCommand('mkdir', ['-p', dir]);
  if (Number(result.exitCode ?? 1) !== 0) throw new Error(`failed to create directory: ${dir}`);
}

function normalizedSeeds(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 80).map((file) => {
    const relativePath = safeRelative(file?.path);
    const content = String(file?.content ?? '');
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error(`seed file too large: ${relativePath}`);
    return { path: relativePath, content };
  });
}

async function runExecutor(payload) {
  const task = typeof payload.task === 'string' ? payload.task.trim().slice(0, 32000) : '';
  if (!task) throw new Error('task required');

  const requestedSteps = Number(payload.maxSteps || 12);
  const maxSteps = Number.isFinite(requestedSteps) ? Math.min(18, Math.max(3, Math.floor(requestedSteps))) : 12;
  const seeds = normalizedSeeds(payload.seedFiles);
  const events = [];
  const sandbox = await Sandbox.create({ timeout: 180_000 });

  try {
    for (const file of seeds) {
      const fullPath = path.posix.join(WORKDIR, file.path);
      await ensureParent(sandbox, fullPath);
      await sandbox.writeFile(fullPath, file.content);
      events.push({ tool: 'seedFile', path: file.path, bytes: Buffer.byteLength(file.content, 'utf8') });
    }

    const tools = {
      listFiles: tool({
        description: 'List project files in the sandbox workspace, excluding bulky dependency directories.',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await sandbox.runCommand('bash', ['-lc', `cd ${WORKDIR} && find . -maxdepth 5 -type f -not -path './node_modules/*' -not -path './.git/*' | sort | head -250`]);
          const out = await commandResult(result);
          events.push({ tool: 'listFiles', result: out });
          return out;
        },
      }),

      readFile: tool({
        description: 'Read a UTF-8 text file from the sandbox workspace.',
        inputSchema: z.object({ path: z.string().min(1).max(500) }),
        execute: async ({ path: requestedPath }) => {
          const relativePath = safeRelative(requestedPath);
          const result = await sandbox.runCommand('cat', [path.posix.join(WORKDIR, relativePath)]);
          const out = await commandResult(result);
          events.push({ tool: 'readFile', path: relativePath, result: out });
          return out;
        },
      }),

      writeFile: tool({
        description: 'Create or fully replace a UTF-8 text file in the sandbox workspace.',
        inputSchema: z.object({
          path: z.string().min(1).max(500),
          content: z.string().max(MAX_FILE_BYTES),
        }),
        execute: async ({ path: requestedPath, content }) => {
          const relativePath = safeRelative(requestedPath);
          const fullPath = path.posix.join(WORKDIR, relativePath);
          await ensureParent(sandbox, fullPath);
          await sandbox.writeFile(fullPath, content);
          const event = { tool: 'writeFile', path: relativePath, bytes: Buffer.byteLength(content, 'utf8') };
          events.push(event);
          return event;
        },
      }),

      runCommand: tool({
        description: 'Run a shell command inside the isolated sandbox workspace. Use this for package installation, build, test, lint, formatting, git inspection, and smoke checks.',
        inputSchema: z.object({ command: z.string().min(1).max(5000) }),
        execute: async ({ command }) => {
          const result = await sandbox.runCommand('bash', ['-lc', `cd ${WORKDIR} && ${command}`]);
          const out = await commandResult(result);
          events.push({ tool: 'runCommand', command, result: out });
          return out;
        },
      }),
    };

    const result = await generateText({
      model: MODEL,
      system: EXECUTOR_SYSTEM,
      prompt: task,
      tools,
      stopWhen: stepCountIs(maxSteps),
      temperature: 0.1,
    });

    const manifestResult = await sandbox.runCommand('bash', ['-lc', `cd ${WORKDIR} && find . -maxdepth 5 -type f -not -path './node_modules/*' -not -path './.git/*' | sort | head -250`]);
    const manifest = await commandResult(manifestResult);
    const executedCommands = events.filter((event) => event.tool === 'runCommand');

    return {
      ok: true,
      text: result.text.trim(),
      model: MODEL,
      profile: 'sandbox-executor-v1',
      maxSteps,
      events: events.slice(-80),
      files: manifest.stdout.split('\n').filter(Boolean),
      verification: {
        commandsRun: executedCommands.length,
        successfulCommands: executedCommands.filter((event) => event.result?.exitCode === 0).length,
        failedCommands: executedCommands.filter((event) => event.result?.exitCode !== 0).length,
      },
    };
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  try {
    const payload = requestBody(req);
    return send(res, 200, await runExecutor(payload));
  } catch (err) {
    console.error('AI FOUNDRY executor error', err);
    return send(res, 500, { error: err instanceof Error ? err.message : 'executor failed' });
  }
}
