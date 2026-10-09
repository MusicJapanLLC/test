/**
 * deep.ts — 追加の検出モジュール（認可スコープ限定・低負荷・検出/証拠化のみ）
 *
 * すべて tools.execute() の認可ゲート経由。単発リクエスト中心、破壊的操作なし。
 * 乗っ取り・権限変更・遠隔操作は含まない（検出と証拠化に徹する）。
 */
import { register, type ToolModule, type Finding } from '../tools';

const UA = 'Standment-RedTeam-Console/0.3 (authorized-scope-only)';
const get = (u: string, init?: RequestInit) =>
  fetch(u, { ...init, headers: { 'user-agent': UA, ...(init?.headers ?? {}) }, redirect: 'manual', cache: 'no-store' });

/* ── GraphQL introspection 露出 ───────────────── */
const graphql: ToolModule = {
  id: 'recon.graphql-introspection',
  category: 'recon',
  label: 'GraphQL introspection 露出検査',
  describe: (t) => `${t} の一般的な GraphQL エンドポイントに introspection クエリを送り、スキーマが露出していないか検査します。`,
  async run(ctx) {
    const origin = new URL(ctx.targetUrl).origin;
    const paths = ['/graphql', '/api/graphql', '/v1/graphql', '/query'];
    const q = JSON.stringify({ query: '{__schema{types{name}}}' });
    const findings: Finding[] = [];
    const lines: string[] = [];
    for (const p of paths) {
      try {
        const r = await get(origin + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: q });
        const body = (await r.text()).slice(0, 1500);
        lines.push(`${r.status} ${p}`);
        if (r.status < 400 && /__schema|"types"/.test(body)) {
          findings.push({
            title: `GraphQL introspection 有効: ${p}`,
            severity: 'medium',
            reproduce: `curl -s ${origin}${p} -H "content-type: application/json" -d '{"query":"{__schema{types{name}}}"}'`,
            impact: 'スキーマ全容が露出し攻撃面の把握を容易にする',
            remediation: '本番では introspection を無効化、または認証を要求',
          });
        }
      } catch { lines.push(`ERR ${p}`); }
    }
    return { ok: true, summary: findings.length ? `GraphQL露出 ${findings.length}件` : 'GraphQL introspection 露出なし', raw: lines.join('\n'), findings };
  },
};

/* ── ディレクトリ・リスティング ─────────────────── */
const dirListing: ToolModule = {
  id: 'recon.dir-listing',
  category: 'recon',
  label: 'ディレクトリ・リスティング検査',
  describe: (t) => `${t} の一般的なディレクトリが "Index of /" を返していないか（一覧露出）を検査します。`,
  async run(ctx) {
    const origin = new URL(ctx.targetUrl).origin;
    const dirs = ['/', '/uploads/', '/files/', '/images/', '/img/', '/assets/', '/backup/', '/static/', '/.well-known/'];
    const findings: Finding[] = [];
    const lines: string[] = [];
    for (const d of dirs) {
      try {
        const r = await get(origin + d);
        const body = (await r.text()).slice(0, 4000);
        if (r.status === 200 && /<title>Index of|Directory listing for|\[To Parent Directory\]/i.test(body)) {
          lines.push(`LISTING ${d}`);
          findings.push({
            title: `ディレクトリ一覧が露出: ${d}`,
            severity: 'medium',
            reproduce: `curl -s ${origin}${d} | grep -i "index of"`,
            impact: '非公開ファイルの列挙・取得につながる',
            remediation: 'オートインデックスを無効化（Options -Indexes 等）',
          });
        } else lines.push(`${r.status} ${d}`);
      } catch { lines.push(`ERR ${d}`); }
    }
    return { ok: true, summary: findings.length ? `ディレクトリ露出 ${findings.length}件` : 'ディレクトリ一覧の露出なし', raw: lines.join('\n'), findings };
  },
};

/* ── 詳細エラー / スタックトレース露出 ───────────── */
const verboseErrors: ToolModule = {
  id: 'recon.verbose-errors',
  category: 'web',
  label: '詳細エラー / スタックトレース露出検査',
  describe: (t) => `${t} に異常な入力を与え、スタックトレースやフレームワークのデバッグ画面が露出しないかを検査します。`,
  async run(ctx) {
    const base = new URL(ctx.targetUrl);
    const probes = [`${base.origin}${base.pathname}?id[]=1`, `${base.origin}${base.pathname}%27`, `${base.origin}/nonexistent-${Date.now()}`];
    const sigs = /(Traceback \(most recent call last\)|Stack trace:|Exception|at [\w.$]+\([\w.$]+\.java:|System\.\w+Exception|Warning: |Fatal error|SQLSTATE|ORA-\d|\.rb:\d+:in |node_modules|Whoops\\|Werkzeug Debugger)/;
    const findings: Finding[] = [];
    const lines: string[] = [];
    for (const u of probes) {
      try {
        const r = await get(u);
        const body = (await r.text()).slice(0, 8000);
        const m = body.match(sigs);
        lines.push(`${r.status} ${u}${m ? '  <= ' + m[0] : ''}`);
        if (m) findings.push({
          title: `詳細エラー露出: "${m[0]}"`,
          severity: 'low',
          reproduce: `curl -s "${u}"`,
          impact: '実装詳細・パス・SQL等が露出し攻撃を容易にする',
          remediation: '本番ではデバッグ無効化・汎用エラーページに統一',
        });
      } catch { lines.push(`ERR ${u}`); }
    }
    return { ok: true, summary: findings.length ? `詳細エラー露出 ${findings.length}件` : '詳細エラーの露出なし', raw: lines.join('\n'), findings };
  },
};

[graphql, dirListing, verboseErrors].forEach(register);
