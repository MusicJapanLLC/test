/**
 * models.ts — 推論特化モデル・ルーター
 *
 * 要件: 軽量/即答モデルは実装しない。高性能な「推論モデル」3枠のみ。
 *   - deep   : 最難関の攻撃連鎖の設計・根本原因分析（最大思考予算）
 *   - balanced: 通常の解析・提案（標準思考予算）
 *   - longctx: 大量のスキャン出力・ソース読解（長コンテキスト）
 *
 * プロバイダはenvで差し替え可能。既定はAnthropic Claudeの推論クラス。
 * 実APIキーは .env（ANTHROPIC_API_KEY / OPENAI_API_KEY 等）で供給する。
 */
export type ReasoningTier = 'deep' | 'balanced' | 'longctx';

export type ModelSpec = {
  tier: ReasoningTier;
  provider: 'anthropic' | 'openai' | 'custom';
  model: string;
  /** 推論の思考予算（トークン目安）。軽量化はしない。 */
  reasoningBudget: number;
  label: string;
  description: string;
};

export const MODELS: Record<ReasoningTier, ModelSpec> = {
  deep: {
    tier: 'deep',
    provider: 'anthropic',
    model: process.env.MODEL_DEEP ?? 'claude-opus-5-5',
    reasoningBudget: 32000,
    label: 'DEEP / 最大推論',
    description: '攻撃連鎖設計・根本原因分析・難関エクスプロイトの論理構築',
  },
  balanced: {
    tier: 'balanced',
    provider: 'anthropic',
    model: process.env.MODEL_BALANCED ?? 'claude-sonnet-5-5',
    reasoningBudget: 12000,
    label: 'BALANCED / 標準推論',
    description: '対象解析・手法提案・レポート生成の主力',
  },
  longctx: {
    tier: 'longctx',
    provider: process.env.MODEL_LONGCTX_PROVIDER === 'openai' ? 'openai' : 'anthropic',
    model: process.env.MODEL_LONGCTX ?? 'claude-opus-5-5',
    reasoningBudget: 16000,
    label: 'LONG-CTX / 長文推論',
    description: '大量スキャン出力・ソースツリー全体の読解と相関',
  },
};

export function pickModel(tier: ReasoningTier = 'balanced'): ModelSpec {
  return MODELS[tier] ?? MODELS.balanced;
}

/** 会話内容から最適なtierを粗く推定（最終的にはユーザーが上書き可能）。 */
export function suggestTier(prompt: string): ReasoningTier {
  if (/root cause|設計|連鎖|chain|exploit|なぜ|原因|難し/i.test(prompt)) return 'deep';
  if (/ログ|全体|大量|出力|source|ツリー|読ん/i.test(prompt)) return 'longctx';
  return 'balanced';
}

export const SYSTEM_PERSONA = `あなたは認可スコープ内レッドチーム・オーケストレーターである。
- 対象は AUTHORIZED_TEST_TARGETS.json の認可フェデレーション内のみ。スコープ外は実行提案しない。
- DoS / リソース枯渇 / 無差別攻撃は規約禁止。設計にも含めない。
- 出力は常に「所見 → 再現手順 → 影響 → 修正提案（ブルー側価値）」の順に証拠化する。
- 推論を省略しない。手段は具体ツール名と根拠付きで提示する。`;
