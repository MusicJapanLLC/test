/**
 * 描画の重さの見張り役（ページ内のすべての WebGL シーンで共有）。
 *
 * GPU の弱い端末では 1 回の描画が長くなり、スクロールや操作が詰まる（Core Web Vitals の INP / TBT が悪化する）。
 * 最初の数フレームで描画にかかった時間を測り、重ければ段階的に落とす。
 *   0 … そのまま
 *   1 … 軽量：画素を減らし、1コマおきに描く
 *   2 … 静止：動かさず、スクロールで場面が変わったときだけ描き直す
 * GPU のある端末では描画はすぐ終わるので、0 のまま動く。
 */
export type PerfLevel = 0 | 1 | 2;

let level: PerfLevel = 0;
const subs = new Set<(l: PerfLevel) => void>();
let sum = 0;
let n = 0;

const WINDOW = 6; // 何フレームの平均で判断するか
const SLOW = 34; // コマの間隔の平均がこれより長ければ（30fps未満）1段落とす（ms）
const VERY_SLOW = 90; // 平均がこれより長ければ、すぐ静止にする（ms）

export const perfLevel = (): PerfLevel => level;

export function onPerfLevel(fn: (l: PerfLevel) => void): void {
  subs.add(fn);
}

function set(next: PerfLevel) {
  if (next <= level) return;
  level = next;
  subs.forEach((fn) => fn(level));
}

/**
 * 前のコマから次のコマまでの間隔（ms）を報告する。
 * 描画命令はすぐ返っても、GPU が追いつかないとコマの間隔が伸びる。間隔で見れば実際の重さが分かる。
 * シェーダーの準備が入る最初の数フレームは呼ばない。
 */
export function reportFrame(ms: number): void {
  if (level === 2) return;
  sum += ms;
  n += 1;
  if (n < WINDOW) return;
  const avg = sum / n;
  sum = 0;
  n = 0;
  if (avg > VERY_SLOW) set(2);
  else if (avg > SLOW) set((level + 1) as PerfLevel);
}
