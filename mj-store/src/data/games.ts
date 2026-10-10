import type { Game, GameStatus, Shot } from './types';

/**
 * MJ STORE に並ぶゲーム。
 *
 * 新作を足すときは、この配列に1件追加するだけでよい。
 * トップの特集・棚、作品一覧、ストアページ（/games/<slug>/）、隠しモードの町、
 * sitemap.xml・llms.txt・構造化データまで自動で増える。
 *
 * - スクリーンショットは public/shots/<id>/ に置いて shots に並べる（1枚目がタイトル画面）
 * - playUrl を入れると「配信中」になり、プレイボタンが有効になる
 * - news / versions は新しい順に並べる。中身は実際の更新内容から書く
 */

const phone = (dir: string, name: string, alt: string, caption: string): Shot => ({
  src: `shots/${dir}/${name}.webp`,
  w: 720,
  h: 1558,
  alt,
  caption,
});

/** スマホのブラウザで遊んでいる画面（アドレスバーとタブバーのぶん背が低い）。ストアではブラウザごと見せる */
const mobile = (dir: string, name: string, alt: string, caption: string): Shot => ({
  src: `shots/${dir}/${name}.webp`,
  w: 720,
  h: 1233,
  alt,
  caption,
});

const wide = (dir: string, name: string, alt: string, caption: string): Shot => ({
  src: `shots/${dir}/${name}.webp`,
  w: 1440,
  h: 900,
  alt,
  caption,
});

export const games: Game[] = [
  {
    id: 'world',
    slug: 'the-world',
    title: 'The World',
    subtitle: 'ひとつの焚き火から',
    titleEn: 'THE WORLD',
    catch: ['マ○クラ？', '違いますってwww'],
    catchNote: '不思議を見つけ、暮らしをつくる。',
    lead: 'ひとつの焚き火から始まる、PCで遊ぶドット絵の暮らしと街づくり。木を切り、家を建て、住民と働きながら、この世界にしかない「不思議な法則」を見つけていく。',
    description: [
      '雨を蓄える石。夜にだけ花ひらく森。この世界には、ここにしかない法則が息づいています。見つけた不思議は観察帳に記録され、あなたの街の灯りや暮らしにつながっていきます。',
      '住民を雇って仕事を任せ、家を増築して家具を置く。夜は自分の寝床で一日を終え、朝には日記が届きます。日記に残るのは、その日あなたの街で本当に起きたことだけ。',
    ],
    genre: '暮らし・街づくり',
    platforms: ['PC'],
    languages: ['日本語', 'English', '한국어'],
    playUrl: 'https://game.music-japan.com/world/',
    currentVersion: 'Nightfall（prototype05）',
    tags: ['街づくり', '暮らし', 'ドット絵', 'クラフト', 'PCブラウザ'],
    features: [
      {
        title: '不思議な法則を、見つける',
        body: '雨を蓄える石、夜に花ひらく森。観察帳に記録した不思議が、街の灯りや暮らしにつながっていきます。',
      },
      {
        title: '住民と、家と、一日',
        body: '住民を雇って仕事を任せ、家を増築して家具を置く。夜は寝床で眠り、朝には日記が届きます。',
      },
      {
        title: '音まで、この世界のために',
        body: 'オリジナルBGMに、川のせせらぎ、森の葉音、屋根を濡らす雨の音。BGM・環境音・効果音はそれぞれ音量を変えられます。',
      },
    ],
    review: '気づいたら、朝でした。',
    controls: 'キーボードとマウスで遊びます。WASD／矢印キーで移動、左クリック長押しで採集、Tabで制作、Eで調べる・入る、Bで建築。',
    save: '進行はブラウザに自動で保存され、「保存した世界から、続きを」で再開できます。',
    music: 'タイトル曲・フィールド曲・夜の曲はオリジナル音楽です。',
    faq: [
      {
        q: 'マインクラフトに似ていますか？',
        a: '違います。The Worldは上から見下ろすドット絵の2Dの世界で、街づくりと暮らし、そして世界の「不思議な法則」を見つけることが中心のゲームです。',
      },
      {
        q: 'スマホでも遊べますか？',
        a: 'キーボードとマウスでの操作を前提にしたPC向けのゲームです。PCのブラウザで遊んでください。',
      },
      {
        q: '何語で遊べますか？',
        a: '日本語・英語・韓国語に対応しています。設定から切り替えられます。',
      },
    ],
    theme: {
      skin: 'pixel',
      font: "'DotGothic16', 'Zen Kaku Gothic New', sans-serif",
      latinWidth: 0.5,
      scheme: 'dark',
      bg: '#0D1915',
      surface: '#152721',
      ink: '#F1E9D2',
      mute: '#9DB0A1',
      line: 'rgba(214, 227, 200, 0.16)',
      accent: '#C5DCA8',
      accent2: '#E8C77A',
      onAccent: '#13221B',
      ambient: 'fireflies',
    },
    device: 'browser',
    cardShot: 1,
    cardFocus: '50% 50%',
    bot: { id: 'pod', line: '…夜の灯り、悪くない。ヘッドホンで遊んでみて' },
    shots: [
      wide('world', '01-title', 'The World のタイトル画面。川と村、雨晶の並ぶ草原を見下ろすドット絵の世界', 'タイトル'),
      wide('world', '02-field', 'はじまりの草原。焚き火と宝箱のそばに立つ旅人、川辺に並ぶ青い雨晶', 'はじまりの草原'),
      wide('world', '03-village', '住民が暮らす村。家と畑、街の気配をまとめたパネル', '住民が働く村'),
      wide('world', '04-home', '家の中。暖炉と寝床、家を増築するパネル', '家を育てる'),
      wide('world', '05-night', '夜の家。住民たちが寝床で一日を終える', '夜は家で眠る'),
    ],
    news: [
      {
        date: '2026-10-09',
        tag: 'アップデート',
        title: '「Nightfall」を配信しました',
        body: '夜は自分の家のベッドで眠り、朝には日記が届く。家で一日を終える遊びが加わりました。英語・韓国語にも対応しています。',
      },
      {
        date: '2026-10-08',
        tag: 'アップデート',
        title: '家に入れるようになりました',
        body: '小屋・交易宿・城の室内に入れるようになり、増築と家具の配置ができるようになりました。',
      },
    ],
    versions: [
      {
        version: 'prototype05',
        date: '2026-10-09',
        title: 'Nightfall ── 家で一日を終える',
        notes: [
          '夜19時から翌6時まで、家のベッドで眠って翌朝へ。体力・気力が回復',
          'その日の出来事を残す「日記」（14日分）',
          '日本語・英語・韓国語に対応',
          '実績15個と、好きな目標の固定表示',
          'BGM・環境音・効果音の個別の音量',
        ],
      },
      {
        version: 'prototype04',
        date: '2026-10-08',
        title: '家と暮らし',
        notes: [
          '小屋・交易宿・城の室内に入れるように',
          '家の増築3段階と、家具6種',
          '製材所で住民が木材を板材に加工',
          '街の困りごとが分かるパネル（Hキー）',
        ],
      },
    ],
  },
  {
    id: 'akari',
    slug: 'akari-no-tabiji',
    title: '灯の旅路',
    subtitle: '七つの灯',
    titleEn: 'SEVEN LIGHTS, ONE WAY HOME',
    catch: ['Music Japanが誇る', '王道異世界RPG'],
    catchNote: '七つの灯と、帰る場所。',
    lead: '鳴らない鐘を取り戻すため、アレンはひとりで旅に出る。30人の仲間と6体の灯霊、7章の物語をめぐる、ドット絵の戦術RPG。',
    description: [
      '第1章「ひとりの道しるべ」から始まる、七つの灯をめぐる旅。物語で出会う仲間と召喚で加わる仲間を編成し、手動とオートを切り替えながら戦います。',
      'NORMAL・HARD・EXPERTの3つの難度と、63の攻略目標。進行は端末に自動で保存されるので、少しずつ旅を続けられます。',
    ],
    genre: 'ドット絵 戦術RPG',
    platforms: ['スマホ', 'PC'],
    languages: ['日本語'],
    playUrl: 'https://game.music-japan.com/lantern-journey',
    currentVersion: '0.19',
    tags: ['RPG', '異世界', 'ドット絵', '戦術バトル', '7章の物語'],
    features: [
      {
        title: '30人の仲間と、6体の灯霊',
        body: '物語で出会う仲間に、召喚で加わる仲間。編成と育成で、自分だけのパーティをつくれます。',
      },
      {
        title: '手動とオートを切り替える戦術バトル',
        body: 'じっくり指示を出すのも、オートで流れを見守るのも自由。連携・猛攻・堅守の作戦と、仲間ごとのリミットスキルで戦況をひっくり返す、ドット絵のバトルです。',
      },
      {
        title: '七つの灯をめぐる物語',
        body: '全7章、3つの難度、63の攻略目標。鐘の鳴らない港町から、帰る場所を探す旅へ。',
      },
    ],
    review: '王道は、やっぱり強い。',
    controls: 'タップとクリックで遊べます。戦闘は手動とオートを切り替えられます。',
    save: '進行は端末に自動で保存されます。',
    music: '旅の音楽もMusic Japanが手がけています。',
    faq: [
      {
        q: '難しいゲームですか？',
        a: 'NORMAL・HARD・EXPERTの3つの難度があり、オート戦闘にも対応しています。自分のペースで進められます。',
      },
    ],
    theme: {
      skin: 'lantern',
      font: "'Shippori Mincho B1', 'Zen Kaku Gothic New', serif",
      latinWidth: 0.62,
      scheme: 'dark',
      bg: '#08171D',
      surface: '#10252E',
      ink: '#F4EAD2',
      mute: '#A7B6B6',
      line: 'rgba(227, 194, 122, 0.2)',
      accent: '#E3C27A',
      accent2: '#F08A4B',
      onAccent: '#1A1206',
      ambient: 'lanterns',
    },
    device: 'phone',
    cardFocus: '50% 60%',
    bot: { id: 'tune', line: '王道RPG、大好き！ 仲間集め、たのしいよ！' },
    shots: [
      {
        ...phone('lantern', '01-title', '灯の旅路のタイトル画面。夕日の海と港町を見下ろす、旅立ちの一行', 'タイトル'),
        focus: '50% 62%',
      },
      mobile(
        'lantern',
        '02-home',
        'ホーム画面。灯のともる石畳の坂道を仲間たちが歩く。第2章「息を返す祠」へ出発する「冒険へ出る」ボタンと、育成・航路パス・潮灯祭のメニュー',
        'ホーム ── 第2章「息を返す祠」',
      ),
      mobile(
        'lantern',
        '03-battle',
        '戦闘画面。声喰いの主・セイルとの戦いで、ソルのリミットスキル「日輪の福音」が発動。アレン・ミナ・ソル・セラの体力と技ゲージ、オートと手動の切り替え、連携・猛攻・堅守の作戦',
        'バトル ── リミットスキル発動',
      ),
      mobile(
        'lantern',
        '04-victory',
        'ステージ2-3「息を返す祠」のクリア画面「灯をつないだ」。ゴールド・灯晶・技書・覚醒印・灯輝石・経験値の獲得と、「物語の続きを見る」ボタン',
        'クリア ── 灯をつないだ',
      ),
      mobile(
        'lantern',
        '05-summon',
        '召喚画面「灯に集う者たち」。26人の召喚仲間から3人のイラストと「運命の灯を、つなごう」の文字',
        '召喚 ── 灯に集う者たち',
      ),
      mobile(
        'lantern',
        '06-companions',
        '召喚の結果画面「新しい灯が、ここに」。SRのゼノ（紫電の槍士）とSSRのシズク（雨音の剣姫）が新しく仲間に加わる',
        '新しい仲間 ── ゼノとシズク',
      ),
    ],
    news: [
      {
        date: '2026-10-09',
        tag: '配信',
        title: '『灯の旅路』を game.music-japan.com で公開しました',
        body: 'ブラウザで、そのまま旅に出られます。',
      },
    ],
    versions: [
      {
        version: 'v0.18',
        date: '2026-10-09',
        title: '物語の仲間と、灯霊の加護',
        notes: [
          '会話欄を画面下のコンパクトなパネルに',
          '主要キャラクターに表情つきの専用イラスト',
          '森の蝶、海の反射、工房の火の粉などの演出',
          '敵の行動ごとのエフェクトと、ステージ名・WAVEの表示',
          '装備のレア度・装備者・交換前後の戦力を表示',
          '新しい灯霊6体と、物語の仲間を支える支援枠',
        ],
      },
    ],
  },
  {
    id: 'soncho',
    slug: 'soncho-sekai',
    title: '村長、世界まで行くんですか？',
    subtitle: '村営ゲーム課',
    titleEn: 'MAYOR, ALL THE WAY TO THE WORLD?',
    catch: ['世界？', '逆になんで見てないの？'],
    catchNote: '引っ越しても、上司は同じ。',
    lead: '採る。積む。運ぶ。引っ越す。辞令ひとつで村長になったあなたが、12人の相棒と18の土地をめぐって、村ごと旅をするドット絵の村づくりゲーム。',
    description: [
      '昼は木を切り、石を掘り、ごはんを集めて小屋を建てる。日が沈むと、焚き火の外からゾンビがやってくる。防壁と見張り台で、村と住民を朝まで守り抜きましょう。',
      '住民は、人数よりクセで育てる。「朝礼は踊ってから」「夜勤は聞いてない」。クセの強い仲間たちと、家ごと（いや、家以外）引っ越していく旅です。',
    ],
    genre: '村づくり × 防衛',
    platforms: ['スマホ', 'PC'],
    languages: ['日本語'],
    playUrl: 'https://game.music-japan.com/mayor/',
    currentVersion: 'TWELVE06',
    tags: ['村づくり', 'サバイバル', 'ドット絵', '防衛', '引っ越し'],
    features: [
      {
        title: '採る。積む。運ぶ。',
        body: '指でドラッグして歩き、木や石のそばで止まれば自動で採集。集めた資材で、小屋・倉庫・見張り台を建てていきます。',
      },
      {
        title: '夜は、村を守る時間',
        body: '日が沈むとゾンビが村を囲む。防壁と衛兵、灯火の安全圏で朝まで耐えれば、朝日が敵を焼き払います。',
      },
      {
        title: '12人の相棒と、18の土地',
        body: 'クセの強い住民たちと、18の土地へ村ごと引っ越し。全部オートセーブなので、セーブ係は雇わなくていい。',
      },
    ],
    review: '村長、本当に行った。',
    controls: '画面をドラッグして歩き、木や石のそばで指を離すと自動で採集します。下のメニューから建設・住民・世界・村長室へ。',
    save: '全部オートセーブです。閉じても、続きから再開できます。',
    music: '音楽と効果音もMusic Japanがつくっています。',
    faq: [
      {
        q: 'ゾンビは怖いですか？',
        a: 'ドット絵でコミカルに描いています。夜は防壁と衛兵で村を守り、朝が来れば日光で敵が燃えていきます。',
      },
    ],
    theme: {
      skin: 'paper',
      font: "'DotGothic16', 'Zen Kaku Gothic New', sans-serif",
      latinWidth: 0.5,
      scheme: 'light',
      bg: '#E9E1BF',
      surface: '#F5EFD6',
      ink: '#1F2D26',
      mute: '#5C695D',
      line: '#1F2D26',
      accent: '#A64B38',
      accent2: '#3E6B4E',
      onAccent: '#FFF8E6',
      ambient: 'leaves',
    },
    device: 'phone',
    cardShot: 1,
    cardFocus: '50% 45%',
    bot: { id: 'spin', line: '村長…世界まで…行っちゃった…。ついてく…' },
    shots: [
      phone('mayor', '01-title', '村長、世界まで行くんですか？のタイトル画面。辞令の書類と、家を荷車に積んで引っ越す住民たち', 'タイトル'),
      phone('mayor', '02-village', '昼の村。焚き火の就任所と、まわりの森に立つ村長', '辞令だけは立派な村'),
      phone('mayor', '03-explore', '川辺の探索。村長が歩きながら資源を集める', '採る。積む。運ぶ。'),
      phone('mayor', '04-night', '夜の村。焚き火に集まるゾンビと戦う村長', '夜は、村を守る時間'),
    ],
    news: [
      {
        date: '2026-10-09',
        tag: 'アップデート',
        title: '「TWELVE06」を配信しました',
        body: '少人数の住民それぞれに職歴が生まれ、村ごとの引っ越しとスマホ向けの画面になりました。',
      },
    ],
    versions: [
      {
        version: 'TWELVE06',
        date: '2026-10-09',
        title: '少数精鋭の村へ',
        notes: ['住民ひとりひとりの職歴', '村ごとの引っ越し', 'スマホ向けの画面に刷新'],
      },
      {
        version: 'Caravan18',
        date: '2026-10-09',
        title: '18の土地へ、村ごと',
        notes: ['村の引っ越しと18の土地', '表情ゆたかな住民', 'オートセーブ', '衛兵を配置して守る夜の防衛'],
      },
      {
        version: 'Living04',
        date: '2026-10-09',
        title: '村長、就任',
        notes: ['game.music-japan.com/mayor/ で公開'],
      },
    ],
  },
  {
    id: 'guild',
    slug: 'guild-no-akari',
    title: 'ギルドの灯',
    subtitle: 'GUILD OF LANTERNS',
    titleEn: 'GUILD OF LANTERNS',
    catch: ['SNSで戦う', '新感覚ギルド育成ゲーム'],
    catchNote: 'いいねは、攻撃力だ。',
    lead: 'ボロボロの冒険者ギルドを、灯りのともる大ギルドへ。冒険者を依頼に送り出し、帰ってきた冒険譚をショート動画のように見届ける、ギルド経営×放置ゲーム。',
    description: [
      '依頼を受けて冒険者を派遣すると、結果は「冒険譚」として届きます。上にスワイプで次へ、ダブルタップで応援。コメント欄には、ギルドの仲間や受付のリナが書き込みます。',
      '報酬で施設を建て、ギルドランクを上げるほど、自動回収や自動派遣が解放されて快適に。留守のあいだも時間は進むので、寝る前に長い依頼を出しておけます。',
    ],
    genre: 'ギルド経営 × 放置',
    platforms: ['スマホ', 'PC'],
    languages: ['日本語'],
    playUrl: 'https://game.music-japan.com/',
    currentVersion: '2026.10.08',
    tags: ['放置ゲーム', 'ギルド経営', 'ショート動画', 'ハクスラ', 'ファンタジー'],
    features: [
      {
        title: '冒険譚は、ショート動画で届く',
        body: '派遣の結果は縦スワイプの動画フィードで。応援すると冒険者との絆が深まり、戦力も少し上がります。',
      },
      {
        title: '断面図のギルドが、育っていく',
        body: '受付ホール、宿舎、酒場。施設を建てるたびに、冒険者や町の人が動き回る断面図がにぎやかになります。',
      },
      {
        title: '曲は、このゲームのための書き下ろし',
        body: 'ギルドの曲「灯りの酒場」、冒険譚の曲「草原を行け」。ティンホイッスルやハープ、フィドルで奏でるオリジナル曲です。',
      },
    ],
    review: 'タイムラインが、戦場だった。',
    controls: 'タップとスワイプで遊べます。冒険譚は上にスワイプで次へ、ダブルタップで応援。',
    save: '数秒ごと、そして画面を離れた瞬間に自動で保存されます。手動セーブもできます。',
    music: 'BGMはこのゲームのために作曲したオリジナル曲です。',
    faq: [
      {
        q: '放置していても進みますか？',
        a: '進みます。時間は実際の時刻で計算されるので、留守のあいだも依頼は進みます。寝る前に長い依頼を出しておけます。',
      },
      {
        q: '冒険譚ってなんですか？',
        a: '派遣した冒険者の戦いぶりを、ショート動画のように縦スワイプで見られる機能です。見ると報酬を受け取れて、応援やコメントも楽しめます。',
      },
    ],
    theme: {
      skin: 'feed',
      font: "'Shippori Mincho B1', 'Zen Kaku Gothic New', serif",
      latinWidth: 0.62,
      scheme: 'dark',
      bg: '#070B18',
      surface: '#111A33',
      ink: '#F3EBD7',
      mute: '#9AA3BF',
      line: 'rgba(232, 194, 90, 0.18)',
      accent: '#E8C25A',
      accent2: '#FF6B8A',
      onAccent: '#1A1204',
      ambient: 'embers',
    },
    device: 'phone',
    cardFocus: '50% 46%',
    bot: { id: 'mic', line: 'いいねで強くなるって、最高じゃない？' },
    shots: [
      phone('guild', '01-title', 'ギルドの灯のタイトル画面。山あいの町にそびえる、灯りのともるギルドの塔', 'タイトル'),
      phone('guild', '02-guild', 'ギルドの断面図。依頼に出発する冒険者と、受付のリナ', '断面図のギルド'),
      phone('guild', '03-quests', '依頼の掲示板。草原のスライム退治と成功率', '依頼を受ける'),
      phone('guild', '04-reel', '冒険譚の戦闘。スライムと戦う戦士と、流れるコメント', '冒険譚は動画で届く'),
      phone('guild', '05-comments', '冒険譚のコメント欄。ギルドの仲間たちの書き込み', 'コメント欄もにぎやか'),
      phone('guild', '06-facilities', '施設の画面。受付ホールと宿舎の強化', 'ギルドを育てる'),
    ],
    news: [
      {
        date: '2026-10-08',
        tag: 'アップデート',
        title: '冒険譚と装備の大型アップデート',
        body: '敵の行動10種とマスターの指示、24種類の装備と刻印、宝箱の新しい演出が加わりました。',
      },
      {
        date: '2026-10-04',
        tag: 'イベント',
        title: '期間限定イベント「かぼちゃ灯籠祭」開催中',
        body: 'ギルドがかぼちゃの灯りで彩られる、期間限定のお祭りです。',
      },
    ],
    versions: [
      {
        version: '2026.10.08',
        date: '2026-10-08',
        title: '冒険譚と装備の大型アップデート',
        notes: [
          '敵の行動10種と、マスターの指示',
          '装備24種類・刻印・URの覚醒',
          '宝箱を開ける演出を一新、初回10連はSSR確定',
          '実績と称号、周回の記録',
          '戦闘背景の住人たちと、BGMの刷新',
        ],
      },
      {
        version: '2026.10.04',
        date: '2026-10-04',
        title: 'かぼちゃ灯籠祭',
        notes: [
          '期間限定イベント「かぼちゃ灯籠祭」',
          'ゴールドの市と両替、裏の桟橋で釣り',
          'ギルドの再建と灯火の星、新職業3種・新エリア2つ',
          'デイリー・週間任務、BGMを7曲追加',
        ],
      },
      {
        version: '2026.10.03',
        date: '2026-10-03',
        title: '「ギルドの灯」誕生',
        notes: ['ギルド経営×放置ゲームとしての最初の版', '装備・技・持ち物・ショップ・ログインボーナス'],
      },
    ],
  },
];

export function statusOf(g: Game): GameStatus {
  return g.status ?? (g.playUrl ? 'live' : 'soon');
}

/** カード・メニュー・一覧に使う絵 */
export const cardArt = (g: Game) => g.shots[g.cardShot ?? 0] ?? g.shots[0];

export const STATUS_LABEL: Record<GameStatus, string> = {
  live: '配信中',
  soon: '近日配信',
  dev: '開発中',
};

export function gameBySlug(slug: string): Game | undefined {
  return games.find((g) => g.slug === slug);
}

/** 作品ごとの「よくある質問」。共通の質問＋作品固有の質問 */
export function faqOf(g: Game, requestUrl: string) {
  return [
    {
      q: `『${g.title}』は無料で遊べますか？`,
      a: '基本プレイ無料です。ゲーム内課金（任意）があります。',
    },
    {
      q: 'どこで遊べますか？ インストールは必要ですか？',
      a: `ブラウザで ${g.playUrl} を開くだけで遊べます。アプリのインストールは不要です。対応：${g.platforms.join('・')}。`,
    },
    { q: '操作方法は？', a: g.controls },
    { q: 'セーブはどうなりますか？', a: g.save },
    {
      q: '誰がつくっていますか？',
      a: `合同会社Music Japanです。音楽も、物語も、システムも、すべて自社で制作しています。${g.music}`,
    },
    ...g.faq,
    {
      q: 'バグを見つけたら、どうすればいいですか？',
      a: `MJ STOREの「ご要望・バグ報告」（${requestUrl}）から送ってください。開発チームが全部読んで、次のアップデートに活かします。`,
    },
  ];
}
