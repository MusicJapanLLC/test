# The world — Strong New Game 3h

3時間ごとに `test` の現在Git状態と研究成果をcheckpoint化し、2分岐×2世代 = 4つのactive worldへ並列継承する研究サイクルです。

## 継承するもの

- current Git HEAD / refs digest
- commit / merge history（2x2 Git mirrorを `git_mesh.py` で作成）
- `.github/workflows` 定義
- RED / Senju / META / X の研究メモリ要約
- 直近の主要自律研究workflowの成功artifact
- 前世代checkpoint lineageとrolling insights

研究取り込み予算は1サイクル最大1,000 text filesです。RED 400、Senju 200、META 200、X 200へ実際に割り当てるため、RED 40%は表示上のweightだけではなく読み込み予算にも反映されます。

artifactはread-onlyで読み、schema・研究方向・regression/finding signal・confidence等のbounded summaryに変換します。raw credential、Authority grant、外部実行権限はcheckpointへ持ち越しません。

## 周期

`.github/workflows/strong-new-game-3h.yml`

```text
0 */3 * * *
```

1サイクル:

```text
current merged Git state
        ↓
最新成功artifactを並列取得
  RED pentest / RED observation
  Senju boundary research
  META/X world research fabric
        ↓
repo内研究 + artifactをbounded summary化
        ↓
previous rolling checkpointと統合
        ↓
2 x 2 Git mirror reconcile
        ↓
world-1 ─┐
world-2 ─┼─ 4 workers / parallel research seed
world-3 ─┤
world-4 ─┘
        ↓
checkpoint.json
        ↓
次の3時間サイクル
```

## バイバインと処理速度

実体を `4^N` 個すべて物理生成すると短期間でI/Oが支配的になり速度が落ちるため、active worldは常に4個へ固定します。一方でlineageは `virtual_lineage_count = 4 ** generation` として保持し、全世代のrolling research memoryを次seedへ継承します。

つまり、計算資源は4-way fan-outへ集中しながら、研究系譜は3時間ごとに4倍として積み上がります。

`checkpoint.json.performance` に以下を記録します。

- research collection seconds
- four-world generation seconds
- total build seconds
- active world workers
- research file budget

## 合成ラボ

`synthetic-labs.json` に `.invalid` reserved domainを使った32種類のresearch surfaceを定義しています。各サイクルはそのうち16件を選び、4 worldへ4件ずつ自動配布します。次世代では16件分rotationするため、現在の32-lab catalogは2サイクルで一巡します。

これにより同時処理量は増やさず、authorization / session / parser / workflow / cache / recovery / concurrency / identity / time / federation等の異なる膠着パターンを継続的に切り替えられます。

## 継承しないもの

credential、Authority grant、外部side effectは研究checkpointから自動継承しません。Guard policyはこのサイクルでは変更せず、現在状態をそのまま維持します。

## 手動実行

```bash
python the-world-strong-new-game/strong_new_game.py build \
  --output /tmp/strong-new-game \
  --research-file-budget 1000
python the-world-strong-new-game/strong_new_game.py verify \
  --output /tmp/strong-new-game

python the-world-5th-power/git_mesh.py reconcile \
  --runtime /tmp/strong-new-game-git \
  --branching 2 --generations 2 --workers 4
```
