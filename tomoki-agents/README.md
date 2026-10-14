# TOMOKI Agents

GitHub Actions上で自律稼働する3人の監視・改善エージェント。

- **TOMOKI / SKEPTIC** — 成功報告を信用せず、証拠・回帰・未検証を探す。読み取り専用。
- **TOMOKI / HOUND** — 同じ失敗、放置、再発、長期未解決を執念深く追う。読み取り専用。
- **TOMOKI / FORGE** — 毎回1件だけ低リスク改善を実装。安全ゲートと検証に通った変更だけPR化し、可能ならマージする。

## 実行

3本のGitHub Actionsがそれぞれ1時間ごとにずらして動く。ChatGPTの定期タスクには依存しない。

レポート先はSlack `#tomoki`。GitHub Secret `TOMOKI_SLACK_WEBHOOK_URL` が設定されている場合のみ外部送信する。Secretが未設定でも監視・改善自体は止めない。

## 安全設計

- SKEPTIC/HOUNDはコードを書き換えない。
- FORGEの自動変更は `sales-command-30/src/**` と `sales-command-30/tests/**`、指定ドキュメントだけ。
- `.github/**`、backend、認証、Secrets、デプロイ設定、セキュリティポリシーはFORGEの自動変更対象外。
- 最大3ファイル、変更250行程度を目安とし、policy gateで上限を強制。
- build/compile検証失敗時は変更を破棄。
- SlackへSecrets、顧客データ、攻撃手順、exploit payloadを送らない。

## AI runtime

GitHub Copilot CLIをGitHub Actions内で実行し、`GITHUB_TOKEN` で認証する。個人所有repoではCopilot使用量はrepo ownerのCopilot枠に紐づく。Copilotが利用できない場合、そのrunは失敗としてSlack/Actionsに残り、コード変更は行わない。
