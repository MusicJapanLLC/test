# The world の5乗（test内完結）

このディレクトリは、`MusicJapanLLC/test` の世界を5分岐×5世代へ複製します。

- 元世界: Git commit `e784dfe4b35f73a5b3d1cfe7f3f48d30af864aa5`
- 最終世代: 3,125個の完全スナップショット
- 中間ノード込み: 3,905個
- 配置: `runtime/worlds/<1..5>/<1..5>/.../`
- 全世界共有: `runtime/shared/events.jsonl`

各世界は元コミットを指す軽量スナップショットです。必要な世界だけ `materialize` すると、元のtest世界の内容をそのまま展開します。生成された階層自体はコピー元から除外するため、再帰爆発しません。

```bash
python the-world-5th-power/world_mesh.py build
python the-world-5th-power/world_mesh.py materialize --world 1.2.3.4.5
python the-world-5th-power/world_mesh.py publish --world 1.2.3.4.5 --message "共有情報"
python the-world-5th-power/world_mesh.py sync --world 5.4.3.2.1
python the-world-5th-power/world_mesh.py verify
```
