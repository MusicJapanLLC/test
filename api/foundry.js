import { generateText, streamText } from 'ai';

const MODEL = 'openai/gpt-5.6-sol';
const FOUNDRY_SYSTEM = `You are AI FOUNDRY CORE: an elite AI-development engineer and implementation partner... (省略: 既存のシステムプロンプト)`;

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

// 推論プロセスをストリーミングで表示するためのハンドラー
async function runStreamingRuntime(payload, res) {
  const systemPrompt = typeof payload.systemPrompt === 'string' ? payload.systemPrompt.trim().slice(0, 32000) : '';
  const messages = sanitizeMessages(payload.messages, 34);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const result = await streamText({
    model: MODEL,
    system: `${systemPrompt}\n\nIMPORTANT: Show your reasoning steps clearly. Use 'THOUGHT:' prefix for internal logic and 'OUTPUT:' for final response.`,
    messages,
    temperature: 0.18,
  });

  for await (const delta of result.fullStream) {
    res.write(`data: ${JSON.stringify(delta)}\n\n`);
  }
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  const payload = body(req);
  const action = typeof payload.action === 'string' ? payload.action : '';

  try {
    if (action === 'stream_runtime') return await runStreamingRuntime(payload, res);
    if (action === 'chat') return send(res, 200, await runChat(payload));
    if (action === 'title') return send(res, 200, await runTitle(payload));
    if (action === 'build') return send(res, 200, await runBuild(payload));
    if (action === 'smoke') return send(res, 200, await runSmoke(payload));
    if (action === 'runtime') return send(res, 200, await runRuntime(payload));
    return send(res, 400, { error: 'unknown action' });
  } catch (err) {
    console.error('AI FOUNDRY API error', err);
    return send(res, 500, { error: err instanceof Error ? err.message : 'request failed' });
  }
}
