/**
 * recon.ts — 読み取り専用のreconモジュール群（外部バイナリ不要・即稼働）
 *
 * すべて認可ゲート(tools.execute)経由でのみ起動する。GETのみ、低負荷、DoS無し。
 * httpx/nmap/nuclei/ZAP 等の外部バイナリ連携は別モジュールで後述追加する。
 */
import { register, type ToolModule, type Finding } from '../tools';

const UA = 'Standment-RedTeam-Console/0.1 (authorized-scope-only)';

// 期待されるセキュリティヘッダーと欠落時の重大度
const SECURITY_HEADERS: { name: string; sev: Finding['severity']; fix: string }[] = [
  { name: 'content-security-policy', sev: 'medium', fix: 'CSPを定義しXSSの被害面を縮小' },
  { name: 'strict-transport-security', sev: 'medium', fix: 'HSTSで常時HTTPSを強制' },
  { name: 'x-content-type-options', sev: 'low', fix: 'nosniff を付与しMIMEスニッフィング抑止' },
  { name: 'x-frame-options', sev: 'low', fix: 'DENY/SAMEORIGINでクリックジャッキング防止' },
  { name: 'referrer-policy', sev: 'low', fix: 'Referrer-Policyで参照元漏えいを制限' },
  { name: 'permissions-policy', sev: 'low', fix: '不要なブラウザ機能を無効化' },
];

const httpFingerprint: ToolModule = {
  id: 'recon.http-fingerprint',
  category: 'recon',
  label: 'HTTP指紋 / セキュリティヘッダー監査',
  describe: (t) => `${t} にGETし、サーバ指紋とセキュリティヘッダーの欠落を検査します（低負荷・1リクエスト）。`,
  async run(ctx) {
    try {
      const res = await fetch(ctx.targetUrl, {
        method: 'GET',
        headers: { 'user-agent': UA },
        redirect: 'follow',
        cache: 'no-store',
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
      const findings: Finding[] = [];
      for (const h of SECURITY_HEADERS) {
        if (!headers[h.name]) {
          findings.push({
            title: `${h.name} が未設定`,
            severity: h.sev,
            reproduce: `curl -sI ${ctx.targetUrl} | grep -i ${h.name}  # 出力なし`,
            impact: `${h.name} の欠落によりブラウザ側の攻撃面が残存`,
            remediation: h.fix,
          });
        }
      }
      const server = headers['server'] ?? '(非公開)';
      const powered = headers['x-powered-by'];
      if (powered) {
        findings.push({
          title: `X-Powered-By で実装が露出: ${powered}`,
          severity: 'info',
          reproduce: `curl -sI ${ctx.targetUrl} | grep -i x-powered-by`,
          impact: 'スタック情報の露出は攻撃者の絞り込みを助ける',
          remediation: 'X-Powered-By ヘッダーを抑止',
        });
      }
      return {
        ok: true,
        summary: `HTTP ${res.status} / server=${server} / セキュリティ所見 ${findings.length}件`,
        raw: JSON.stringify(headers, null, 2),
        findings,
      };
    } catch (e) {
      return { ok: false, summary: '', error: `取得失敗: ${(e as Error).message}` };
    }
  },
};

const scopeVerify: ToolModule = {
  id: 'recon.scope-verify',
  category: 'recon',
  label: '認可スコープ自己検証 (security.txt / scope.json)',
  describe: (t) => `${t} の /.well-known/security.txt と /scope.json を取得し、owner認可の裏取りをします。`,
  async run(ctx) {
    const origin = new URL(ctx.targetUrl).origin;
    const probes = ['/.well-known/security.txt', '/.well-known/security-test-federation.json', '/scope.json'];
    const out: string[] = [];
    const findings: Finding[] = [];
    for (const p of probes) {
      try {
        const r = await fetch(origin + p, { headers: { 'user-agent': UA }, cache: 'no-store' });
        out.push(`${p} → HTTP ${r.status}`);
        if (r.ok) {
          const body = (await r.text()).slice(0, 2000);
          out.push(body);
          findings.push({
            title: `${p} を検出`,
            severity: 'info',
            reproduce: `curl -s ${origin + p}`,
            impact: 'owner認可の裏取りに利用可能',
            remediation: '（情報）認可証跡として証拠パックに添付',
          });
        }
      } catch {
        out.push(`${p} → 取得不可`);
      }
    }
    return { ok: true, summary: `スコープ証跡 ${findings.length}件検出`, raw: out.join('\n'), findings };
  },
};

register(httpFingerprint);
register(scopeVerify);
