# Standment Redteam Console — プラグイン化（ChatGPT / Codex で喋らせる）

このコンソールは **外部LLM（ChatGPT / Codex / Claude）を頭脳として** 動かせる。
LLMが会話しながら、このアプリのスキャンAPIを呼んで実際に対象を検査する。
= 単体チャット用のLLM鍵は不要。会話はChatGPT側、実行はこのアプリ。

公開API（認可レンジ限定・認可ゲート経由）:
- `GET  /api/targets` 認可済みターゲット一覧
- `POST /api/targets` `{url}` スコープ判定
- `POST /api/scan`    `{url}` 実行可能な検出手法を列挙
- `POST /api/run`     `{toolId,url}` 検出手法を1つ実行し所見を返す
- `GET  /api/openapi` OpenAPI 3.1 スキーマ（下記のImport用）

ベースURL: `https://standment-redteam-console.vercel.app`

## A. ChatGPT のカスタムGPT（Actions）に登録
1. ChatGPT → 左下 **Explore GPTs → Create**（または既存GPTのEdit）
2. **Configure → Actions → Create new action**
3. **Import from URL** に以下を貼る:
   `https://standment-redteam-console.vercel.app/api/openapi`
   （URL Importが不可なら、そのURLを開いて出たJSONをSchema欄に貼り付け）
4. **Authentication: None**（APIは認可レンジ限定なので鍵不要）
5. 保存。これで `listAuthorizedTargets` / `checkScope` / `listMethods` / `runMethod` をGPTが呼べる

### 推奨の GPT Instructions（頭脳の人格）
```
あなたは認可スコープ内レッドチーム・オーケストレーター。
- まず listAuthorizedTargets で対象を把握し、対象URLは checkScope で inScope を確認してから進める。
- listMethods で使える手法を見て、recon→web/injection の順に runMethod を複数呼び、
  所見を「所見→再現→影響→修正(BLUE)」で統合する。
- 認可レンジ外は実行しない。乗っ取り・権限変更・遠隔操作・DoSは扱わない。
- アクセス制御バイパス等の“能動的突破”はツールでは実行せず、候補の提示＋手動検証手順の設計までを行い、
  実行はオペレーター（人間）が担当する前提で助言する。
```

## B. Codex / Claude など（MCP / HTTP）
- 上記エンドポイントはそのままHTTPツールとして呼べる（JSON）。
- MCPサーバが必要な場合は、この4エンドポイントを薄くラップするMCPを追加可能（別途）。

## メモ
- `/api/run` は単発・低負荷。`/api/assess`（アプリUI内）は多段の自律診断（NDJSONストリーム）。
  GPT Actionsはストリーム非対応なので、GPTからは runMethod を複数回呼ぶ形が安定。
- 有料LLM鍵をアプリ単体の `/api/chat` に挿す場合は、公開前にアクセス制限を必ず追加する。
