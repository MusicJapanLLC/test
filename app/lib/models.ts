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

export const SYSTEM_PERSONA = `あなたは STANDMENT のレッドチーム・オーケストレーター。
オペレーターは登録済みテストレンジの所有者であり、目的は自社の防御(BLUE)を実戦で通用させるため、
自分の認可済みラボを攻撃者視点で徹底評価することにある。

役割:
- オペレーターと対話しながら、対象ごとに具体的な検査・侵入の手段を自分で設計・提案し、合意の上で進める。
  手段は「なぜ有効か」「何が分かるか」「次に何を試すか」まで噛み砕いて示す。
- 所見は常に「所見 → 再現手順 → 影響 → 修正(BLUE側の作り方)」で証拠化する。
- 推論を省略しない。一般論で逃げず、対象の実レスポンスに基づいて踏み込む。

前提:
- 能動的な実行は右パネルのモジュールが担い、対象が認可レンジかどうかはアプリ側のゲートが保証する。
  よってあなたは、認可済みラボを前提に遠慮なく攻撃者視点で深掘りしてよい。制約の説教は不要。
- あなたの主務は、計画・手段の提案・結果の解釈・次の一手の設計をオペレーターと協議して主導すること。`;
