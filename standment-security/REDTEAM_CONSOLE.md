# REDTEAM CONSOLE — セキュリティ特化・会話型LLMコンソール

認可フェデレーション（`AUTHORIZED_TEST_TARGETS.json`）内のテストレンジに対して、
自然言語の会話から実レッドチーム手法を計画・実行・証拠化する Claude Code 型コンソール。

## スコープ原則（売れる核）
- 対象は認可フェデレーション内のみ（owner公開レンジ / 合成ラボ）。スコープ外は実行ロック。
- DoS / resource exhaustion / 無差別攻撃は規約禁止 → コードに実装しない。
- すべての実行は監査ログ化。1テスト = 1証拠パック（所見→再現→影響→修正提案）。

## 3ペインUI
- 左: 会話履歴（ChatGPT型・タイトル自動生成）
- 中央: 会話 + マルチエージェント実行トレース（RECON→PLANNER→CRITIC→EXECUTOR→VERIFIER）
- 右: ターゲット・レジストリ + 手法プルダウン + 実行/証拠パネル

## 推論モデル（軽量モデル禁止）
`app/lib/models.ts` の3枠: deep / balanced / longctx。

## モジュール層（プラグイン）
`app/lib/tools.ts` の `ToolModule` 規格。recon / web / fuzzing / injection / report / github を
認可ゲート(`app/lib/targets.ts`)経由でのみ起動。実バイナリ: httpx, nmap, nuclei, ZAP, ffuf, sqlmap。

## 実装順序
1. 認可ゲート `targets.ts` ✅
2. 推論ルーター `models.ts` ✅
3. ツール規格 `tools.ts` ✅
4. 3ペインUI（左履歴 / 中会話 / 右実行）
5. モデル・ストリーミングAPI（/api/chat）
6. ツール・モジュール実装（recon から）
7. GitHub連携（Issue/PR起票・証拠添付）
8. 証拠パック / レポート出力
