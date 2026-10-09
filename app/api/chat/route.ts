import { NextRequest } from 'next/server';
import { pickModel, suggestTier, SYSTEM_PERSONA, type ReasoningTier } from '../../lib/models';

export const runtime = 'nodejs';

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * 推論モデルのストリーミング・チャット。
 * Anthropic Messages API に直接 SSE 接続し、テキスト差分をそのまま流す。
 * ANTHROPIC_API_KEY 未設定時は、鍵投入を促す説明を1回返す（UIは壊れない）。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
  const tier: ReasoningTier = body.tier ?? suggestTier(messages.at(-1)?.content ?? '');
  const spec = pickModel(tier);
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    const text =
      `【モデル未配線】ANTHROPIC_API_KEY が未設定です。\n` +
      `.env に ANTHROPIC_API_KEY を入れると ${spec.label}（${spec.model}）が応答します。\n` +
      `UI・認可ゲート・recon実行は鍵なしでも動作します。`;
    return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: spec.model,
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PERSONA + `\n\n認可済みテスト対象以外への能動的操作は提案しない。`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return new Response(`上流エラー (${upstream.status}): ${detail.slice(0, 500)}`, {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  // Anthropic SSE から text_delta だけを抜き出してプレーンテキストで流す。
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
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
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]' || !payload) continue;
            try {
              const ev = JSON.parse(payload);
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(ev.delta.text));
              }
            } catch {
              /* 不完全なチャンクは次のバッファで回収 */
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
