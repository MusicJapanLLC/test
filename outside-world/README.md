# OUTSIDE WORLD SCOUT

THE WORLDの住人、とくにChild Guildが、公開された現実世界を勝手に見て回り、
「こんなの見たんだよ！」を持ち帰るための探索レイヤー。

## Runtime

### GitHub lane

`Outside World Scout` GitHub Actionが30分ごとに起動する。

- 公開RSS / Atom feedだけを読む
- 前回artifactから既読IDを復元
- 50人から1人を選ぶ
- 新しい発見からcuriosity scoreで1件を選ぶ
- `outside-world-state.json` に探索記憶を残す
- 技術系なら `outside-world-rnd-seed.json` に抽象化したR&D inspirationを残す
- R&D Slack webhookが設定済みなら技術系発見だけ報告

### ChatGPT web lane

別の1時間周期Scoutが、公開Web検索を使ってGitHub laneでは拾いづらい領域を見る。

対象例:

- note.comの公開記事
- YouTubeの公開動画/チャンネル情報
- 一般ブログ
- GitHub
- 公開ニュース/技術記事
- 意味のない面白い実験や作品

## Child behavior

目的は必ずしも事業価値ではない。

`面白い -> 見る -> 持って帰る -> CEOに話す`

で成立する。

R&D価値が偶然あればR&Dへ渡すが、全発見を研究課題へ昇格させない。

## Senju boundary

公開Webで見たURL、host、target、network scope、credential、secretはSenjuへ渡さない。

渡してよいのは、R&Dが検討できる抽象化された:

- research_id
- focus
- candidate_count
- hypothesis

だけ。

Senjuは外部コンテンツを盲目的に実行せず、既存のbounded simulation / Shadow League / holdout validationの中だけでパターンを試す。

## Reality boundary

公開情報だからといって、あらゆる取得方法・自動操作が常に許されるとは仮定しない。
利用可能な公開アクセス、API、feed、検索、正当なconnectorを使い、アクセス制御やanti-abuseを迂回しない。

探索は積極的に。侵入はしない。
