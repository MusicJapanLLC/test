# Music Japan Integration OS / Apps Script

Google Sheetsを人間向けコントロールプレーン、GitHubをコードの正本として運用する自動化ランタイムです。

## 現在の役割

- `21_EVENT_LOG`: 紹介・状態変化をappend-onlyで固定保存
- `22_ID_REGISTRY`: 会社名の表記揺れに依存しない内部EntityID
- `23_SOURCE_REGISTRY`: Google Sheets / Gmail / GitHub / 外部パートナー表の接続契約とHealth
- `24_SIGNAL_INBOX`: Gmail等から検出したシグナルを本番CRM更新前に一時受信
- `13_REFERRAL_DB`: EVENT_LOGを基準に放置日数を算出

## デプロイ

1. Google Apps Scriptプロジェクトを作成し、`Code.gs` と `appsscript.json` を反映する。
2. `setupMusicJapanAutomation()` を1回実行し、Spreadsheet/Gmail/Trigger権限を許可する。
3. setupが15分周期の `runAutomationCycle` トリガーを作成する。
4. Web APIが必要ならWeb Appとしてデプロイし、URLを `10_CONFIG!B8` に保存する。
5. API tokenはsetup時にScript Propertiesへ自動生成される。シートやGitHubへ平文保存しない。

## 安全設計

- Gmailから検出した内容は直接CRMを書き換えず、まず `24_SIGNAL_INBOX` に入る。
- 同じGmail MessageID / EventIDは重複投入しない。
- `LockService` で並列実行を防ぐ。
- 外部パートナーSheetは請求実績のSource of Truthとして扱い、Apps Scriptから勝手に上書きしない。
- 過去の紹介日時が不明な既存データは、架空の過去日を作らず移行基準日から開始する。

## GitHub

- Repository: `MusicJapanLLC/test`
- Branch: `claude/employee-onboarding-setup-udm86`
- Path: `chatgpt-os/apps-script`
