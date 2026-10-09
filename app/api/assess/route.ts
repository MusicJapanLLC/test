import { NextRequest } from 'next/server';
import { execute, type Finding } from '../../lib/tools';
import { checkScope } from '../../lib/targets';
import '../../lib/modules/recon';
import '../../lib/modules/web';
import '../../lib/modules/deep';

export const runtime = 'nodejs';
const enc = new TextEncoder();
const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// フェーズ別の手段セット（攻撃者の進め方を模した計画）
const PHASE1_RECON = ['recon.http-fingerprint', 'recon.tech-fingerprint', 'recon.http-methods', 'recon.robots-sitemap', 'recon.graphql-introspection', 'recon.dir-listing', 'fuzzing.content-discovery', 'recon.scope-verify'];
const PHASE2_WEB = ['web.cors-probe', 'web.cookie-audit', 'web.open-redirect', 'injection.reflection-probe', 'recon.verbose-errors'];
const FOLLOWUP = ['recon.http-fingerprint', 'recon.verbose-errors', 'injection.reflection-probe', 'web.cors-probe'];
const MAX_LEADS = 8;

// 発見したライブパスを次ラウンドの深掘り対象として抽出
function extractLeads(origin: string, rawByTool: Record<string, string>): string[] {
  const set = new Set<string>();
  const cd = rawByTool['fuzzing.content-discovery'] ?? '';
  for (const m of cd.matchAll(/^(200|401|403)\s+(\/\S+)/gm)) set.add(origin + m[2]);
  const rs = rawByTool['recon.robots-sitemap'] ?? '';
  for (const m of rs.matchAll(/https?:\/\/[^\s<]+/g)) { try { const u = new URL(m[0]); if (u.origin === origin) set.add(u.origin + u.pathname); } catch { /* skip */ } }
  for (const m of rs.matchAll(/Disallow:\s*(\/\S*)/gi)) if (m[1] && m[1] !== '/') set.add(origin + m[1]);
  set.delete(origin + '/');
  return [...set].slice(0, MAX_LEADS);
}

/**
 * POST {url} : 多段・適応型の自律アセスメント（鍵不要）。
 * Phase1 recon → リード抽出 → Phase2 web/injection → Phase3 発見パスごとに適応的に深掘り。
 * 進捗・推論(reason)をNDJSONでストリームし、最後に重大度順の統合レポートを返す。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? '');
  const scope = checkScope(url);
  if (!scope.inScope) {
    return new Response(line({ type: 'error', text: `スコープ外: ${'reason' in scope ? scope.reason : ''}` }), { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
  }
  const origin = new URL(url).origin;
  const delay = Math.max(60, Math.floor(1000 / Math.max(1, scope.rateLimitRps)));

  const stream = new ReadableStream({
    async start(controller) {
      const all: (Finding & { tool: string; where?: string })[] = [];
      const rawByTool: Record<string, string> = {};
      let n = 0;
      const emit = (o: unknown) => controller.enqueue(line(o));
      const step = async (tool: string, target: string, where?: string) => {
        const key = `s${++n}`;
        emit({ type: 'progress', key, label: where ? `${tool} @ ${where}` : tool, status: 'running' });
        try {
          const r = await execute(tool, target);
          if (r.raw && !rawByTool[tool]) rawByTool[tool] = r.raw;
          (r.findings ?? []).forEach((f) => all.push({ ...f, tool, where, title: where ? `[${where}] ${f.title}` : f.title }));
          emit({ type: 'progress', key, label: where ? `${tool} @ ${where}` : tool, status: r.ok ? 'done' : 'error', summary: r.ok ? r.summary : r.error, findings: (r.findings ?? []).length });
        } catch (e) {
          emit({ type: 'progress', key, label: tool, status: 'error', summary: (e as Error).message });
        }
        await sleep(delay);
      };

      emit({ type: 'plan', target: url });

      // Phase 1: 表面把握
      emit({ type: 'reason', text: 'PHASE 1 — 表面把握(recon)。公開パス・技術スタック・エンドポイント・設定ファイルを収集し、攻撃面の地図を作る。' });
      for (const t of PHASE1_RECON) await step(t, url);

      // 適応: 発見ライブパスを深掘り対象に
      const leads = extractLeads(origin, rawByTool);
      emit({ type: 'reason', text: leads.length ? `発見ライブパス ${leads.length}件を深掘り対象に選定 → ${leads.map((l) => new URL(l).pathname).slice(0, 8).join(' , ')}` : '深掘り対象の追加パスは検出されず。ベースURL中心に継続。' });

      // Phase 2: 設定/認証/動的プローブ（ベース）
      emit({ type: 'reason', text: 'PHASE 2 — 設定・認証・動的プローブ(web/injection)をベースURLへ適用。CORS/Cookie/リダイレクト/反射/エラー露出を評価。' });
      for (const t of PHASE2_WEB) await step(t, url);

      // Phase 3: 適応的な狙い撃ち（試行錯誤を自動で）
      if (leads.length) {
        emit({ type: 'reason', text: 'PHASE 3 — 自律追跡。発見した各パスに対し、ヘッダ強度・詳細エラー・入力反射・CORSを狙い撃ちで再評価（改善ループ）。' });
        for (const lead of leads) {
          emit({ type: 'reason', text: `→ 深掘り: ${new URL(lead).pathname}` });
          for (const t of FOLLOWUP) await step(t, lead, new URL(lead).pathname);
        }
      }

      // 統合レポート（重複排除＋重大度順）
      const seen = new Set<string>();
      const dedup = all.filter((f) => { const k = f.severity + '|' + f.title; if (seen.has(k)) return false; seen.add(k); return true; });
      dedup.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
      const counts: Record<string, number> = {};
      for (const f of dedup) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
      emit({ type: 'reason', text: `完了。実行ステップ ${n} / 一意の所見 ${dedup.length}件。重大度順に統合。` });
      emit({ type: 'report', target: url, steps: n, total: dedup.length, counts, findings: dedup });
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
