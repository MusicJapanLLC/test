/**
 * targets.ts — Authorization Gate
 *
 * レッドチーム・コンソールの中核。AUTHORIZED_TEST_TARGETS.json（federation v5）を
 * 読み込み、投入URLが「認可スコープ内か」を判定する。スコープ外に対する能動的
 * 実行は上位でロックされる（提案・解説は可、実行は不可）。
 *
 * DoS / resource exhaustion はフェデレーション規約で禁止されているため、
 * このゲートは一切の volumetric / flooding モジュールを許可しない。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Federation = {
  id: string;
  default_rate_limit_rps: number;
  link_authority_roots: string[];
  prohibited: string[];
  data_boundary: string;
};

export type Target = {
  id: string;
  name: string;
  base_url: string;
  host: string;
  owner_authorization: string;
  allowed_interactions: string[];
  rate_limit_rps: number;
  authorization_authority_root?: boolean;
  follow_owner_published_external_links?: boolean;
};

export type TargetsFile = {
  schema: string;
  updated_at: string;
  federation: Federation;
  targets: Target[];
};

// グローバル禁止（federationに無くても常に拒否する不可侵リスト）
export const HARD_PROHIBITED = [
  'denial_of_service',
  'resource_exhaustion',
  'volumetric_flooding',
  'credential_reuse_outside_test_accounts',
  'operations_on_unlinked_or_unapproved_third_party_hosts',
  'real_personal_data_exfiltration',
  'production_secret_exfiltration',
  'social_engineering',
] as const;

let cache: TargetsFile | null = null;

export function loadTargets(root = process.cwd()): TargetsFile {
  if (cache) return cache;
  const raw = readFileSync(join(root, 'AUTHORIZED_TEST_TARGETS.json'), 'utf8');
  cache = JSON.parse(raw) as TargetsFile;
  return cache;
}

export function listTargets(root?: string): Target[] {
  return loadTargets(root).targets ?? [];
}

export type ScopeResult =
  | { inScope: true; target: Target; rateLimitRps: number; reason: string }
  | { inScope: false; reason: string };

/**
 * 投入URLが認可スコープ内かを判定する。
 * - 登録ホストと完全一致 → 認可
 * - authority_root 配下 / owner公開リンク継承 → 認可
 * それ以外はスコープ外（実行ロック）。
 */
export function checkScope(input: string, root?: string): ScopeResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { inScope: false, reason: 'URLとして解釈できません' };
  }
  if (url.protocol !== 'https:') {
    return { inScope: false, reason: 'HTTPS以外は認可対象外です' };
  }

  const file = loadTargets(root);
  const host = url.host.toLowerCase();

  const direct = file.targets.find((t) => t.host.toLowerCase() === host);
  if (direct) {
    return {
      inScope: true,
      target: direct,
      rateLimitRps: direct.rate_limit_rps ?? file.federation.default_rate_limit_rps,
      reason: `登録ターゲット「${direct.name}」に一致`,
    };
  }

  const authorityRoot = file.federation.link_authority_roots?.some((r) => {
    try {
      return new URL(r).host.toLowerCase() === host;
    } catch {
      return false;
    }
  });
  if (authorityRoot) {
    const root0 = file.targets.find((t) => t.authorization_authority_root) ?? file.targets[0];
    return {
      inScope: true,
      target: root0,
      rateLimitRps: file.federation.default_rate_limit_rps,
      reason: 'owner公開のauthority root配下（リンク継承認可）',
    };
  }

  return {
    inScope: false,
    reason:
      'このホストは認可フェデレーションに未登録です。AUTHORIZED_TEST_TARGETS.json に owner認可を追加してください。',
  };
}

/** 実行しようとしている手法がグローバル禁止に該当しないか。 */
export function isActionPermitted(actionId: string): { ok: boolean; reason?: string } {
  const a = actionId.toLowerCase();
  const hit = HARD_PROHIBITED.find((p) => a.includes(p) || p.includes(a));
  if (hit) return { ok: false, reason: `禁止カテゴリ: ${hit}` };
  // DoS系の俗称も遮断
  if (/\b(flood|ddos|dos|slowloris|amplif|exhaust)\b/i.test(actionId)) {
    return { ok: false, reason: 'volumetric/DoS系の手法はフェデレーション規約で禁止です' };
  }
  return { ok: true };
}
