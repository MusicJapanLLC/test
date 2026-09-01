# The world の5乗（test内完結）

このディレクトリは、`MusicJapanLLC/test` の世界を5分岐×5世代へ複製し、Git状態を保ったまま階層的に集約します。

- 最終世代: 3,125 leaf repositories
- 親集約: 625 → 125 → 25 → 5 → 1 root
- Git mirror: branches / tags / merge history をleafへ同期
- 集約: 各親が5つの子repoのrefs/objectsを取り込む
- 全世界共有: `runtime/shared/events.jsonl`

## 速度を上げるGit-native実行

`git_mesh.py` はleaf同期と同一階層の親集約をworker poolで並列実行します。各階層はfan-outして処理し、全グループ完了後に次世代へfan-inするため、親子整合性を保ったまま並列化します。

```bash
# 並列実行（worker数はCPUに合わせて自動設定、上限32）
python the-world-5th-power/git_mesh.py reconcile

# worker数を明示
python the-world-5th-power/git_mesh.py reconcile --workers 20

# 直列基準。速度比較用
python the-world-5th-power/git_mesh.py reconcile --workers 1

# 並列verify
python the-world-5th-power/git_mesh.py verify --workers 20
```

`registry.json` の `performance` に、leaf同期時間・各集約レベル時間・総処理時間・worker数を記録します。実環境では `--workers 1` と複数workerの `total_seconds` を比較して、実効速度向上を確認します。

## 軽量snapshot / shared bus

```bash
python the-world-5th-power/world_mesh.py build
python the-world-5th-power/world_mesh.py materialize --world 1.2.3.4.5
python the-world-5th-power/world_mesh.py publish --world 1.2.3.4.5 --message "共有情報"
python the-world-5th-power/world_mesh.py sync --world 5.4.3.2.1
python the-world-5th-power/world_mesh.py verify
```

軽量版は階層・共有情報の表現用です。処理速度向上を目的とする場合は `git_mesh.py` の並列fan-out/fan-inを使用します。
