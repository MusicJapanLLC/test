# Standment Security Watch

Status: MVP product definition

## Product promise

Webサイトを公開したあとに放置しない。

Standment Security Watch は、顧客が管理権限を持つWebサイトを対象に、非侵襲の外形診断と開発パイプライン検査を継続し、問題を日本語で「何が危険か / 何を直すか」まで整理する運用サービス。

## What the customer buys

1. 初回セキュリティ診断
2. HTTPS / TLS / Security Header / Cookie / 公開ファイルの継続監視
3. 100点スコアとA〜F評価
4. Critical / High の検出
5. 日本語の修正レポート
6. GitHub利用顧客ではCodeQL / dependency / secret / artifact gate導入支援
7. 診断証跡の保存
8. 修正後の再診断

## MVP pricing draft

### Security Snapshot

- 初回 30,000円（税別）
- 1サイト
- 初回外形診断
- 日本語レポート
- 改善優先順位
- 修正後1回再診断

### Security Watch

- 初期 30,000円（税別）
- 月額 19,800円（税別） / 1サイト
- 毎日自動外形診断
- 月次スコア履歴
- Critical / High 検出時の通知
- 月1回の改善レポート
- GitHub Security Gate保守

### Managed Security

- 初期 50,000円（税別）
- 月額 49,800円〜（税別）
- Security Watchの全機能
- 修正PR作成
- 依存関係更新支援
- セキュリティ設定変更レビュー
- インシデント一次切り分け

Pricing is an internal hypothesis. Validate with sales before fixing public pricing.

## What this is NOT

現段階では以下を「提供済み」と表現しない。

- 本格的な侵入試験 / ペネトレーションテスト
- 24時間有人SOC
- 法令・規格への認証取得保証
- 脆弱性が存在しないことの保証
- 顧客許可のない第三者システムへの診断

## Safety / authorization rule

Standment Security Scan は `security/targets.json` に明示登録された、管理者または顧客から診断許可を得た対象のみ実行する。

実行する診断は読み取り専用のHTTPS/TLS/Header/HTML/Cookie/限定的な公開ファイル確認に限定する。認証突破、ブルートフォース、exploit、負荷試験、データ変更はMVPの対象外。

## Sales proof to accumulate

商用化では機能数より証拠を増やす。

- 診断回数
- 検出したCritical / High / Medium件数
- 誤検知率
- 修正までの日数
- 修正後のスコア改善量
- 顧客ごとの継続月数
- 防止できた設定ミスの実例

## Current reference implementation

Batonを第1号のdogfooding対象とし、Standment自身のサイトで失敗・誤検知・修正・再診断の履歴を蓄積する。

「一度で完璧」を目標にせず、診断 → 失敗 → 原因特定 → 改善 → 再診断の回数をプロダクト資産として残す。
