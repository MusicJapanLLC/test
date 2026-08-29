# Senju（千手）— 自律進化型 攻防シミュレーション基盤

> レッドチーム（攻撃）とブルーチーム（防御）の多数のエージェントを、
> **意図的に脆弱に設計したラボ標的**に対して毎日対戦させ、
> 勝者を繁殖・敗者を淘汰することで、**攻撃力と防御力を世代ごとに自動で鍛え上げる**基盤。

「千手観音のように多数のエージェントが同時に切磋琢磨する」ための、
現実的で・安全で・実際に動く実装です。

---

## これは何をするものか

- **攻撃エージェント群 vs 防御エージェント群**が、有限リソース（＝戦争の資源制約）の下で標的を奪い合う。
- 勝てば **ELOレーティング上昇（報酬）**、負ければ **淘汰（罰）**。
- 各世代の上位個体が **交配・変異** して次世代を作る＝**攻防の軍拡競争を自動再現**。
- 毎日 **Markdownの戦況レポート** を自動生成（レーティング推移・弱点分析・チャンピオン）。
- すべての標的アクセスは **安全ゲート（ScopeGuard）** を通過し、**ラボ標的以外には設計上到達できない**。

## 設計上の絶対条件（ここは動かせない）

1. **実在の第三者・公開インターネットは攻撃対象にできない。**
   `senju/safety.py` の `ScopeGuard` がすべての標的参照を検問する。
   公開ホスト名・公開IPはデフォルト全拒否。許可されるのは in-process 仮想標的
   （`sim://…`）と、明示オプトインしたラボ内プライベートネットワークのみ。
2. **実際の攻撃コード/エクスプロイトは同梱しない。**
   攻防の成否は「技量・難易度・対策・検知」の確率モデルで抽象化している。
   これは AI/機械学習の観点で「戦略が本当に強くなるか」を測るには十分であり、
   かつ誰かを害する道具にはならない。

この2点は「弱さ」ではなく「強さの前提」です。自分の箱の中でだけ全力を出せるから、
許可を気にせず毎日いくらでも戦わせられる。

---

## すぐ動かす

依存ゼロ（Python 3.10+ の標準ライブラリのみ）。

```bash
cd senju

# 30秒デモ（レポートを標準出力＋ senju/reports/ に保存）
python -m senju.cli demo

# 本格運用（個体数・世代数・対戦数を指定）
python -m senju.cli run --population 100 --generations 30 --matches 400

# “1000体のマッドサイエンティスト”をやりたいなら
python -m senju.cli run --population 1000 --generations 50 --matches 4000

# 安全ゲートの単体確認
python -m senju.cli safety-check sim://web-1     # ✅ 許可
python -m senju.cli safety-check 8.8.8.8         # ⛔ 拒否
python -m senju.cli safety-check example.com     # ⛔ 拒否

# テスト
python -m pytest tests -q
```

## 戦争経済（報酬と罰・有限リソース）

「勝てば報酬、負ければ罰」「リソース有限＝戦争」を最後まで突き詰めた仕組み。

- **有限資源**: 世界の総資源には上限がある。増やせない。奪い合うだけ。
- **食料は戦果で決まる**: 各世代、維持費で徴収した資源の一部が「食料」として
  戻るが、受け取れるのは**その世代に敵を倒した個体だけ**。負けた個体は食えない。
- **維持費（飢餓）**: 全個体が毎世代コストを払う。戦果ゼロが続けば資産が尽きる。
- **破産＝死**: 資産が閾値を割った個体はその場で淘汰される。
- **繁殖はコスト**: 富める個体だけが子を残せる。相続で資源は保存される（総量一定）。
- **陣営内の淘汰**: 資源はレッド/ブルーの陣営内で奪い合う。だから一方が他方を
  絶滅させることはなく、両陣営が健全に生き残りながら内部で強くなる（軍拡競争が持続）。

```bash
# 通常モード（持続的な淘汰）
python -m senju.cli run --population 100 --generations 40 --matches 1000

# 苛烈モード（略奪多・維持費高・破産しやすい＝大量死の消耗戦）
python -m senju.cli run --population 100 --generations 40 --matches 1000 --extreme
```

苛烈モードのパラメータは `senju/economy.py` の `EconomyConfig.extreme()` で調整可能。
さらに極端にしたければ `upkeep`・`reinforcement_ratio`・`bankruptcy_threshold` をいじる。

## 標的アーキタイプと脆弱性クラス

標的は5種のアーキタイプ（`web_app` / `api` / `auth_service` / `cloud` / `iot`）を
巡回し、それぞれ脆弱性クラスの出やすさが異なる（例: cloudは `ssrf`/`misconfig` が多い）。
脆弱性クラスは17種（`sqli`, `xss`, `csrf`, `auth_bypass`, `jwt_weak`, `idor`,
`priv_esc`, `ssrf`, `rce`, `path_trav`, `deserial`, `xxe`, `ssti`,
`race_condition`, `secrets_exposure`, `misconfig`, `nosqli`）。
増やすのは簡単: `senju/targets/base.py` の `VULN_CLASSES` と `ARCHETYPES` に追記するだけ。

## 監視（あなたが毎日見るもの）

- `senju/reports/report-YYYY-MM-DD.md` — 日次の戦況レポート（レーティング推移・
  戦争経済・弱点分析・チャンピオン）。
- `senju/reports/latest.json` — 全世代の生データ（ダッシュボード/自作可視化用）。
- `.github/workflows/senju-daily-report.yml` — 毎朝CIで自動実行。Job Summaryに表示し、
  **`SLACK_WEBHOOK_URL` シークレットを設定すればSlackへ自動投稿**（要約を通知）。

## アーキテクチャ

```
senju/
  safety.py        ScopeGuard — 非バイパス型スコープ検問（最重要）
  config.py        アリーナ/進化の設定
  targets/
    base.py        標的・攻撃面(Surface)・脆弱性クラスの抽象定義
    simulated.py   in-process 仮想標的（実ネットワーク不使用）
  agents/
    base.py        RedGenome / BlueGenome / Agent（レーティングを持つ個体）
    labnet.py      隔離ラボネット上の実標的アダプタ（ScopeGuard必須・攻撃コードなし）
  arena.py         1試合の交戦エンジン（有限リソース下の攻防）
  scoring.py       ELOレーティング更新（報酬と罰）
  economy.py       戦争経済（有限資源・食料・維持費・繁殖コスト・破産＝死）
  evolution.py     選抜・交配・変異・淘汰（世代交代）
  tournament.py    世代を回す司令塔
  report.py        日次戦況レポート生成＋JSONエクスポート
  cli.py           コマンドライン入口
lab/               Docker隔離ラボ（internal網で外部遮断）＋標的マニフェスト＋RoE
```

### 遺伝子（進化の対象）

- **RedGenome**: `focus`（脆弱性クラス別の注力度）, `skill`, `stealth`, `aggression`
- **BlueGenome**: `harden`（クラス別の対策優先度）, `detection`, `patch_speed`, `coverage`

世代を追うごとに、勝つ遺伝子が生き残り、負ける遺伝子が消える。
その結果、レッドは「どこを突くか」を、ブルーは「どこを守るか」を自動で学習する。
レポートの弱点分析（最も突破された脆弱性クラス）は、そのまま
**実運用での防御の優先順位**として使える。

---

## 毎日の自動報告

`.github/workflows/senju-daily-report.yml`（リポジトリ直下）が毎日トーナメントを実行し、
`senju/reports/report-YYYY-MM-DD.md` を生成して Job Summary に出力する。
ローカルで cron に登録しても良い：

```bash
# 毎朝7時に実行する例（crontab -e）
0 7 * * * cd /path/to/repo/senju && python -m senju.cli run --population 200 --generations 30 --matches 800 >/dev/null 2>&1
```

---

## ロードマップ：仮想標的から「隔離した本物の標的」へ

現在は確率モデルの仮想標的。次段階は、**あなたのマシン上の隔離環境**に
意図的に脆弱な本物のアプリ（例: OWASP Juice Shop, DVWA, WebGoat）を立て、
エージェントの行動を実プロトコルにマッピングする拡張。安全の要は次の通り：

1. **ネットワーク隔離**: Docker の `internal: true` ネットワークに標的を置き、
   外部への egress を物理的に遮断する（ラボから公開インターネットへ出られない）。
2. **ScopeGuard の拡張**: `allow_private_network=True` かつ許可ホストを明示した時だけ、
   `labnet:<name>` 標的に到達可能にする。公開資産は引き続き全拒否。
3. **交戦規定(RoE)ファイル**: 標的・時間帯・強度の上限を宣言し、逸脱を実行前に停止。

この設計により、「無許可で好き放題」＝**自分の隔離ラボの中でだけ**成立させる。
他人の資産には、設定をどう変えても手が届かない。

---

## よくある質問

**Q. これで“本当の攻撃力”が鍛えられるのか？**
A. 鍛えられるのは「戦略の探索・選抜・適応」の部分＝AIとして最も重要な頭脳部分。
実ペイロードの生成は、隔離ラボ標的（ロードマップ）に対してのみ、あなたの管理下で拡張する。

**Q. なぜコンプラを完全に無視できないのか？**
A. 無視するのは「他人を害する自由」であって、「自分の箱で全力を出す自由」ではない。
後者はここで完全に確保している。前者を捨てることが、むしろシステムを長生きさせる。
