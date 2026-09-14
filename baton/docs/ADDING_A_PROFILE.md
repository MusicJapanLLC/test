# Baton Talkに人物プロフィールを追加する手順（必読）

このドキュメントは、`/profile/<slug>/` に新しい人物プロフィールを追加する
ときのための、事故を防ぐための固定手順とテンプレートです。
**新しいチャット・新しいセッションで作業を頼まれたら、何よりも先にこれを
読むこと。**

## 誰が何をやるか（3者の役割分担）

unveil（古谷祐麻氏）追加のときに、この役割分担が曖昧だったために
のべ十数時間かかった。今後は必ずこの3者体制で進める。

| 担当 | やること | やらないこと |
|---|---|---|
| **このチャット（Claude Code / リポジトリ側）** | `src/data/profiles.ts` 等サイト側コードの追加、`gas/Code.gs` の**コード内容**の作成・修正、git commit/push、ビルド確認、デザインプレビューの用意 | **Google側の画面操作は一切できない**（script.google.comへの通信がこの環境からブロックされている）。GASへの貼り付け・デプロイ・実行は物理的に不可能 |
| **Owner（ユーザー）** | 掲載する本人の実名・会社名・肩書き・実在するURL・**受信用メールアドレス**（本物 or 一時テスト用）の提供、デザインの承認、本番pushの許可 | コードは書かない。GAS操作はClaude in Chromeに渡す |
| **Claude in Chrome（ブラウザ拡張）** | 実際のGoogle画面を見ながらの、GASコードの貼り付け・`BATON_PROFILES`編集・デプロイ管理・関数実行・本番サイトでのフォーム送信テスト | サイト側のコード（このリポジトリ）は触らない。指示された1プロジェクト以外は触らない |

**このチャットからGASの状態を直接確認する手段はない。** 「デプロイした」
「動くはず」は口約束にしかならないので、必ずClaude in Chromeに
実機で最後まで確認させ、結果（実行ログ・実サイトでの送信結果）を
報告してもらってから完了とする。

## 過去に実際に起きた事故（再発防止のために全部記録する）

1. **プロフィールを6サービス用テンプレートで作ってしまった**:
   「プロフィール」を、6サービス（テクフリ/Standment/ZOOA/PEP lab/
   サイト引越し屋さん/Empro）と同じ `src/data/services.ts` の
   テンプレートで作ってしまった。6サービスとBaton Talk（人物紹介）は
   **完全に別物**。services.ts 側は絶対に触らない。

2. **無関係な6シートが実際の業務スプレッドシートに作られた**:
   GASのセットアップ案内で、`gas/Code.gs` に混ざっていた6サービス用の
   `setupSheets()` を実行するよう案内してしまい、Ownerの実際の業務
   スプレッドシート（LINE会話ログ）に `engineer/webgl/system/newgrad/
   wordpress/crm` という無関係な6シートが作られてしまった。
   → 対策: `gas/Code.gs`（Baton Introduction System専用）と
   `gas/Code.services.gs`（6サービスアンケート専用）を**完全に別ファイル**
   に分離した。この2つを二度と1つのファイル・1つのApps Scriptプロジェクト
   に混ぜないこと。

3. **【最重要】全く別のApps Scriptプロジェクトを何時間も編集し続けた**:
   Ownerが「Test2」という名前で新しくApps Scriptプロジェクトを作成し、
   そこにコードを貼って何度も保存・デプロイ・実行したが、**本番サイトが
   実際に呼んでいるプロジェクトは別に存在しており（プロジェクト名
   「Baton」）、Test2側の変更は一切サイトに反映されなかった**。
   結果、原因不明のまま数時間を溶かした。
   → 対策: 下記「GAS作業を始める前に、必ず最初にやること」を、
   **一字一句省略せず**Claude in Chromeへの指示に含めること。

## これは何か / 何でないか

- Baton Talk（人物プロフィール、このドキュメントの対象）
  = `src/data/profiles.ts` + `gas/Code.gs`
  = 「この人と話したい」という個人向けの紹介システム
  = 資本金・従業員数・売上などの企業スペックは**一切載せない**
    （マッチングアプリのようなステータス表示にしないという方針）
- 6サービス（このドキュメントの対象では**ない**）
  = `src/data/services.ts` + `gas/Code.services.gs`
  = テクフリ/Standment/ZOOA/PEP lab/サイト引越し屋さん/Emproの
    BtoBサービス紹介＋アンケート
  = 新しい人物を追加する作業では、このファイル群には一切触れない

## GAS作業を始める前に、必ず最初にやること（プロジェクト特定）

**コードを1文字触る前に、これを済ませること。** これを飛ばすと事故3が
再発する。

1. `.env.production` の `VITE_GAS_ENDPOINT` を確認する。今の値:
   ```
   https://script.google.com/macros/s/AKfycbxET0hbNJoWsk3Q0owleog34TWjDA0sAYulFQNt__Xq9u4QOilbTbW3b8D7NkyviUXu/exec
   ```
   （変わっていたら、この文書の値より`.env.production`の実物を信じる）
2. https://script.google.com/home を開き、プロジェクト一覧から
   **「Baton」という名前のプロジェクト**を開く
   （直リンクが分かっている場合はそれを使う。「Test2」「baton2」など、
   それらしい別名のプロジェクトは絶対に開かない・触らない）
3. 「デプロイ」→「デプロイを管理」を開く
4. 一覧に複数のデプロイ候補が並んでいることがある（「無題」が複数、
   「Baton endpoint」など）。**それぞれを開いて、Web アプリのURLが
   `AKfycbxET0hbNJoWsk3Q0owleog34TWjDA0sAYulFQNt__` で始まっている
   ものを見つける。それ以外のデプロイ候補・プロジェクトは絶対に
   編集しない**
5. ここで特定した「本物」の情報（プロジェクトのURL、デプロイの見分け方）
   を、その日の作業指示に必ず書き添える

## 手順

### 1. サイト側（このリポジトリ。このチャットが担当）

1. `src/data/profiles.ts` に、下記テンプレートをコピーして1件追加する
2. `profile/<slug>/index.html` を `profile/kabeya/index.html` からコピーし、
   `<script>` の参照先だけ `/src/entries/profile-<slug>.ts` に変える
3. `src/entries/profile-<slug>.ts` を1行で作る
   （`import { mountProfilePage } from '../profile/main'; mountProfilePage('<slug>');`）
4. `vite.config.ts` は `profiles` 配列から自動生成されるので触らない
5. `npm run build` で型チェック・ビルドが通ることを確認する
6. push前に必ず production ブランチ（`claude/baton-backend-implementation-zu0h6k`）
   を fetch し、他セッション/Ownerの直接コミットで進んでいないか確認してから
   マージ・pushする（このブランチは複数の作業者が同時に触っている）

#### `src/data/profiles.ts` テンプレート

```ts
const exampleProfile: TalkProfile = {
  id: 'example',
  slug: 'example',
  name: '姓 名',
  company: '会社名',
  title: '役職（例: 代表取締役CEO）',
  tagline: '一行のキャッチコピー（未指定なら簡易ヒーローになる）',
  bio: '人物紹介の一段落。経歴・現在の肩書きなど。',
  business: [
    '事業内容の説明。段落ごとに配列の要素を分ける。',
  ],
  services: [
    { name: 'サービス名', description: '一行説明' },
  ],
  media: [
    { label: '公式サイト', url: 'https://example.com/' },
    // image は任意。実際に確認できた画像URL以外は入れない
  ],
  listSummary: '一覧ページ用の一行説明（未指定ならtaglineで代用）',
  businessTags: ['事業タグ1', '事業タグ2', '事業タグ3'], // /profile/ 一覧の右側。最大3件
  keywordTags: ['キーワード1', 'キーワード2', 'キーワード3'], // 同上。最大3件
  theme: { primary: '#______', accent: '#______', bg: '#______', text: '#______' },
  // ヒーローの立体表現は、下の「モニュメント運用ルール」を参照して選ぶこと
  heavyWebGL: true, // または monument: 'stack' | 'lattice' | 'cluster' | 'shield' | 'funnel'
  active: true, // false にすると /profile/ 一覧に出ない（GAS側もactive:falseにしておく）
};

export const profiles: TalkProfile[] = [kabeyaProfile, unveilProfile, exampleProfile];
```

**絶対に入れてはいけない情報**: 資本金、従業員数、売上、その他の企業スペック
（IR的な数値）。実績として触れたい場合は `bio` / `business` の文章の中で
自然に触れる程度にとどめ、`stats` のような独立した数値バッジ・カードには
絶対にしない。

**URLについて**: `media` に入れるリンクは、必ず本人・Owner・信頼できる
一次情報源から得た実在のURLだけを使う。似た名前の別会社・別ドメインが
存在することがあるため、確信が持てないURLは絶対に推測で入れず、
Ownerに確認すること。

#### モニュメント運用ルール（ヒーローの立体表現）

- `heavyWebGL: true`: 壁谷友生氏と同じ、フルWebGLの豪華な演出
  （`scene-standment.ts`）。**創業者クラス／初めて掲載する記念すべき
  人物など、特別な扱いをする人物にはこちらを使う。**
  （実例: kabeya＝創業者本人、unveil＝外部パートナーとして初掲載）
- `monument: '...'`: 低ポリゴンの簡易な立体（`scene-light.ts`）。
  3人目以降の通常の掲載者はこちらがデフォルト。
- 「安っぽく見える」「もっと豪華に」という指摘が出た場合は、まず
  `heavyWebGL: true` への切り替えを検討する。

### 2. GAS側のコード（このチャットが `gas/Code.gs` の中身を用意する）

**`gas/Code.services.gs` の内容を、絶対に `gas/Code.gs` にコピーしないこと。**

`gas/Code.gs` の `BATON_PROFILES` に、以下を1件追加する:

```js
example: {
  name: '姓 名',
  company: '会社名',
  slug: 'example',
  // 本人の受信用メールアドレスに差し替えるまでは active を true にしない。
  // このメールアドレスは絶対に推測・仮設定で本物らしく書かない
  // （テスト段階でOwner自身のアドレスを使うのは可。その場合はTODOコメントを残す）。
  recipientEmail: 'REPLACE_ME@example.com',
  active: false
}
```

コードを更新したら、リポジトリにcommit/pushしておく（GASへの反映は
Claude in Chromeの仕事。このチャットはコードを「用意する」だけ）。

### 3. GAS側の実機作業（Claude in Chromeに渡す）

以下のテンプレートの `【　】` を埋めて、そのままClaude in Chromeに渡す。

```
# Baton: 【name】（【slug】）のプロフィールをGASに追加/更新する

## 事前確認（省略禁止）
1. https://script.google.com/home を開き、プロジェクト名「Baton」を開く
   （「Test2」等の別名プロジェクトは絶対に開かない）
2. 「デプロイ」→「デプロイを管理」を開き、Web アプリURLが
   `AKfycbxET0hbNJoWsk3Q0owleog34TWjDA0sAYulFQNt__` で始まる
   デプロイを特定する（他のデプロイ候補は触らない）

## STEP 1: コードを確認・追加する
コード内で `BATON_PROFILES` を検索し、`【slug】:` のブロックが
下記と一致しているか確認する。無ければ追加、違っていれば修正して保存する。
他の人物のブロックや他の関数は一切変更しない。

  【slug】: {
    name: '【name】',
    company: '【company】',
    slug: '【slug】',
    recipientEmail: '【recipientEmail】',
    active: 【true/false】
  }

## STEP 2: 特定したデプロイに「新バージョン」を反映する
1. 事前確認で特定したデプロイを選択した状態で鉛筆（編集）アイコンをクリック
2. 「バージョン」プルダウンを開き「新バージョン」を選択したことを目視確認
3. 「デプロイ」を押す。完了ダイアログのURLが
   `AKfycbxET0hbNJoWsk3Q0owleog34TWjDA0sAYulFQNt__...` のままであることを確認
   （別URLが新規発行されていたら「新しいデプロイ」を誤って作ってしまった
   ということなので、それは削除してSTEP2をやり直す）

## STEP 3: コードのテストを直接実行する
`testBatonFlow【Slug】` という関数があるか確認する（無ければ
`testBatonFlowUnveil`をコピーしてprofileIdだけ`【slug】`に変えて作る）。
これを選択して実行し、実行ログに `結果: {"ok":true}` と出ることを確認する。

## STEP 4: 実際のサイトで確認する
新しいタブで `https://baton.music-japan.com/profile/【slug】/` を開き、
「紹介を希望する」フォームに適当なテストデータを入力して送信する。
「このプロフィールは現在受け付けていません」が出ないこと、
「確認メールを送りました」的な成功表示になることを確認する。

## 報告してほしいこと
- STEP1: ブロックは元々あったか、追加/修正したか
- STEP2: 選んだデプロイのURL、バージョン変更前後の表示
- STEP3: 実行ログの内容
- STEP4: 成功したか、成功しなければ表示されたメッセージ

## 厳守事項
- 「Baton」以外のプロジェクト・上記以外のデプロイ・他の人物のブロック・
  他の関数には一切触れない
- 新しいデプロイを新規作成しない（既存デプロイの「新バージョン」のみ）
```

### 4. 確認・完了条件

- `npm run build` が通ること
- Claude in Chromeからの報告で、STEP4（実サイトでの送信）が成功していること
- リポジトリの `gas/Code.gs` を、Claude in Chromeが実際にGAS上へ加えた
  変更（recipientEmailの実際の値など）に合わせて更新しておく
  （リポジトリとGAS上の実物がズレたままにしない）
- 本番反映前に、`/profile/<slug>/` のURLと `media` のリンク先を
  実際にOwnerに見てもらってから進める
