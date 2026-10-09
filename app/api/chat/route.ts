import { NextRequest } from 'next/server';
import { pickModel, suggestTier, SYSTEM_PERSONA, type ReasoningTier } from '../../lib/models';

export const runtime = 'edge';

type Msg = { role: 'user' | 'assistant'; content: string };
const enc = new TextEncoder();
const line = (obj: unknown) => enc.encode(JSON.stringify(obj) + '\n');

/**
 * 推論モデルのストリーミング・チャット（NDJSON出力）。
 * 各行 = {type:'thinking'|'text'|'error', text:string}。
 * 拡張思考(extended thinking)を有効化し、推論中の内容も逐次返す。
 * ANTHROPIC_API_KEY 未設定時は案内を1行返す（UIは壊れない）。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
  const tier: ReasoningTier = body.tier ?? suggestTier(messages.at(-1)?.content ?? '');
  const spec = pickModel(tier);
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    const text =
      `このコンソールの頭脳は Claude Code セッション側で動かす設計です（単体サイト用のLLM鍵は未配線）。` +
      `右パネルの検出モジュールと「AUTO-ASSESS（自律診断）」は鍵なしで動きます。` +
      `対象を選んで AUTO-ASSESS を押すと、認可レンジに検出手法を計画順で自動連鎖実行し、重大度順の統合レポートを出します。`;
    return new Response(line({ type: 'text', text }), {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
    });
  }

  const wantThinking = tier === 'deep' || tier === 'balanced';
  const budget = Math.min(spec.reasoningBudget, 24000);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: spec.model,
      max_tokens: (wantThinking ? budget : 0) + 4096,
      stream: true,
      system: SYSTEM_PERSONA + `\n\n認可済みテスト対象以外への能動的操作は提案しない。`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(wantThinking ? { thinking: { type: 'enabled', budget_tokens: budget } } : {}),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response(line({ type: 'error', text: `上流エラー (${upstream.status}): ${detail.slice(0, 600)}` }), {
      status: 200,
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      let buf = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const l of lines) {
            const t = l.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const ev = JSON.parse(payload);
              if (ev.type === 'content_block_delta') {
                if (ev.delta?.type === 'text_delta') controller.enqueue(line({ type: 'text', text: ev.delta.text }));
                else if (ev.delta?.type === 'thinking_delta') controller.enqueue(line({ type: 'thinking', text: ev.delta.thinking }));
              }
            } catch {
              /* 不完全チャンクは次バッファで回収 */
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
