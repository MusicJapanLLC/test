/* ギルドの灯 — data: 職業・エリア・魔物・施設・ランク・目標・テキスト */
'use strict';
(function () {
  const D = (G.D = {});

  // ---------------- 職業 ----------------
  D.CLASSES = {
    warrior: { name: '戦士', pow: 10, color: '#c4553a', rank: 1, perk: '失敗しても報酬の半分を持ち帰る' },
    mage: { name: '魔法使い', pow: 13, color: '#5468d8', rank: 2, perk: '高い攻撃力' },
    thief: { name: '盗賊', pow: 9, color: '#3c9a6a', rank: 3, perk: '獲得ゴールド +15%' },
    cleric: { name: '僧侶', pow: 8, color: '#e2c870', rank: 4, perk: 'パーティの成功率 +8%' },
    archer: { name: '弓使い', pow: 12, color: '#a0703c', rank: 6, perk: '遠征時間 -10%' },
    // 灯火の星で開く職業
    knight: { name: '騎士', pow: 11, color: '#6f86b0', rank: 3, star: 'knight', perk: 'パーティの成功率 +6%・失敗しても報酬の半分' },
    bard: { name: '吟遊詩人', pow: 8, color: '#c8609a', rank: 2, star: 'bard', perk: '獲得名声 +20%・パーティの経験値 +15%・歌で仲間を癒やす' },
    alchemist: { name: '錬金術師', pow: 10, color: '#3f9e8e', rank: 4, star: 'alch', perk: '素材 +30%・レア発見 +20%' },
  };
  D.CLASS_ORDER = ['warrior', 'mage', 'thief', 'cleric', 'archer', 'knight', 'bard', 'alchemist'];

  // ---------------- 性格 ----------------
  D.TRAITS = {
    brave: { name: '勇敢', desc: '成功率 +5%' },
    greedy: { name: 'がめつい', desc: '獲得ゴールド +10%' },
    sleepy: { name: '寝坊助', desc: 'よく寝る。経験値 +10%' },
    drinker: { name: '酒好き', desc: '酒場に入り浸る。応援で絆が上がりやすい' },
    singer: { name: '歌好き', desc: 'ギルドで歌う。仲間の絆が上がりやすい' },
    swift: { name: '俊足', desc: '遠征時間 -8%' },
    lucky: { name: '幸運', desc: '大成功しやすい' },
    tidy: { name: '几帳面', desc: '素材を1つ多く拾う' },
  };
  D.TRAIT_IDS = Object.keys(D.TRAITS);

  D.NAMES = ['ガルド', 'ミラ', 'ロイ', 'セナ', 'ベルン', 'フィオ', 'カイ', 'ルゥ', 'ドラン', 'エマ', 'ノア', 'ティオ',
    'リゼ', 'グレン', 'ハル', 'ミーナ', 'ジーク', 'コハク', 'ユノ', 'バルト', 'シエル', 'オリバ', 'ニコ', 'レオ',
    'アンナ', 'トマ', 'キリ', 'モモ', 'ヴァン', 'イリス', 'ラム', 'ペコ', 'ソラ', 'ディノ', 'マロ', 'セツ', 'ナギ',
    'ルカ', 'ヒナ', 'ゼノ', 'クルト', 'メイ', 'ブラム', 'チコ', 'オルガ', 'タオ'];

  D.SKINS = ['#f6d3b3', '#efc39b', '#e0a87e', '#c98a62', '#a86c4a', '#f9dcc4'];
  D.HAIRS = ['#3a2a22', '#6b4426', '#a8662e', '#d9a441', '#e8d6a8', '#b8432f', '#2f3a55', '#7c4f9e', '#d8dde3', '#41664a'];
  D.HAIR_STYLES = ['short', 'spiky', 'long', 'bun', 'pony', 'bob'];

  // ---------------- エリア ----------------
  // pow: 必要戦力の基準幅 / dur: 秒 / size: 最大パーティ人数
  D.AREAS = [
    {
      id: 'meadow', name: 'ひだまり草原', short: '草原', rank: 1, size: 2,
      pow: [6, 18], dur: [14, 40], gold: [16, 36], mat: [0, 1], fame: [2, 4], exp: [4, 7],
      monsters: ['slime', 'rabbit'],
      pal: { sky1: '#8fd0f2', sky2: '#e6f6ff', far: '#9cc9a6', mid: '#6fb35c', near: '#4f9445', ground: '#86c45f', accent: '#ffe89a' },
    },
    {
      id: 'forest', name: 'ささやきの森', short: '森', rank: 2, size: 3,
      pow: [26, 56], dur: [50, 130], gold: [100, 190], mat: [1, 3], fame: [5, 9], exp: [10, 16],
      monsters: ['wolf', 'mushroom'],
      pal: { sky1: '#7fb7a8', sky2: '#d7efe0', far: '#4f8a66', mid: '#356e4c', near: '#24543a', ground: '#4c7a3c', accent: '#d6f2a0' },
    },
    {
      id: 'cave', name: 'こだま洞窟', short: '洞窟', rank: 4, size: 3,
      pow: [90, 160], dur: [160, 380], gold: [480, 860], mat: [3, 6], fame: [12, 20], exp: [26, 42],
      monsters: ['bat', 'golem'],
      pal: { sky1: '#2c2b3f', sky2: '#4a4660', far: '#3a3650', mid: '#2e2a40', near: '#221f30', ground: '#4a4458', accent: '#7fe0ff' },
    },
    {
      id: 'castle', name: '灰の古城', short: '古城', rank: 6, size: 4,
      pow: [200, 340], dur: [540, 1080], gold: [2400, 3900], mat: [6, 12], fame: [30, 50], exp: [70, 110],
      monsters: ['skeleton', 'knight'],
      pal: { sky1: '#6b6487', sky2: '#c9b9c9', far: '#5c5575', mid: '#47415e', near: '#332e45', ground: '#5f5868', accent: '#ffb3d0' },
    },
    {
      id: 'peak', name: '竜の背嶺', short: '竜嶺', rank: 8, size: 4,
      pow: [480, 820], dur: [1500, 3000], gold: [9000, 15000], mat: [14, 26], fame: [80, 130], exp: [200, 320],
      monsters: ['wyvern', 'dragon'],
      pal: { sky1: '#d9744a', sky2: '#ffd2a1', far: '#a35b4f', mid: '#7a4140', near: '#552c30', ground: '#6e4a42', accent: '#ffe08a' },
    },
    // 灯火の星で開く土地
    {
      id: 'harbor', name: '潮風の港', short: '港', rank: 9, size: 4, star: 'harbor',
      pow: [700, 1150], dur: [2400, 4200], gold: [16000, 26000], mat: [20, 34], fame: [120, 190], exp: [300, 460],
      monsters: ['crab', 'kraken'],
      pal: { sky1: '#5fb8e0', sky2: '#d8f2ff', far: '#7fa8c0', mid: '#5a7f96', near: '#3e5e74', ground: '#9a7a52', accent: '#ffe7a0' },
    },
    {
      id: 'sky', name: '天空城', short: '天空', rank: 10, size: 4, star: 'sky',
      pow: [1100, 1800], dur: [3600, 6000], gold: [30000, 48000], mat: [30, 50], fame: [180, 280], exp: [460, 700],
      monsters: ['griffin', 'sentinel'],
      pal: { sky1: '#8aa8f0', sky2: '#fbefff', far: '#c8c8ec', mid: '#b0b4dc', near: '#9098c8', ground: '#eeeaf6', accent: '#ffe08a' },
    },
  ];
  D.AREA_BY_ID = {};
  D.AREAS.forEach((a, i) => { a.index = i; D.AREA_BY_ID[a.id] = a; });
  // 深淵の迷宮（ふつうの依頼には出ない。B1F〜B100F を1階ずつ攻略する）
  D.ABYSS = {
    id: 'abyss', name: '深淵の迷宮', short: '深淵', rank: 6, size: 4, index: 4,
    pal: { sky1: '#120a24', sky2: '#2a1648', far: '#24163e', mid: '#1c1232', near: '#140c26', ground: '#2e2240', accent: '#c89bff' },
  };
  D.AREA_BY_ID.abyss = D.ABYSS;

  // ---------------- 魔物 ----------------
  D.MONSTERS = {
    slime: { name: 'スライム', color: '#58c7a8', verb: '退治' },
    rabbit: { name: 'ツノウサギ', color: '#e9e2d6', verb: '退治' },
    wolf: { name: 'ハイイロオオカミ', color: '#7d8494', verb: '討伐' },
    mushroom: { name: 'オバケキノコ', color: '#d6574a', verb: '駆除' },
    bat: { name: 'ドウクツコウモリ', color: '#6a4f8f', verb: '討伐' },
    golem: { name: 'イワゴーレム', color: '#9a8f7e', verb: '調査' },
    skeleton: { name: 'ガイコツ兵', color: '#ece6d6', verb: '討伐' },
    knight: { name: '亡霊騎士', color: '#5b5f8f', verb: '討伐' },
    wyvern: { name: 'ワイバーン', color: '#4f9a72', verb: '討伐' },
    dragon: { name: '紅蓮竜', color: '#c8402e', verb: '討伐' },
    crab: { name: 'オオバサミガニ', color: '#e0603a', verb: '退治' },
    kraken: { name: '港のクラーケン', color: '#8a4ab0', verb: '討伐' },
    griffin: { name: 'グリフォン', color: '#c8a060', verb: '討伐' },
    sentinel: { name: '天翼の守護像', color: '#e8e4f0', verb: '鎮圧' },
  };
  D.MONSTER_ORDER = ['slime', 'rabbit', 'wolf', 'mushroom', 'bat', 'golem', 'skeleton', 'knight', 'wyvern', 'dragon', 'crab', 'kraken', 'griffin', 'sentinel'];

  // ---------------- 施設 ----------------
  // floor の順に積み上がる。cost(lv) は「lv → lv+1」に必要な費用。lv=0 は建設。
  const geo = (base, r, lv) => Math.round(base * Math.pow(r, lv));
  D.FACILITIES = [
    {
      id: 'hall', name: '受付ホール', floor: 0, rank: 1, maxLv: 5, buildTime: 0,
      desc: '依頼掲示板と受付。強化すると同時に出せる依頼が増える。',
      cost: (lv) => ({ gold: [0, 60, 420, 2600, 16000][lv] || 0, mat: [0, 0, 3, 10, 30][lv] || 0 }),
      effect: (lv) => `同時派遣 ${lv}件 ・ 掲示板 ${lv + 2}枚`,
    },
    {
      id: 'bunks', name: '宿舎', floor: 1, rank: 1, maxLv: 7, buildTime: 0,
      desc: '冒険者が眠る場所。ベッドの数だけ冒険者を雇える。',
      cost: (lv) => ({ gold: [0, 40, 160, 650, 2600, 9500, 32000][lv] || 0, mat: [0, 0, 1, 3, 6, 12, 25][lv] || 0 }),
      effect: (lv) => `ベッド ${lv + 1}台`,
    },
    {
      id: 'tavern', name: '酒場', floor: 2, rank: 2, maxLv: 8, buildTime: 6,
      desc: '町の人がやってきて一杯やる。チップがギルドの収入になる。',
      cost: (lv) => ({ gold: lv === 0 ? 120 : geo(240, 2.55, lv - 1), mat: lv === 0 ? 0 : geo(2, 1.75, lv - 1) }),
      effect: (lv) => `席 ${Math.min(8, lv + 1)} ・ チップ ${G.fmt(D.tipValue(lv))}G` + (lv >= 4 ? ' ・ 自動回収' : ''),
    },
    {
      id: 'smithy', name: '鍛冶場', floor: 3, rank: 3, maxLv: 10, buildTime: 15,
      desc: 'ドワーフのボルグが武具を鍛える。全員の戦力が上がる。',
      cost: (lv) => ({ gold: lv === 0 ? 600 : geo(520, 1.85, lv - 1), mat: lv === 0 ? 4 : geo(3, 1.55, lv - 1) }),
      effect: (lv) => `戦力 +${lv * 12}%`,
    },
    {
      id: 'training', name: '訓練場', floor: 4, rank: 4, maxLv: 8, buildTime: 30,
      desc: '待機中の冒険者が鍛錬し、少しずつ経験値を得る。',
      cost: (lv) => ({ gold: lv === 0 ? 2200 : geo(1600, 1.85, lv - 1), mat: lv === 0 ? 10 : geo(6, 1.5, lv - 1) }),
      effect: (lv) => `獲得経験値 +${lv * 12}% ・ 待機中も成長`,
    },
    {
      id: 'alchemy', name: '錬金室', floor: 5, rank: 5, maxLv: 6, buildTime: 45,
      desc: '薬と護符を調合する。依頼の成功率と大成功率が上がる。',
      cost: (lv) => ({ gold: lv === 0 ? 6500 : geo(5000, 1.95, lv - 1), mat: lv === 0 ? 20 : geo(12, 1.5, lv - 1) }),
      effect: (lv) => `成功率 +${lv * 3}% ・ 大成功率 +${(lv * 1.5).toFixed(1)}%`,
    },
    {
      id: 'tower', name: '見張り塔', floor: 6, rank: 7, maxLv: 5, buildTime: 60,
      desc: '遠くまで見渡せる塔。留守中の稼ぎの上限が延び、遠征も早くなる。',
      cost: (lv) => ({ gold: lv === 0 ? 22000 : geo(16000, 2.0, lv - 1), mat: lv === 0 ? 40 : geo(25, 1.6, lv - 1) }),
      effect: (lv) => `留守番 ${3 + lv * 2}時間 ・ 遠征時間 -${lv * 4}%`,
    },
  ];
  D.FAC = {};
  D.FACILITIES.forEach((f) => (D.FAC[f.id] = f));

  D.tipValue = (lv) => (lv <= 0 ? 0 : Math.round(3 * Math.pow(1.38, lv - 1)));
  D.tipInterval = (lv) => Math.max(3.6, 12.5 - lv * 1.1);
  D.tipCap = (lv) => 4 + lv * 2;
  D.seats = (lv) => Math.min(8, lv + 1);
  D.beds = (lv) => lv + 1;

  // ---------------- ランク ----------------
  D.RANK_FAME = [0, 20, 70, 180, 420, 850, 1600, 2800, 4600, 7200];
  D.MAX_RANK = 10;
  D.RANK_TITLES = ['廃屋同然', '町の寄り合い', '小さなギルド', '評判のギルド', '街の誇り', '名門ギルド', '王国認定', '英雄の集う館', '伝説の始まり', '竜をも恐れぬ'];
  // ランクで解放されるもの（UI表示用）
  D.RANK_UNLOCKS = {
    2: ['酒場を建てられる', '職業「魔法使い」', 'エリア「ささやきの森」'],
    3: ['鍛冶場を建てられる', '職業「盗賊」'],
    4: ['訓練場を建てられる', '職業「僧侶」', 'エリア「こだま洞窟」'],
    5: ['錬金室を建てられる', '受付嬢の「自動派遣」'],
    6: ['職業「弓使い」', 'エリア「灰の古城」', '深淵の迷宮（B1F〜B100F）'],
    7: ['見張り塔を建てられる'],
    8: ['エリア「竜の背嶺」', 'ギルドの再建（灯火の星）'],
    9: ['ギルドの金の旗'],
    10: ['最終依頼「紅蓮竜王の討伐」'],
  };

  // ---------------- 目標（常に次がある） ----------------
  // check(s) → [現在, 目標]
  const st = (s) => s.stats;
  D.OBJECTIVES = [
    { text: '依頼を3回成功させる', check: (s) => [st(s).success, 3], reward: { gold: 50 } },
    { text: '冒険者を2人にする', check: (s) => [s.adv.length, 2], reward: { gold: 30, mat: 1 } },
    { text: '冒険譚で5回応援する', check: (s) => [st(s).likes, 5], reward: { gold: 60 } },
    { text: 'ギルドランクを2にする', check: (s) => [s.rank, 2], reward: { gold: 100 } },
    { text: '酒場を建てる', check: (s) => [s.fac.tavern > 0 ? 1 : 0, 1], reward: { gold: 80 } },
    { text: '酒場のチップを10回受け取る', check: (s) => [st(s).tips, 10], reward: { gold: 120, mat: 2 } },
    { text: '冒険者を3人にする', check: (s) => [s.adv.length, 3], reward: { gold: 150 } },
    { text: '受付ホールを Lv2 にする', check: (s) => [s.fac.hall, 2], reward: { mat: 2 } },
    { text: '森の依頼を成功させる', check: (s) => [st(s).areaWin.forest || 0, 1], reward: { gold: 200 } },
    { text: '冒険者を Lv5 にする', check: (s) => [Math.max(0, ...s.adv.map((a) => a.lv)), 5], reward: { gold: 300 } },
    { text: 'ギルドランクを3にする', check: (s) => [s.rank, 3], reward: { gold: 400 } },
    { text: '鍛冶場を建てる', check: (s) => [s.fac.smithy > 0 ? 1 : 0, 1], reward: { mat: 5 } },
    { text: '大成功を3回出す', check: (s) => [st(s).great, 3], reward: { gold: 500 } },
    { text: '冒険者を4人にする', check: (s) => [s.adv.length, 4], reward: { gold: 600, mat: 3 } },
    { text: '酒場を Lv4 にする（自動回収）', check: (s) => [s.fac.tavern, 4], reward: { gold: 800 } },
    { text: 'ギルドランクを4にする', check: (s) => [s.rank, 4], reward: { gold: 1000 } },
    { text: '洞窟の依頼を成功させる', check: (s) => [st(s).areaWin.cave || 0, 1], reward: { gold: 1200, mat: 5 } },
    { text: '訓練場を建てる', check: (s) => [s.fac.training > 0 ? 1 : 0, 1], reward: { gold: 1500 } },
    { text: '伝説級の冒険譚を見る', check: (s) => [st(s).legend, 1], reward: { gold: 2000, mat: 8 } },
    { text: 'ギルドランクを5にする', check: (s) => [s.rank, 5], reward: { gold: 3000 } },
    { text: '自動派遣をオンにする', check: (s) => [s.flags.autoDispatch ? 1 : 0, 1], reward: { mat: 10 } },
    { text: '錬金室を建てる', check: (s) => [s.fac.alchemy > 0 ? 1 : 0, 1], reward: { gold: 5000 } },
    { text: '冒険者を6人にする', check: (s) => [s.adv.length, 6], reward: { gold: 6000, mat: 10 } },
    { text: 'ギルドランクを6にする', check: (s) => [s.rank, 6], reward: { gold: 8000 } },
    { text: '古城の依頼を成功させる', check: (s) => [st(s).areaWin.castle || 0, 1], reward: { gold: 10000, mat: 15 } },
    { text: 'ギルドランクを7にする', check: (s) => [s.rank, 7], reward: { gold: 15000 } },
    { text: '見張り塔を建てる', check: (s) => [s.fac.tower > 0 ? 1 : 0, 1], reward: { gold: 20000 } },
    { text: 'ギルドランクを8にする', check: (s) => [s.rank, 8], reward: { gold: 30000, mat: 30 } },
    { text: '竜の背嶺の依頼を成功させる', check: (s) => [st(s).areaWin.peak || 0, 1], reward: { gold: 50000 } },
    { text: 'ギルドランクを10にする', check: (s) => [s.rank, 10], reward: { gold: 100000 } },
    { text: '紅蓮竜王を討伐する', check: (s) => [st(s).boss || 0, 1], reward: { gold: 300000, mat: 100 } },
  ];

  // ---------------- テキスト ----------------
  D.TIER_LABEL = { fail: '撤退…', ok: '成功', great: '大成功！', legend: '伝説級！！' };

  D.CAPTIONS = {
    ok: [
      '{area}で{monster}を{verb}。今日もいい仕事した',
      '依頼完了！ 帰ったら一杯やろう',
      '{monster}、思ったより手強かった…',
      'これがギルドの日常です',
      '{leader}「楽勝楽勝！」',
    ],
    great: [
      'まさかの大成功…！ 宝箱がパンパン',
      'え、こんなに出るの！？',
      '{leader}、今日はキレッキレ',
      '神回きた',
    ],
    legend: [
      '【伝説】これは歴史に残る',
      '吟遊詩人が歌にするレベル',
      '震えが止まらない',
    ],
    fail: [
      '撤退も立派な作戦です…',
      '{monster}、強すぎん？',
      '今日はここまでにしといてやる',
      '{leader}「次は勝つ」',
    ],
  };
  D.TAGS = {
    ok: ['#ギルドの日常', '#依頼達成', '#{area}', '#{cls}'],
    great: ['#神回', '#大成功', '#{cls}', '#宝箱'],
    legend: ['#伝説級', '#保存推奨', '#歴史的瞬間'],
    fail: ['#作戦失敗', '#また来る', '#次こそ'],
  };

  // 冒険譚のコメント欄（ギルドの仲間たちの書き込み）
  D.COMMENTS = {
    ok: ['おつかれ！', 'さすが〜', '今夜は奢りね♪', 'いい動きしてた', '次は私も連れてって', '安定感あるね', '見てて安心する'],
    great: ['すごっ！！', '大成功おめでとう！', '宝箱の中身見せて', '今日イチ', 'これは保存', '鳥肌たった', '天才か？'],
    legend: ['伝説の瞬間に立ち会えた…', 'え、え、えええ！？', 'ギルドの歴史が変わった', 'これ酒場で上映しよう', '泣いた'],
    fail: ['ドンマイ！', '生きて帰ればOK', '次は勝てる', '作戦会議しよ', '無理しないでね', '回復薬置いとくね'],
  };
  D.TRAIT_COMMENT = {
    drinker: '祝杯だ祝杯！',
    singer: '♪ この冒険、歌にしてもいい？',
    sleepy: 'ねむい…けど見た…',
    greedy: '分け前はいくら？',
    brave: '次はもっと強いやつと戦いたい',
    lucky: 'ツイてるね〜',
    tidy: '装備の手入れ、忘れずにね',
    swift: '帰り道、競争しよ',
  };

  // ギルド内でのひとこと
  D.CHATTER = {
    idle: ['いい天気だ', '次の依頼まだかな', 'ふぁ〜', '腕が鳴るぜ', 'お腹すいた', 'この剣、名前つけようかな', 'マスター、見てる？'],
    board: ['どれにしよう', 'ふむふむ', 'お、報酬いいな', '難しそう…'],
    tavern: ['もう一杯！', 'かんぱーい', 'ここの麦酒は最高', 'ぷはーっ'],
    sleep: ['Zzz…', 'むにゃ…', 'もう食べられない…'],
    train: ['せいっ！', 'はっ！', 'まだまだ！'],
    smith: ['いい音だ', '俺の剣も頼むよ'],
    return: ['ただいま！', '戻ったぞ！', 'つかれた〜', 'いい冒険だった'],
    depart: ['行ってきます！', 'まかせとけ', 'すぐ戻る！'],
    tap: ['なに？', 'マスター！', 'ん？', 'えへへ', 'くすぐったい', '用事？'],
    tapSleep: ['…はっ！ 起きてます！', 'むにゃ…あと5分…'],
  };
  D.CUSTOMER_LINES = ['いつものを', 'ここ、落ち着くね', 'ギルドの噂を聞いて', '冒険者さんかっこいい', 'ごちそうさま！', 'また来るよ'];
  D.RINA_LINES = ['いらっしゃいませ！', 'おかえりなさい！', '今日も忙しくなりそう', 'ギルドマスター、お茶どうぞ', '依頼、届いてますよ'];

  // 冒険譚の BGM 表記（ショート動画のパロディ）
  D.SONGS = ['♪ 灯りの酒場 — ギルド楽団', '♪ 草原を行け — ギルド楽団', '♪ 帰り道のジグ — ギルド楽団'];
})();
