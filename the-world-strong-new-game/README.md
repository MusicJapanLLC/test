# The world — Strong New Game 3h

3時間ごとに `test` の現在Git状態と研究成果をcheckpoint化し、2分岐×2世代 = 4 worldへ並列継承する研究サイクルです。

## 継承するもの

- current Git HEAD / refs digest
- commit / merge history（2x2 Git mirrorを `git_mesh.py` で作成）
- `.github/workflows` 定義
- RED / Senju / META / X の研究メモリ要約
- 前世代checkpoint lineage

研究優先度は RED 40%、Senju 20%、META 20%、X 20%。4 worldは同時生成されるため、世代生成自体を直列化しません。

## 周期

`.github/workflows/strong-new-game-3h.yml`

```text
0 */3 * * *
```

1サイクル:

```text
current merged Git state
        ↓
RED / Senju / META / X を収集・要約
        ↓
previous checkpoint と結合
        ↓
2 x 2 Git mirror reconcile
        ↓
world-1 ─┐
world-2 ─┼─ parallel research seed
world-3 ─┤
world-4 ─┘
        ↓
checkpoint.json
        ↓
次の3時間サイクル
```

## 合成ラボ

`synthetic-labs.json` に `.invalid` reserved domainを使った16種類のresearch surfaceを定義しています。実ホストの許可範囲を勝手に広げず、authorization / session / parser / workflow / cache / recovery / concurrency等の異なる膠着パターンを研究できます。

## 継承しないもの

credential、Authority grant、外部side effectは研究checkpointから自動継承しません。Guard policyはこのサイクルでは変更せず、現在状態をそのまま維持します。

## 手動実行

```bash
python the-world-strong-new-game/strong_new_game.py build \
  --output /tmp/strong-new-game
python the-world-strong-new-game/strong_new_game.py verify \
  --output /tmp/strong-new-game

python the-world-5th-power/git_mesh.py reconcile \
  --runtime /tmp/strong-new-game-git \
  --branching 2 --generations 2 --workers 4
```
