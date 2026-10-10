/**
 * ご要望フォームの選択肢。ページの描画（render/request.ts）とブラウザ側の動き（lib/request-form.ts）の両方で使う
 */
export const REQUEST_TYPES = [
  {
    id: 'bug',
    label: 'バグを見つけた',
    note: '見つけた人が、いちばん偉い。',
    placeholder:
      'どこで・何をしたら・どうなったかを教えてください。\n例）村長が、海の上を歩いていました。',
  },
  {
    id: 'idea',
    label: 'こうしたらいいやん',
    note: 'その一言、採用するかもしれません。',
    placeholder: '思いついたこと、そのまま書いてください。\n例）ギルドのみんなで記念写真を撮れる機能がほしい。',
  },
  {
    id: 'love',
    label: 'ここが好き',
    note: '開発チームの燃料になります。',
    placeholder: '好きなところを、好きなだけ。\n例）灯の旅路の宿屋のBGMが、ずっと聴いていられる。',
  },
  {
    id: 'other',
    label: 'そのほか',
    note: 'なんでもどうぞ。',
    placeholder: 'ご質問、取材のご相談、そのほか何でもどうぞ。',
  },
] as const;

export const SEVERITY = [
  '気のせいかも',
  'ちょっと気になる',
  'けっこう困る',
  '進めない',
  '世界がバグってる',
] as const;
