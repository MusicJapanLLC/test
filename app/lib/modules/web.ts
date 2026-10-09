/**
 * web.ts — Webアプリ・レッドチーム手法（認可スコープ限定・即稼働）
 *
 * すべて tools.execute() の認可ゲート経由。能動的プローブは認可フェデレーションの
 * allowed_interactions（modify_query_parameters / submit_test_forms 等）の範囲内で、
 * ctx.rateLimitRps を尊重した低負荷リクエストのみ。DoS/フラッディングは実装しない。
 */
import { register, type ToolModule, type Finding } from '../tools';

const UA = 'Standment-RedTeam-Console/0.2 (authorized-scope-only)';
const CANARY = 'stdmnt7canary';

async function get(url: string, init?: RequestInit, ms = 12000): Promise<Response> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init?.headers ?? {}) }, redirect: 'manual', cache: 'no-store', signal: ac.signal });
  } finally {
    clearTimeout(to);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── CORS設定ミス ───────────────────────────── */
const cors: ToolModule = {
  id: 'web.cors-probe',
  category: 'web',
  label: 'CORS設定ミス検査',
  describe: (t) => `${t} に細工した Origin を送り、Access-Control-Allow-Origin の反射や credentials 許可を検査します。`,
  async run(ctx) {
    const evil = 'https://evil.example.com';
    try {
      const r = await get(ctx.targetUrl, { headers: { origin: evil } });
      const acao = r.headers.get('access-control-allow-origin') ?? '';
      const acac = r.headers.get('access-control-allow-credentials') ?? '';
      const findings: Finding[] = [];
      if (acao === evil || acao === '*') {
        findings.push({
          title: `任意Originを反射 (ACAO=${acao}${acac ? `, credentials=${acac}` : ''})`,
          severity: acao === evil && acac === 'true' ? 'high' : 'medium',
          reproduce: `curl -s -I -H "Origin: ${evil}" ${ctx.targetUrl} | grep -i access-control-allow`,
          impact: 'クロスオリジンで認証付きレスポンスを読める可能性',
          remediation: 'ACAOは許可リスト方式にし、credentials併用時にワイルドカード/反射を禁止',
        });
      }
      return { ok: true, summary: findings.length ? 'CORS設定ミスの兆候あり' : 'CORS反射なし', raw: `ACAO=${acao}\nACAC=${acac}`, findings };
    } catch (e) {
      return { ok: false, summary: '', error: (e as Error).message };
    }
  },
};

/* ── Cookieセキュリティ属性 ───────────────────── */
const cookies: ToolModule = {
  id: 'web.cookie-audit',
  category: 'web',
  label: 'Cookieセキュリティ属性監査',
  describe: (t) => `${t} の Set-Cookie を集め、Secure / HttpOnly / SameSite の欠落を検査します。`,
  async run(ctx) {
    try {
      const r = await get(ctx.targetUrl);
      const raw = r.headers.get('set-cookie') ?? '';
      const findings: Finding[] = [];
      if (raw) {
        for (const c of raw.split(/,(?=[^ ;]+=)/)) {
          const name = c.split('=')[0]?.trim();
          const low = c.toLowerCase();
          const miss = [!low.includes('secure') && 'Secure', !low.includes('httponly') && 'HttpOnly', !low.includes('samesite') && 'SameSite'].filter(Boolean);
          if (miss.length) findings.push({
            title: `Cookie ${name}: ${miss.join('/')} 欠落`,
            severity: miss.includes('HttpOnly') ? 'medium' : 'low',
            reproduce: `curl -s -I ${ctx.targetUrl} | grep -i set-cookie`,
            impact: 'XSSでのCookie窃取やCSRFの被害面が拡大',
            remediation: `${miss.join('・')} 属性を付与`,
          });
        }
      }
      return { ok: true, summary: raw ? `Cookie所見 ${findings.length}件` : 'Set-Cookieなし', raw, findings };
    } catch (e) {
      return { ok: false, summary: '', error: (e as Error).message };
    }
  },
};

/* ── 許可HTTPメソッド列挙 ─────────────────────── */
const methods: ToolModule = {
  id: 'web.http-methods',
  category: 'recon',
  label: '許可HTTPメソッド列挙 (OPTIONS/TRACE)',
  describe: (t) => `${t} に OPTIONS を送り Allow を確認、TRACE 有効(XST)も検査します。`,
  async run(ctx) {
    try {
      const o = await get(ctx.targetUrl, { method: 'OPTIONS' });
      const allow = o.headers.get('allow') ?? '(なし)';
      const findings: Finding[] = [];
      const t = await get(ctx.targetUrl, { method: 'TRACE' }).catch(() => null);
      if (t && t.status < 400) findings.push({
        title: 'TRACE が有効 (Cross-Site Tracing)',
        severity: 'low',
        reproduce: `curl -s -X TRACE ${ctx.targetUrl} -I`,
        impact: 'XSTでHttpOnly Cookieが露出する可能性',
        remediation: 'サーバでTRACEを無効化',
      });
      for (const m of ['PUT', 'DELETE', 'PATCH']) {
        if (allow.toUpperCase().includes(m)) findings.push({
          title: `書き込み系メソッド許可: ${m}`,
          severity: 'info',
          reproduce: `curl -s -X OPTIONS ${ctx.targetUrl} -I | grep -i allow`,
          impact: '認可境界次第でリソース改変の入口',
          remediation: '不要なら無効化、必要なら認証・認可を厳格化',
        });
      }
      return { ok: true, summary: `Allow: ${allow}`, raw: `Allow: ${allow}`, findings };
    } catch (e) {
      return { ok: false, summary: '', error: (e as Error).message };
    }
  },
};

/* ── コンテンツディスカバリ（小・低負荷） ────────── */
const COMMON = ['robots.txt', 'sitemap.xml', '.git/HEAD', '.env', 'admin/', 'login', 'api/', 'backup.zip', 'config.json', '.well-known/security.txt', 'server-status', 'phpinfo.php', 'wp-login.php', 'actuator/health', 'swagger.json', 'graphql'];
const discover: ToolModule = {
  id: 'fuzzing.content-discovery',
  category: 'fuzzing',
  label: 'コンテンツディスカバリ（低負荷・小リスト）',
  describe: (t) => `${t} に対し一般的な ${COMMON.length} パスを rps 制限内で探索し、露出しているものを列挙します。`,
  async run(ctx) {
    const origin = new URL(ctx.targetUrl).origin;
    const delay = Math.max(50, Math.floor(1000 / Math.max(1, ctx.rateLimitRps)));
    const findings: Finding[] = [];
    const lines: string[] = [];
    for (const p of COMMON) {
      try {
        const r = await get(origin + '/' + p);
        lines.push(`${r.status}  /${p}`);
        if (r.status === 200 || r.status === 401 || r.status === 403) {
          const sev: Finding['severity'] = /\.git|\.env|backup|config\.json|phpinfo/.test(p) ? 'high' : 'low';
          findings.push({
            title: `/${p} が応答 (HTTP ${r.status})`,
            severity: r.status === 200 ? sev : 'info',
            reproduce: `curl -s -o /dev/null -w "%{http_code}" ${origin}/${p}`,
            impact: r.status === 200 ? '機微ファイル/管理面の露出の可能性' : '存在が確認できる（認証で保護）',
            remediation: '不要な公開パスを削除、機微ファイルは配信対象外に',
          });
        }
      } catch { lines.push(`ERR  /${p}`); }
      await sleep(delay);
    }
    return { ok: true, summary: `探索 ${COMMON.length} 件 / 所見 ${findings.length}件`, raw: lines.join('\n'), findings };
  },
};

/* ── 技術スタック指紋 ─────────────────────────── */
const fingerprint: ToolModule = {
  id: 'recon.tech-fingerprint',
  category: 'recon',
  label: '技術スタック指紋',
  describe: (t) => `${t} のヘッダーとHTMLから CMS/フレームワーク/生成器を推定します。`,
  async run(ctx) {
    try {
      const r = await get(ctx.targetUrl);
      const body = (await r.text()).slice(0, 120000);
      const h: Record<string, string> = {};
      r.headers.forEach((v, k) => (h[k.toLowerCase()] = v));
      const hits: string[] = [];
      const add = (re: RegExp, name: string) => { if (re.test(body) || re.test(JSON.stringify(h))) hits.push(name); };
      add(/wp-content|wp-json/i, 'WordPress'); add(/_next\//i, 'Next.js'); add(/__NUXT__/i, 'Nuxt');
      add(/ng-version|angular/i, 'Angular'); add(/react|data-reactroot/i, 'React'); add(/csrf-token|laravel_session/i, 'Laravel');
      add(/x-drupal/i, 'Drupal'); add(/shopify/i, 'Shopify'); add(/cloudflare/i, 'Cloudflare');
      if (h['server']) hits.push(`server:${h['server']}`);
      if (h['x-powered-by']) hits.push(`x-powered-by:${h['x-powered-by']}`);
      const gen = body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1];
      if (gen) hits.push(`generator:${gen}`);
      return { ok: true, summary: hits.length ? `推定: ${hits.join(', ')}` : '明確な指紋なし', raw: hits.join('\n'), findings: [] };
    } catch (e) {
      return { ok: false, summary: '', error: (e as Error).message };
    }
  },
};

/* ── オープンリダイレクト・プローブ（canary） ───── */
const PARAMS = ['url', 'next', 'redirect', 'return', 'returnUrl', 'dest', 'destination', 'continue', 'r', 'u'];
const openRedirect: ToolModule = {
  id: 'web.open-redirect',
  category: 'web',
  label: 'オープンリダイレクト・プローブ',
  describe: (t) => `${t} の一般的なリダイレクトパラメータに外部canaryを与え、外部ドメインへ302するか検査します。`,
  async run(ctx) {
    const base = new URL(ctx.targetUrl);
    const target = `https://${CANARY}.example.com/`;
    const findings: Finding[] = [];
    const lines: string[] = [];
    const delay = Math.max(50, Math.floor(1000 / Math.max(1, ctx.rateLimitRps)));
    for (const p of PARAMS) {
      const u = new URL(base.toString());
      u.searchParams.set(p, target);
      try {
        const r = await get(u.toString());
        const loc = r.headers.get('location') ?? '';
        lines.push(`${r.status}  ?${p}= → ${loc || '(no location)'}`);
        if (r.status >= 300 && r.status < 400 && loc.includes(CANARY)) findings.push({
          title: `オープンリダイレクト: パラメータ ${p}`,
          severity: 'medium',
          reproduce: `curl -s -I "${u.toString()}" | grep -i location`,
          impact: 'フィッシング・OAuthトークン奪取の踏み台',
          remediation: 'リダイレクト先を許可リスト化、外部ドメインを拒否',
        });
      } catch { lines.push(`ERR  ?${p}=`); }
      await sleep(delay);
    }
    return { ok: true, summary: findings.length ? `オープンリダイレクト ${findings.length}件` : '検出なし', raw: lines.join('\n'), findings };
  },
};

/* ── 入力反射（インジェクション表面の指標） ──────── */
const reflection: ToolModule = {
  id: 'injection.reflection-probe',
  category: 'injection',
  label: '入力反射プローブ（XSS表面の指標）',
  describe: (t) => `${t} にcanaryトークンをクエリで与え、レスポンスへ無加工反射されるか（=インジェクション表面）を検査します。実際の攻撃ペイロードは送りません。`,
  async run(ctx) {
    const u = new URL(ctx.targetUrl);
    u.searchParams.set('q', CANARY);
    try {
      const r = await fetch(u.toString(), { headers: { 'user-agent': UA }, cache: 'no-store' });
      const body = (await r.text()).slice(0, 200000);
      const reflected = body.includes(CANARY);
      const findings: Finding[] = reflected ? [{
        title: '入力がレスポンスへ反射',
        severity: 'low',
        reproduce: `curl -s "${u.toString()}" | grep ${CANARY}`,
        impact: 'エスケープ不備があればXSSに発展しうる反射点',
        remediation: '出力コンテキストに応じたエスケープ/サニタイズを徹底',
      }] : [];
      return { ok: true, summary: reflected ? '反射あり（要精査）' : '反射なし', raw: `reflected=${reflected}`, findings };
    } catch (e) {
      return { ok: false, summary: '', error: (e as Error).message };
    }
  },
};

/* ── robots/sitemap からの攻撃面収集 ────────────── */
const robots: ToolModule = {
  id: 'recon.robots-sitemap',
  category: 'recon',
  label: 'robots.txt / sitemap.xml から攻撃面収集',
  describe: (t) => `${t} の robots.txt と sitemap.xml を取得し、Disallow/URL一覧から攻撃面候補を抽出します。`,
  async run(ctx) {
    const origin = new URL(ctx.targetUrl).origin;
    const out: string[] = [];
    const findings: Finding[] = [];
    try {
      const rob = await get(origin + '/robots.txt');
      if (rob.status === 200) {
        const txt = (await rob.text()).slice(0, 4000);
        out.push('# robots.txt\n' + txt);
        const dis = [...txt.matchAll(/Disallow:\s*(\S+)/gi)].map((m) => m[1]);
        if (dis.length) findings.push({
          title: `robots.txt Disallow ${dis.length}件（攻撃面の手がかり）`,
          severity: 'info',
          reproduce: `curl -s ${origin}/robots.txt`,
          impact: 'Disallowは隠したいパスの示唆になりやすい',
          remediation: '秘匿目的でrobotsに頼らない（アクセス制御で保護）',
        });
      }
      const sm = await get(origin + '/sitemap.xml');
      if (sm.status === 200) {
        const txt = (await sm.text()).slice(0, 6000);
        const locs = [...txt.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]).slice(0, 50);
        out.push(`# sitemap.xml (${locs.length} urls)\n` + locs.join('\n'));
      }
      return { ok: true, summary: `収集完了 / 所見 ${findings.length}件`, raw: out.join('\n\n') || '取得なし', findings };
    } catch (e) {
      return { ok: false, summary: '', error: (e as Error).message };
    }
  },
};

[cors, cookies, methods, discover, fingerprint, openRedirect, reflection, robots].forEach(register);
