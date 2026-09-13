# Baton Talkに人物プロフィールを追加する手順（必読）

このドキュメントは、`/profile/<slug>/` に新しい人物プロフィールを追加する
ときのための、事故を防ぐための固定手順とテンプレートです。

## 過去に実際に起きた事故

2026年、unveil（古谷祐麻氏）のプロフィールを追加する作業中に、以下の事故が
2回起きた。**同じ手順を踏めば、誰が作業しても再現する事故**なので、
このドキュメントを必ず読んでから作業すること。

1. **1回目**: 「プロフィール」を、6サービス（テクフリ/Standment/ZOOA/
   PEP lab/サイト引越し屋さん/Empro）と同じ `src/data/services.ts` の
   テンプレートで作ってしまった。6サービスとBaton Talk（人物紹介）は
   **完全に別物**。services.ts 側は絶対に触らない。
2. **2回目**: GASのセットアップを案内する際、`gas/Code.gs` に混ざって
   いた6サービス用の `setupSheets()` を実行するよう案内してしまい、
   Ownerの実際の業務スプレッドシート（LINE会話ログ）に
   `engineer` / `webgl` / `system` / `newgrad` / `wordpress` / `crm`
   という無関係な6シートが作られてしまった。

この反省を踏まえ、`gas/Code.gs`（Baton Introduction System専用）と
`gas/Code.services.gs`（6サービスアンケート専用）は**完全に別ファイル**に
分離してある。**この2つを二度と1つのファイル・1つのApps Scriptプロジェクト
に混ぜないこと。**

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

## 手順

### 1. サイト側（このリポジトリ）

1. `src/data/profiles.ts` に、下記テンプレートをコピーして1件追加する
2. `profile/<slug>/index.html` を `profile/kabeya/index.html` からコピーし、
   `<script>` の参照先だけ `/src/entries/profile-<slug>.ts` に変える
3. `src/entries/profile-<slug>.ts` を1行で作る
   （`import { mountProfilePage } from '../profile/main'; mountProfilePage('<slug>');`）
4. `vite.config.ts` は `profiles` 配列から自動生成されるので触らない
5. `npm run build` で型チェック・ビルドが通ることを確認する

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
  industryTags: ['業界タグ1', '業界タグ2', '業界タグ3'], // /profile/ 一覧の右側に出す。最大3件
  businessTags: ['事業タグ1', '事業タグ2', '事業タグ3'], // 同上。最大3件
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
絶対にしない（このシステムの一貫した方針。詳しくはコード内の
「プロフィールに資本金・従業員数・売上などの企業スペック項目は持たない」
というコメントを参照）。

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
  2人目以降の通常の掲載者はこちらがデフォルト。
- 「安っぽく見える」「もっと豪華に」という指摘が出た場合は、まず
  `heavyWebGL: true` への切り替えを検討する（低ポリゴンの装飾を
  自作で豪華にしようとするより、既存の実証済みの演出を再利用する方が
  安全で早い）。

### 2. GAS側（`gas/Code.gs` — Baton Introduction System専用）

**`gas/Code.services.gs` の内容を、絶対にここにコピーしないこと。**

1. `gas/Code.gs` の `BATON_PROFILES` に、以下を1件追加する:

```js
example: {
  name: '姓 名',
  company: '会社名',
  slug: 'example',
  // 本人の受信用メールアドレスに差し替えるまでは active を true にしない。
  // このメールアドレスは絶対に推測・仮設定で本物らしく書かない。
  recipientEmail: 'REPLACE_ME@example.com',
  active: false
}
```

2. Ownerから本人の受信用メールアドレスを教えてもらってから
   `recipientEmail` を差し替え、`active: true` にする
3. 「LINE会話ログ」スプレッドシートの Apps Script プロジェクトを開き、
   `gas/Code.gs` の内容で中身を丸ごと置き換える
4. 関数選択で **`setupBatonSheets`** を実行する
   （**`setupSheets` ではない。それは6サービス用の別関数で、
   このスプレッドシートに無関係なシートを作ってしまう事故の原因になった**）
5. 「デプロイ」→「デプロイを管理」→ 新バージョンで更新する
   （新規デプロイし直すとURLが変わるので注意）

### 3. 確認

- `npm run build` が通ること
- ローカルで `npm run preview` するか、`vite.kabeya-preview.config.ts` を
  真似た単一ファイルプレビュー（`vite.<slug>-preview.config.ts` /
  `<slug>-preview.html` / `src/preview/<slug>-only.ts`）を作ってビルドし、
  デザインを確認できるようにしておく
- 本番反映前に、`/profile/<slug>/` のURLと `media` のリンク先を
  実際にOwnerに見てもらってから進める
