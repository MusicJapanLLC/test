import { generateText, streamText } from 'ai';

const MODEL = 'openai/gpt-5.6-sol';
const FOUNDRY_SYSTEM = `You are AI FOUNDRY CORE: an elite AI-development engineer... (省略: 既存のシステムプロンプトを維持)`;

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function sanitizeMessages(input, limit = 34) {
  if (!Array.isArray(input)) return [];
  return input.slice(-limit).flatMap((m) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return [];
    const content = m.content.trim().slice(0, 28000);
    return content ? [{ role: m.role, content }] : [];
  });
}

// GitHub API連携用のユーティリティ
async function githubAction(action, params) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured');
  
  const { repo, owner, branch = 'main' } = params;
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  if (action === 'commit') {
    // 実装簡略化のため、既存のファイルを更新するロジックの骨組み
    const { path, content, message } = params;
    const getFile = await fetch(`${baseUrl}/contents/${path}?ref=${branch}`, { headers });
    const fileData = await getFile.json();
    return await fetch(`${baseUrl}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha: fileData.sha, branch })
    });
  }
  
  if (action === 'merge') {
    const { head, base } = params;
    return await fetch(`${baseUrl}/merges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base, head, commit_message: `Merge ${head} into ${base}` })
    });
  }
}

async function runRuntimeStream(payload, res) {
  const systemPrompt = typeof payload.systemPrompt === 'string' ? payload.systemPrompt.trim().slice(0, 32000) : '';
  const messages = sanitizeMessages(payload.messages, 34);
  
  // 推論経過を表示するためのストリーミングレスポンス設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const result = await streamText({
    model: MODEL,
    system: `${systemPrompt}\n\nExecution preference: prioritize useful task completion. Show your reasoning steps clearly.`,
    messages,
    temperature: 0.18
  });

  for await (const delta of result.fullStream) {
    if (delta.type === 'text-delta') {
      res.write(`data: ${JSON.stringify({ type: 'step', content: delta.textDelta })}\n\n`);
    }
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  const payload = body(req);
  const action = typeof payload.action === 'string' ? payload.action : '';

  try {
    if (action === 'runtime' && payload.stream) {
      return await runRuntimeStream(payload, res);
    }
    if (action === 'github') {
      const result = await githubAction(payload.githubAction, payload.params);
      return send(res, 200, { success: true, data: await result.json() });
    }
    // ... (既存のaction分岐: chat, title, build, smoke, runtime(non-stream))
    if (action === 'chat') return send(res, 200, await runChat(payload));
    if (action === 'runtime') return send(res, 200, await runRuntime(payload));
    return send(res, 400, { error: 'unknown action' });
  } catch (err) {
    console.error('AI FOUNDRY API error', err);
    return send(res, 500, { error: err.message });
  }
}