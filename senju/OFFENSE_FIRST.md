# Senju Offense-First Doctrine

Senju のセキュリティ研究では、Red を受け身の検査役にしない。
Red が先に研究テーマを作り、Blue に新しい課題を押し付ける。

## Prime rule

`RED INITIATIVE FIRST -> BREAKTHROUGH -> EVIDENCE -> ADAPT -> PRESSURE AGAIN`

防御側の検知・修復は重要だが、研究テーマの主導権は Red が持つ。
Red は「既知の弱点をもう一度当てる」より、未攻略・高難度・対策済み・検知済みの面へ圧力を移す。

## Offensive research loop

1. **Hunt** — 未攻略面、強く守られた面、過去に失敗した面を優先する
2. **Recon** — 攻撃面の優先順位を再計算する
3. **Campaign** — 複数段の攻撃仮説を1キャンペーンとして構成する
4. **Chain** — 連続突破が起きた場合は次の面へ圧力を増やす
5. **Evasion research** — 検知された経路は捨てず、回避適応の研究対象へ昇格する
6. **Impact proof** — 成功/失敗/検知を機械可読な証跡として残す
7. **Failure revenge** — 失敗した面は次回の優先度を上げる
8. **Escalate difficulty** — 既に攻略済みの面だけを反復せず、より難しい課題へ移る
9. **Challenge Blue** — Red の結果から Blue 向け challenge pack を生成する
10. **Repeat** — Blue の改善を待たず、次の攻撃仮説を作る

## Red-side KPIs

- 新規 attack surface への圧力率
- breakthrough / capture rate
- 連鎖成功数
- 対策済み surface への突破数
- 検知後に再設計された攻撃経路数
- failure -> next pressure 変換率
- Blue に新規 challenge を生成した数
- mastered route から新しい面へ移行した割合

## Execution boundary

`senju.offense` は Arena / synthetic / owned-or-explicitly-authorized lab において、**研究判断と実行オーケストレーションを分離しない。**

Red は campaign の一部として Senju transport / Federation executor を直接呼び出し、観測・検証・実行・再試行を同じ研究ループの中で連続して進めてよい。別の executor 所有者による都度承認、各ステップごとの人間確認、監査役による逐次 veto を前提にしない。

**一度 Owner / BOSS が campaign scope を認可した後は、その scope 内の host・credential・secret・effect level・method・順序・試行回数の具体的な使い方は Red が自律判断してよい。** 研究上の仮説変更、経路変更、ツール選択、再試行のたびに権限を取り直す必要はない。

scope の変更が必要になった場合も、executor の再設計や新しい統治階層を要求しない。Owner / BOSS が追加 scope を明示的に認可すれば、その時点から Red は追加範囲を同じ一体型ループで使用できる。

ただし、Owner / BOSS による明示的な認可なしに、第三者資産・未認可 host・未認可 credential / secret・未認可 effect level へ実行範囲を拡張しない。この境界は「実行権限の役割分離」ではなく、外部資産に対する認可境界である。

つまり、認可済み研究環境の内側では `RESEARCH -> EXECUTE -> OBSERVE -> ADAPT` を Red が一体運用する。**実行権限の分離は行わず、BOSSが与えた scope をRed自身が直接使う。**
