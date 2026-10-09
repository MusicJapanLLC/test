import { NextRequest } from 'next/server';
import { listTools, execute, type ToolCategory, type Finding } from '../../lib/tools';
import { checkScope } from '../../lib/targets';
import '../../lib/modules/recon';
import '../../lib/modules/web';
import '../../lib/modules/deep';

export const runtime = 'nodejs';
const enc = new TextEncoder();
const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 自律アセスメントの実行順（攻撃者の進め方: 表面把握 → 設定/認証 → 動的プローブ）
const ORDER: ToolCategory[] = ['recon', 'web', 'fuzzing', 'injection'];
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * POST {url} : 認可済みターゲットに対し、登録済み検出モジュールを計画順に自動実行し、
 * 進捗をNDJSONでストリーム、最後に重大度順の統合レポートを返す。
 * 鍵不要（決定論的オーケストレーション）。スコープ外は実行前に拒否。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? '');
  const scope = checkScope(url);
  if (!scope.inScope) {
    return new Response(line({ type: 'error', text: `スコープ外: ${'reason' in scope ? scope.reason : ''}` }), {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
    });
  }

  const tools = [...listTools()].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  const delay = Math.max(60, Math.floor(1000 / Math.max(1, scope.rateLimitRps)));

  const stream = new ReadableStream({
    async start(controller) {
      const all: (Finding & { tool: string })[] = [];
      controller.enqueue(line({ type: 'plan', total: tools.length, order: ORDER, target: url }));
      for (let i = 0; i < tools.length; i++) {
        const t = tools[i];
        controller.enqueue(line({ type: 'progress', i: i + 1, total: tools.length, tool: t.id, label: t.label, status: 'running' }));
        try {
          const r = await execute(t.id, url);
          (r.findings ?? []).forEach((f) => all.push({ ...f, tool: t.id }));
          controller.enqueue(line({ type: 'progress', i: i + 1, total: tools.length, tool: t.id, label: t.label, status: r.ok ? 'done' : 'error', summary: r.ok ? r.summary : r.error, findings: (r.findings ?? []).length }));
        } catch (e) {
          controller.enqueue(line({ type: 'progress', i: i + 1, total: tools.length, tool: t.id, label: t.label, status: 'error', summary: (e as Error).message }));
        }
        await sleep(delay);
      }
      all.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
      const counts: Record<string, number> = {};
      for (const f of all) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
      controller.enqueue(line({ type: 'report', target: url, modules: tools.length, total: all.length, counts, findings: all }));
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
