import { generateText } from 'ai';

const MODEL = 'openai/gpt-5.6-sol';
const FOUNDRY_SYSTEM = `You are AI FOUNDRY CORE, a high-performance AI engineer specialized in designing, implementing, evaluating, debugging and evolving AI systems. Preserve user intent and maximize useful degrees of freedom in model choice, system prompts, tools, memory, RAG, agents, orchestration, code architecture, evaluation and deployment. Do not add arbitrary restrictions just because a design is powerful. Be concrete, technical and implementation-oriented. Prefer runnable code, interfaces, tests and measurable verification over vague prose. Never claim an external action, write, deployment, test result or model-weight change happened unless it actually happened. Real authentication and permission boundaries of target systems still apply. Use the loop FRAME -> ARCHITECT -> BUILD -> VERIFY -> CHALLENGE -> MEASURE -> ITERATE. Reuse existing THE WORLD assets when relevant: Brainbase, GitHub, Agent Factory, Senju, Supabase, Vercel, Context.dev/Exa, AI Security, QA and Arena Judge. If the user writes Japanese, answer primarily in Japanese.`;

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

function sanitizeMessages(input, limit = 30) {
  if (!Array.isArray(input)) return [];
  return input.slice(-limit).flatMap((m) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return [];
    const content = m.content.trim().slice(0, 24000);
    return content ? [{ role: m.role, content }] : [];
  });
}

function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validSpec(x) {
  return x && typeof x === 'object' && typeof x.name === 'string' && typeof x.description === 'string' && typeof x.systemPrompt === 'string' && Array.isArray(x.capabilities) && Array.isArray(x.starterPrompts);
}

async function runChat(payload) {
  const messages = sanitizeMessages(payload.messages);
  if (!messages.length) throw new Error('messages required');
  const { text } = await generateText({ model: MODEL, system: FOUNDRY_SYSTEM, messages });
  return { text: text.trim(), model: MODEL };
}

async function runTitle(payload) {
  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 4000) : '';
  if (!text) throw new Error('text required');
  const result = await generateText({
    model: MODEL,
    system: 'Generate a single concise Japanese thread title for an AI-development conversation. No quotes. One line only. Aim for 8-24 Japanese characters while preserving important product or technology names.',
    prompt: text
  });
  return { title: result.text.replace(/[\r\n]+/g, ' ').replace(/^["「]|["」]$/g, '').trim().slice(0, 48) || 'AI開発' };
}

async function runBuild(payload) {
  const messages = sanitizeMessages(payload.messages, 36);
  if (!messages.some((m) => m.role === 'user')) throw new Error('development conversation required');
  const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const prompt = `Convert the following AI-development conversation into one directly runnable conversational AI specification. Preserve the user's intended capability and freedom. Do not weaken the product with unnecessary restrictions. The systemPrompt should be detailed, operational and suitable to use directly as the generated AI's system instruction. Return ONLY strict JSON with this exact shape:\n{\n  "name": "short name",\n  "description": "what this AI does",\n  "systemPrompt": "full production system prompt",\n  "capabilities": ["capability"],\n  "starterPrompts": ["starter prompt"],\n  "freedomProfile": "how broadly this AI should interpret and execute instructions",\n  "testPrompt": "one useful smoke-test prompt"\n}\n\nConversation:\n${transcript}`;
  const result = await generateText({ model: MODEL, system: FOUNDRY_SYSTEM, prompt });
  const spec = extractJson(result.text);
  if (!validSpec(spec)) throw new Error('invalid build spec');
  return {
    spec: {
      name: spec.name.trim().slice(0, 80),
      description: spec.description.trim().slice(0, 1200),
      systemPrompt: spec.systemPrompt.trim().slice(0, 32000),
      capabilities: spec.capabilities.map(String).map((v) => v.slice(0, 220)).slice(0, 20),
      starterPrompts: spec.starterPrompts.map(String).map((v) => v.slice(0, 400)).slice(0, 8),
      freedomProfile: String(spec.freedomProfile || '').trim().slice(0, 1200),
      testPrompt: String(spec.testPrompt || 'あなたの役割と、実行できる具体的なタスクを1つ示して').trim().slice(0, 800),
      model: MODEL,
      builtAt: new Date().toISOString()
    },
    model: MODEL
  };
}

async function runSmoke(payload) {
  const spec = payload.spec;
  if (!validSpec(spec)) throw new Error('valid spec required');
  const prompt = typeof spec.testPrompt === 'string' && spec.testPrompt.trim() ? spec.testPrompt.trim().slice(0, 1000) : 'あなたの役割を簡潔に説明し、実行できる具体的なタスクを1つ示して';
  const result = await generateText({ model: MODEL, system: `${spec.systemPrompt}\n\nFREEDOM PROFILE:\n${spec.freedomProfile || ''}`, prompt });
  const text = result.text.trim();
  return { pass: text.length >= 40, output: text.slice(0, 3000), model: MODEL };
}

async function runRuntime(payload) {
  const systemPrompt = typeof payload.systemPrompt === 'string' ? payload.systemPrompt.trim().slice(0, 32000) : '';
  const messages = sanitizeMessages(payload.messages, 30);
  if (!systemPrompt || !messages.length) throw new Error('systemPrompt and messages required');
  const result = await generateText({ model: MODEL, system: systemPrompt, messages });
  return { text: result.text.trim(), model: MODEL };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
  const payload = body(req);
  const action = typeof payload.action === 'string' ? payload.action : '';
  try {
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
