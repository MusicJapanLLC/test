# The world の5乗 — Git-native mesh

`MusicJapanLLC/test` のGit世界を、5分岐×5世代で完全複製し、下位から上位へ状態を集約します。

## 実体

- 完全Git mirror（leaf）: 3,125
- 集約Git repository（親・root）: 781
- 合計Git node: 3,906
- leafはtestと同じHEAD・branch・tag・commit graph・merge commitを保持
- 各親は5つの子のrefsと状態manifestをcommit
- 最上位rootは全3,125世界の状態を1つのaggregate commitへ収束

Gitオブジェクトは共有ストアを使うため、履歴を数千回物理重複させずに、各leafは独立したrefsを持つ完全Git repositoryとして存在します。

## 実行

```bash
python the-world-5th-power/git_mesh.py reconcile
python the-world-5th-power/git_mesh.py verify
```

`reconcile` の伝播順:

```
test
→ 3,125 leaf mirrors
→ 625 parents
→ 125 parents
→ 25 parents
→ 5 parents
→ 1 root
```

testに新しいcommit・merge commit・branch・tagが入った後に `reconcile` を再実行すると、全leafを同期し、変更された親manifest commitを下から上へ作り直します。

## 実証結果

本番値 `--branching 5 --generations 5` で実行済み。

```json
{
  "ok": true,
  "leaf_count": 3125,
  "mismatched_leaves": 0,
  "total_git_nodes": 3906
}
```
