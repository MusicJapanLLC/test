/* ギルドの灯 — comments: 魔導鏡（冒険譚）のコメント欄
 *  - 町の常連・ライバル・ギルドの仲間・リナ・旅人が、それぞれの口調で書き込む
 *  - 戦闘の中身（会心・瀕死・閃き・レアドロップ・撤退…）で内容が変わる
 *  - 同じ冒険譚の中で同じ文は出ない。最近の冒険譚で使った文も避ける
 *  - 返信（言い返す・照れる・たしなめる）や投げ銭（贈り物）が付くことがある
 *  - すべて冒険譚ごとの seed から決まるので、見直しても同じ欄になる
 */
'use strict';
(function () {
  const CM = (G.comments = {});

  // ---------------------------------------------------------------- 常連たち
  // look は art.person の見た目。w は登場しやすさ、pop は「いいね」の集まりやすさ
  CM.PERSONAS = {
    morris: {
      name: 'パン屋のモリス', w: 1.1, pop: 18,
      look: { cls: 'warrior', role: 'npc', seed: 21, skin: '#e8b48a', hair: '#8a5a32', style: 'short', outfit: '#d8c8a8', apron: '#f2ead8', pants: '#5a4632', mustache: true },
      lines: {
        any: ['今日もいい焼き色の戦いだったね', '帰りにパン寄ってって、おまけするよ', '朝の仕込みしながら見てたよ', '{leader}さん、腹減ってない？', 'うちの窯より熱い冒険だった'],
        crit: ['今の一撃、窯の火みたいに熱かった！', 'びっくりして生地を落とした', '{mvp}さんの会心、焼きたてみたいに香ばしい'],
        great: ['大成功！明日は記念のパン焼くね', 'こりゃ店先に貼り出さなきゃ', '大成功の日は塩パン半額にするよ'],
        legend: ['伝説…！一生ぶんのパン焼いちゃう', '手が震えて生地がこねられない', '伝説パンって名前で新作つくる'],
        fail: ['無事ならそれでいい。あったかいスープあるよ', '負けた日のパンは、なぜかうまいんだ', '店、遅くまで開けとくから'],
        level: ['レベルアップおめでとう！メロンパンおごり'],
        drop: ['その{item}、店に飾らせてほしい'],
        hurt: ['{hurt}さん無理しないで！パン持ってくから！'],
      },
    },
    luce: {
      name: '吟遊詩人ルーチェ', w: 1, pop: 26,
      look: { cls: 'mage', role: 'npc', seed: 22, skin: '#f6d6bc', hair: '#e8d090', style: 'long', outfit: '#7a4fa0', robe: true, pants: '#3a2a48', blush: true },
      lines: {
        any: ['♪剣が鳴り 風が笑う', '今夜の酒場で、この話を歌わせて', 'この冒険、三番まで書けそう', '♪{area}の空は今日も高く'],
        crit: ['♪閃く刃に 星も見とれた', '今の一閃、サビにする', '♪{dmg}の一撃 鐘が鳴る'],
        finish: ['♪とどめの一撃 拍手喝采', 'いい終わり方。曲の最後みたい'],
        great: ['♪大成功のバラッド、作曲開始', '今日は明るい長調で書くね'],
        legend: ['伝説の誕生に立ち会えた…歌が止まらない', '♪この日を千年 語り継ごう', '竪琴の弦が切れるまで歌う'],
        fail: ['♪負けの歌にも 明日がある', '悲しい曲ほど、いい曲になるの'],
        flash: ['「{skill}」…なんて美しい名前', '♪{skill}の詩、もうできた'],
        level: ['♪レベルアップの鐘が鳴る'],
      },
    },
    teo: {
      name: '見習い騎士テオ', w: 1.1, pop: 12,
      look: { cls: 'warrior', role: 'npc', seed: 23, skin: '#f2c6a0', hair: '#d9a441', style: 'spiky', outfit: '#4a6aa8', vest: '#c8c8d0', pants: '#3a3448' },
      lines: {
        any: ['かっこいいです！！', '僕もいつかあのパーティに…！', '剣の振り、真似してみます！', '今日も勉強させてもらいました！'],
        crit: ['今の見ました！？会心ですよ！！', '{mvp}さん、弟子にしてください！！', '{dmg}ダメージって何ですか…！？'],
        finish: ['とどめ、しびれました！！', '最後の一撃、目に焼きつけました'],
        great: ['大成功だ！ギルドの誇りです！'],
        legend: ['う、う、うわああ伝説だああ！！', '今日のこと、一生忘れません！'],
        fail: ['次は勝てます！僕が保証します！', 'あきらめない背中、かっこよかったです'],
        hurt: ['{hurt}さん、大丈夫ですか！？'],
        flash: ['「{skill}」！？ 名前までかっこいい！！', '閃きの瞬間って、本当に光るんですね'],
      },
    },
    gordon: {
      name: '酒場の常連ゴードン', w: 1, pop: 15,
      look: { cls: 'warrior', role: 'npc', seed: 24, skin: '#e0a87e', hair: '#5a3a2a', style: 'bald', outfit: '#8a5a3a', pants: '#3a2e28', beard: true, wide: 1.1 },
      lines: {
        any: ['かんぱーい！ひっく', 'よーし今夜はおれのおごり…いや割り勘な', 'つまみにちょうどいい冒険だ', '酒がすすむねえ'],
        crit: ['いいぞー！もっとやれー！', 'ぶはっ、酒こぼした', '今の一撃で酔いがさめた'],
        great: ['祝杯だ祝杯！樽ごと持ってこい！'],
        legend: ['伝説に乾杯！！', '今日は飲むぞ…いや毎日飲んでるけど'],
        fail: ['負けた日こそ飲むんだよ', 'まあまあ、一杯やろうや'],
        level: ['レベルアップの祝い酒だ！'],
      },
    },
    yona: {
      name: '占い師ヨナ', w: 0.8, pop: 20,
      look: { cls: 'mage', role: 'npc', seed: 25, skin: '#d8a882', hair: '#2a2a3a', style: 'long', outfit: '#3a2a5a', robe: true, hood: '#2a1e44', pants: '#2a2234' },
      lines: {
        any: ['星が囁いている…', 'この冒険、水晶に映っていたわ', '{leader}…良い相が出ているわね'],
        crit: ['予言どおりね', 'カードは「剣の王」…当たったわ'],
        great: ['ふふ、大吉'],
        legend: ['…星が、落ちた。伝説の兆し', '水晶が割れるほどの運命ね'],
        fail: ['今日は凶。でも明日は…', '月が隠れていたのね'],
        next: ['次の冒険、{area}に吉兆あり', '近いうちに、金色の箱が見えるわ'],
        drop: ['その{item}…持ち主を選ぶ品よ'],
      },
    },
    valk: {
      name: '黒鉄団のヴァルク', w: 0.9, pop: 30, rival: true,
      look: { cls: 'warrior', role: 'npc', seed: 26, skin: '#c98a62', hair: '#2a2a2a', style: 'spiky', outfit: '#2a2a32', vest: '#4a4a56', pants: '#1e1e24' },
      lines: {
        any: ['フン、その程度か', 'うちの新人でも勝てるな', 'まぐれだろ', '{monster}ごときに時間かけすぎだ'],
        crit: ['…今のは、まあ悪くない', 'ちっ、やるじゃねえか'],
        great: ['大成功？運がよかっただけだ'],
        legend: ['……認めてやるよ、今日だけはな', 'な、なんだ今のは…'],
        fail: ['ハハッ、見てられねえな', 'うちに来れば鍛えてやるぜ？'],
        flash: ['技名つけて浮かれてんじゃねえ'],
      },
    },
    mia: {
      name: '町娘ミーア', w: 0.9, pop: 10, fan: true,
      look: { cls: 'warrior', role: 'npc', seed: 27, skin: '#f9dcc4', hair: '#d8574a', style: 'pony', outfit: '#e88aa0', apron: '#fff4f0', pants: '#7a4a5a', blush: true },
      lines: {
        any: ['{oshi}様ーー！！♡', '{oshi}様が映ってるだけで生きていける', 'ファンクラブ会員番号1番です', '{oshi}様のうしろ姿で白米いける'],
        crit: ['{oshi}様の会心で倒れそう', 'いまの{oshi}様、目に焼きつけた'],
        legend: ['{oshi}様が伝説に…泣いてる'],
        fail: ['{oshi}様ケガしてない！？', 'どんな{oshi}様も推せる'],
        hurt: ['{hurt}様ーー！！しっかりーー！！'],
      },
    },
    cat: {
      name: 'ギルドの猫ミケ', w: 0.25, pop: 44,
      look: null,
      lines: {
        any: ['にゃーん', 'にゃ（いいね）', 'ごろごろ…', 'にゃっ'],
        crit: ['にゃっ！！'],
        legend: ['にゃーーーーん！！'],
      },
    },
  };

  CM.TRAVELERS = ['名無しの旅人', '通りすがりの商人', '隣町の冒険者', '北の村の羊飼い', '王都の衛兵', '港町の船乗り', '迷子の魔法学徒', '湖畔の釣り人'];
  const TRAVELER_LINES = {
    any: ['おつかれさま', 'いいパーティだ', '初見です、ファンになりました', '王都でも噂になってます', '{monster}ってそんなに強いの？', '{area}、懐かしいな', 'この魔導鏡、毎晩見てる', '仕事終わりの楽しみ'],
    crit: ['会心きた', 'つよすぎ', '{dmg}は草', '今の何ダメ？'],
    finish: ['ナイスとどめ', 'きれいに決まった'],
    great: ['神回', '大成功おめ', '今日イチ'],
    legend: ['伝説の瞬間に立ち会った', '歴史が動いた', '鳥肌がとまらない'],
    fail: ['ドンマイ', 'あるある', '生きて帰ればえらい'],
    level: ['レベルアップおめ'],
    drop: ['{item}いいなー', '{item}は普通にうらやましい'],
  };

  // ギルドの仲間（性格ごとの口調）
  const MEMBER_LINES = {
    common: {
      any: ['おつかれ！', 'さすが〜', 'いい動きしてた', '次は私も連れてって', '見てたよ！'],
      crit: ['今の一撃すごっ', '会心えぐい'],
      great: ['大成功おめでとう！', '今日イチだね'],
      legend: ['伝説の瞬間…', '泣いた', 'これ酒場で上映しよう'],
      fail: ['ドンマイ！', '無事でよかった', '作戦会議しよ'],
      level: ['レベルアップおめでと！'],
    },
    brave: { any: ['次は俺も前に出る', '腕が鳴るな'], crit: ['いい一撃だ、負けてられない'], fail: ['次は俺が行く'] },
    greedy: { any: ['で、分け前は？', 'いくら稼いだ？'], drop: ['{item}、売ったら高いぞ…'], great: ['大成功ってことは報酬も…！'] },
    sleepy: { any: ['ねむい…けど見た', 'ふぁ…おつかれ'], legend: ['目が覚めた'] },
    drinker: { any: ['祝杯だ！', '帰ったら一杯な'], fail: ['飲んで忘れよう'] },
    singer: { any: ['♪いい冒険だった'], legend: ['歌にするね！'], great: ['♪〜（ご機嫌）'] },
    swift: { any: ['帰り道、競争な', 'もうちょい速く動けたな'] },
    lucky: { any: ['ツイてるね〜'], legend: ['私の運、分けといたからね'], drop: ['ほら、運がいいでしょ'] },
    tidy: { any: ['装備の手入れ忘れずにね'], fail: ['作戦、見直しましょ'] },
  };

  // 本人からの返信
  const SELF_REPLY = {
    praise: ['ありがと！', '照れるな', 'まだまだだよ', '次も見ててくれ', 'へへっ'],
    rival: ['言ってろ', '次は黙らせる', 'お前んとこには負けねえ', '…見てたのかよ'],
    fan: ['…ありがとう（照）', 'いつも応援ありがとな', 'て、照れるからやめて'],
    worry: ['平気平気！', 'かすり傷だよ', '心配かけた、ごめん'],
  };

  // 受付のリナ（ちょっと天然で、マスター思いのがんばり屋）
  const RINA = {
    ok: ['おつかれさまでした！報告書、受け取りました♪', 'みなさんおかえりなさい！', 'けが人ゼロ！えらいです♪'],
    great: ['すごいです！今夜はお祝いですね♪', '大成功です！わたし、ちょっと泣きそうです', 'マスター、見ました！？大成功ですよ！'],
    legend: ['す、すごすぎます…！手が震えて判子が押せません…！', '伝説です！ギルドの歴史に残ります！', 'ど、どうしよう、額縁に入れなきゃ…！'],
    fail: ['みなさん無事で…よかった…！', '回復薬、たくさん用意して待ってますね', '泣いてません！ちょっと目にゴミが…'],
    drop: ['{item}！？ 宝物庫に大事にしまっておきますね', 'わわっ、{item}！割らないように運びます…！'],
    rival: ['ヴァルクさん！うちの冒険者さんを悪く言わないでください！', 'む…黒鉄団さんには負けませんから！'],
    typo: ['おつかれさまでひた！', 'ほうこくしょ、うけとりまひた♪'],
    typoFix: ['でした！！（噛みました…）', 'まし、まし…ました！（打ち間違いです…）'],
  };

  // 流れるコメント（短いひとこと）
  const DANMAKU = {
    start: ['きた', 'はじまった', 'わくわく', '待ってた', '{leader}きた！', 'こんばんは〜'],
    encounter: ['でかい', 'でかすぎｗ', 'つよそう', '{monster}だ！', 'こわ', 'がんばれー'],
    hit: ['いけー！', 'つよい', 'ナイス', 'おお', 'いいぞ', 'その調子'],
    crit: ['会心！！', 'うおおお', 'つええええ', 'きたああ', '{dmg}！？', '会心きた'],
    hurt: ['あぶない！', '{hurt}ーー！', 'がんばれ', 'ひえっ', '耐えて'],
    heal: ['回復たすかる', '僧侶ありがたい', 'ナイス回復'],
    miss: ['おしい', 'よけた！？', 'すばやい'],
    skill: ['閃いた！', '{skill}！？', 'かっこよすぎ', '技名かっこいい', 'ひらめき来た'],
    finish: ['とどめ！', '８８８８', 'ナイスー', 'うおおおお', 'おみごと'],
    chest: ['宝箱！', '中身は？', 'ドキドキ', 'たのむ…', '開けて'],
    rare: ['金箱！？', 'うそだろ', 'おめでとう！！', 'まじか', '神引き'],
    ur: ['虹！？！？', '伝説の秘宝', 'ふるえる', '歴史的瞬間'],
    fail: ['逃げてー', 'ドンマイ', '生きて', '次がある', '撤退は勇気'],
    legend: ['伝説', '鳥肌', '保存した', '歴史が動いた'],
  };

  // ---------------------------------------------------------------- 生成
  const fill = (tpl, ctx) => tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? ctx[k] : ''));

  function pickW(rnd, items, wf) {
    let tot = 0;
    for (const it of items) tot += Math.max(0, wf(it));
    if (tot <= 0) return items[0];
    let r = rnd() * tot;
    for (const it of items) { r -= Math.max(0, wf(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  // 最近使った文（冒険譚をまたいで同じ言い回しが続かないように）
  function recent() {
    const st = G.state;
    if (!st.recentLines) st.recentLines = [];
    return st.recentLines;
  }
  function remember(text) {
    const r = recent();
    r.push(text);
    if (r.length > 80) r.splice(0, r.length - 80);
  }

  // 出来事から「話題」の重みを決める
  function topics(f) {
    const t = { any: 1.2 };
    if (f.tier === 'fail') { t.fail = 3.4; t.any = 0.5; }
    if (f.tier === 'great') t.great = 2;
    if (f.tier === 'legend') { t.legend = 3.2; t.great = 0.6; }
    if (f.crit) t.crit = 1.8;
    if (f.tier !== 'fail') t.finish = 0.7;
    if (f.levelUps) t.level = 1.3;
    if (f.skill) t.flash = 2.2;
    if (f.drop) t.drop = f.dropRank >= 2 ? 2.2 : 0.9;
    if (f.hurt) t.hurt = 1.4;
    t.next = 0.25;
    return t;
  }

  // reel: R.make で作りかけの冒険譚 / f: 出来事のまとめ
  CM.generate = function (reel, f) {
    const st = G.state;
    const rnd = R_rng(reel.seed ^ 0x5bd1e995);
    const party = reel.party;
    const partyIds = new Set(party.map((p) => p.id));
    const members = st.adv.filter((a) => !partyIds.has(a.id));
    const area = G.D.AREA_BY_ID[reel.area];
    const md = G.D.MONSTERS[reel.monster] || { name: '魔物' };
    // 推し：絆がいちばん深い冒険者（同点ならリーダー）
    const oshi = party.slice().sort((a, b) => ((st.adv.find((x) => x.id === b.id) || {}).bond || 0) - ((st.adv.find((x) => x.id === a.id) || {}).bond || 0))[0];
    const ctx = {
      leader: party[0] ? party[0].name : '', mvp: f.mvpName || (party[0] && party[0].name) || '',
      monster: md.name, area: area ? area.short : '', dmg: f.maxDmg ? G.fmt(f.maxDmg) : '', skill: f.skill || '',
      item: f.dropName || '', hurt: f.hurtName || '', oshi: oshi ? oshi.name : '',
    };
    const T = topics(f);
    const used = new Set();
    const rec = new Set(recent());
    const out = [];
    const total = { fail: [3, 5], ok: [4, 7], great: [7, 11], legend: [12, 17] }[f.tier];
    const n = Math.round(G.lerp(total[0], total[1], rnd())) + Math.min(4, Math.floor((st.rank - 1) / 2));
    const dur = f.dur || 7.4;

    // 書き込む人の候補
    const authors = [];
    Object.entries(CM.PERSONAS).forEach(([id, p]) => authors.push({ key: 'p:' + id, w: p.w, persona: p, id }));
    members.forEach((m) => authors.push({ key: 'm:' + m.id, w: 1.1, member: m }));
    authors.push({ key: 'rina', w: 0.0 }); // リナは別枠で必ず書く
    for (let i = 0; i < 3; i++) authors.push({ key: 't:' + CM.TRAVELERS[Math.floor(rnd() * CM.TRAVELERS.length)], w: 0.7, traveler: true });

    const lineFor = (a, topic) => {
      let bank = null;
      if (a.persona) bank = a.persona.lines[topic] || (topic !== 'any' && rnd() < 0.5 ? a.persona.lines.any : null);
      else if (a.member) {
        const tr = MEMBER_LINES[a.member.trait] || {};
        bank = (rnd() < 0.45 && tr[topic]) ? tr[topic] : MEMBER_LINES.common[topic] || (tr[topic] || null);
      } else if (a.traveler) bank = TRAVELER_LINES[topic] || null;
      if (!bank || !bank.length) return null;
      // まだ使っていない文を優先（最近の冒険譚で使った文は避ける）
      const fresh = bank.filter((l) => !used.has(fill(l, ctx)) && !rec.has(fill(l, ctx)));
      const pool = fresh.length ? fresh : bank.filter((l) => !used.has(fill(l, ctx)));
      if (!pool.length) return null;
      const text = fill(pool[Math.floor(rnd() * pool.length)], ctx);
      if (/\{\w+\}/.test(text) || /^\s*$/.test(text)) return null;
      return text;
    };

    let lastAuthor = null;
    let guard = 0;
    while (out.length < n && guard++ < n * 8) {
      const a = pickW(rnd, authors, (x) => (x.key === lastAuthor ? (rnd() < 0.12 ? x.w : 0) : x.w) * (x.persona && x.persona.fan && !ctx.oshi ? 0 : 1));
      if (a.key === 'rina') continue;
      // 話題：その人が話せる話題の中から、出来事の重みで選ぶ
      const avail = Object.keys(T).filter((k) => {
        if (a.persona) return !!a.persona.lines[k];
        if (a.member) return !!(MEMBER_LINES.common[k] || (MEMBER_LINES[a.member.trait] || {})[k]);
        return !!TRAVELER_LINES[k];
      });
      if (!avail.length) continue;
      const topic = pickW(rnd, avail, (k) => T[k]);
      const text = lineFor(a, topic);
      if (!text) continue;
      used.add(text);
      // 話題が起きた時刻のあたりに書き込まれる
      const at = topicTime(topic, f, dur, rnd);
      const pop = a.persona ? a.persona.pop : a.member ? 8 : 3;
      out.push({ id: 'c' + out.length, t: at, a: a.key, text, likes: Math.round(pop * (0.3 + rnd() * 1.2) * (f.tier === 'legend' ? 3 : f.tier === 'great' ? 1.6 : 1)), topic, replies: [] });
      lastAuthor = a.key;
    }

    // お祭りのひとこと
    if (G.events && G.events.theme() === 'pumpkin' && rnd() < 0.6) {
      const HW = ['トリック・オア・トリート！', 'かぼちゃ飴ちょうだい〜', '灯籠祭、今年もきたね', 'ギルドの飾りつけかわいい', 'かぼちゃおばけ、ちょっとかわいい', '仮装していこうかな'];
      const who = pickW(rnd, Object.keys(CM.PERSONAS).filter((k) => !CM.PERSONAS[k].rival), (k) => CM.PERSONAS[k].w || 1);
      out.push({ id: 'hw' + out.length, t: Math.min(dur, 0.8 + rnd() * dur * 0.6), a: 'p:' + who, text: HW[Math.floor(rnd() * HW.length)], likes: 10 + Math.round(rnd() * 30), topic: 'event', replies: [] });
    }
    // リナ（必ず1つ・ときどき噛む）
    const rinaBank = f.drop && f.dropRank >= 2 && rnd() < 0.5 ? RINA.drop : RINA[f.tier];
    let rinaText = fill(rinaBank[Math.floor(rnd() * rinaBank.length)], ctx);
    const typo = rnd() < 0.14;
    if (typo) rinaText = RINA.typo[Math.floor(rnd() * RINA.typo.length)];
    const rinaC = { id: 'rina', t: Math.min(dur + 0.5, f.reveal + 0.4 + rnd() * 0.8), a: 'rina', text: rinaText, likes: 20 + Math.round(rnd() * 40) * (f.tier === 'legend' ? 3 : 1), pin: true, replies: [] };
    if (typo) rinaC.replies.push({ t: rinaC.t + 1.2, a: 'rina', text: RINA.typoFix[Math.floor(rnd() * RINA.typoFix.length)], likes: 40 + Math.round(rnd() * 30) });
    out.push(rinaC);

    // 返信
    out.forEach((c) => {
      const p = c.a.startsWith('p:') ? CM.PERSONAS[c.a.slice(2)] : null;
      // ライバルへの言い返し
      if (p && p.rival && f.tier !== 'legend') {
        const responder = party[Math.floor(rnd() * party.length)];
        if (responder && rnd() < 0.75) c.replies.push({ t: c.t + 0.8 + rnd(), a: 'party:' + responder.id, text: pick(rnd, SELF_REPLY.rival), likes: 10 + Math.round(rnd() * 30) });
        if (rnd() < 0.55) c.replies.push({ t: c.t + 1.6 + rnd(), a: 'rina', text: pick(rnd, RINA.rival), likes: 30 + Math.round(rnd() * 30) });
        if (rnd() < 0.4) c.replies.push({ t: c.t + 2.2 + rnd(), a: 'p:gordon', text: pick(rnd, ['ヴァルク、お前んとこより強えよ', 'また黒鉄団か、ひっく', '素直に「すごい」って言えよ']), likes: 8 + Math.round(rnd() * 20) });
      }
      // ファンへの照れ返し
      if (p && p.fan && oshi && rnd() < 0.5) c.replies.push({ t: c.t + 1 + rnd(), a: 'party:' + oshi.id, text: pick(rnd, SELF_REPLY.fan), likes: 50 + Math.round(rnd() * 80) });
      // 褒め言葉に本人が反応
      if (!p && c.a !== 'rina' && (c.topic === 'crit' || c.topic === 'great' || c.topic === 'legend') && rnd() < 0.3) {
        const who = party.find((x) => x.name === f.mvpName) || party[0];
        if (who) c.replies.push({ t: c.t + 1 + rnd(), a: 'party:' + who.id, text: pick(rnd, SELF_REPLY.praise), likes: 5 + Math.round(rnd() * 20) });
      }
      if (c.topic === 'hurt' && f.hurtId && rnd() < 0.6) c.replies.push({ t: c.t + 1 + rnd(), a: 'party:' + f.hurtId, text: pick(rnd, SELF_REPLY.worry), likes: 6 + Math.round(rnd() * 15) });
      // 返信の文も重複させない
      c.replies = c.replies.filter((r, i, arr) => arr.findIndex((x) => x.text === r.text) === i);
    });

    // 投げ銭（贈り物）
    const giftP = { fail: 0.02, ok: 0.05, great: 0.14, legend: 0.32 }[f.tier] + st.rank * 0.004;
    if (rnd() < giftP && G.items) {
      const fans = ['morris', 'luce', 'teo', 'gordon', 'yona', 'mia'];
      const who = fans[Math.floor(rnd() * fans.length)];
      const item = G.items.rollGift(rnd, f.tier);
      out.push({ id: 'gift', t: Math.min(dur, f.reveal + 0.9 + rnd()), a: 'p:' + who, text: `《${item.name}》を贈りました`, gift: item, likes: 60 + Math.round(rnd() * 90), replies: [{ t: 0, a: 'rina', text: `${CM.PERSONAS[who].name.replace(/^.*の/, '')}さん、ありがとうございます！宝物庫に入れておきますね♪`, likes: 20 }] });
      out[out.length - 1].replies[0].t = out[out.length - 1].t + 1.4;
    }

    out.forEach((c) => remember(c.text));
    // 時刻順に並べる
    out.sort((a, b) => a.t - b.t);
    return out;
  };

  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function topicTime(topic, f, dur, rnd) {
    const j = rnd() * 0.9;
    switch (topic) {
      case 'crit': return (f.critT || f.reveal - 1.5) + 0.2 + j;
      case 'flash': return (f.skillT || f.reveal - 1.2) + 0.4 + j;
      case 'hurt': return (f.hurtT || 2.5) + 0.2 + j;
      case 'finish': return f.finishT + 0.2 + j;
      case 'drop': return f.reveal + 0.5 + j;
      case 'level': return f.reveal + 0.8 + j;
      case 'great': case 'legend': case 'fail': return f.reveal + 0.1 + j * 1.6;
      default: return 0.4 + rnd() * Math.max(1, dur - 0.9);
    }
  }
  function R_rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 流れるコメント（見るたびに作る：seed で決まる）
  CM.danmaku = function (reel, f, plan) {
    const rnd = R_rng(reel.seed ^ 0x2545f491);
    const ctx = { leader: reel.party[0] ? reel.party[0].name : '', monster: (G.D.MONSTERS[reel.monster] || {}).name || '', dmg: f.maxDmg ? G.fmt(f.maxDmg) : '', skill: f.skill || '', hurt: f.hurtName || '' };
    const out = [];
    const add = (key, t, n, gold) => {
      const bank = DANMAKU[key];
      for (let i = 0; i < n; i++) {
        const text = fill(bank[Math.floor(rnd() * bank.length)], ctx);
        if (!text || /\{/.test(text)) continue;
        out.push({ t: t + rnd() * 0.7, text, lane: Math.floor(rnd() * 6), speed: 0.8 + rnd() * 0.5, gold: gold && rnd() < 0.5 });
      }
    };
    const busy = G.state.rank >= 3 ? 1.3 : 1;
    add('start', 0.2, Math.round(2 * busy));
    add('encounter', plan.encT + 0.1, Math.round(2 * busy));
    plan.beats.forEach((b) => {
      if (b.kind === 'hit' && rnd() < 0.5) add('hit', b.t + 0.2, 1);
      if (b.crit) add('crit', b.t + 0.2, Math.round(3 * busy), true);
      if (b.kind === 'mon') add('hurt', b.t + 0.3, 2);
      if (b.kind === 'heal') add('heal', b.t + 0.2, 1);
      if (b.kind === 'miss') add('miss', b.t + 0.2, 1);
      if (b.kind === 'skill') add('skill', b.t + 0.8, Math.round(4 * busy), true);
    });
    if (reel.tier === 'fail') add('fail', plan.finishT + 0.2, 4);
    else add('finish', plan.finishT + 0.1, Math.round(4 * busy), true);
    if (plan.chestRank != null) {
      add('chest', plan.dropT, 2);
      if (plan.chestRank >= 3) add('rare', plan.reveal, 4, true);
      if (plan.chestRank >= 4) add('ur', plan.reveal + 0.3, 5, true);
    }
    if (reel.tier === 'legend') add('legend', plan.reveal + 0.2, 6, true);
    return out.sort((a, b) => a.t - b.t);
  };

  // マスター（あなた）のコメントへの返事
  const MASTER_REPLY = {
    common: ['マスター！見ててくれたんですね！', 'へへ、ありがとうございます', 'マスターのおかげです', '次も期待しててください！', 'マスターに褒められた…！'],
    brave: ['次はもっと強いやつを頼む！', 'まだまだ行けるぜ、マスター'],
    greedy: ['褒めるなら報酬で…なんてね', 'ボーナス、期待していいっすか？'],
    sleepy: ['…えへへ、起きててよかった', 'マスターの声で目が覚めました'],
    drinker: ['帰ったら一杯おごってくれよな！', '祝杯はマスターのおごりで！'],
    singer: ['♪マスターに捧げる歌〜', 'マスターのために一曲作ります'],
    swift: ['すぐ戻りますね！', '次はもっと速く片付けます'],
    lucky: ['今日もツイてました！', 'マスターが見てると運がいいんです'],
    tidy: ['報告書、きちんとまとめておきます', '装備の手入れもばっちりです'],
    fail: ['…すみません、次は必ず', '心配かけました', 'マスターの声で元気出ました', '次こそ、いい知らせを'],
  };
  CM.masterReply = function (reel, who) {
    const bank = reel.tier === 'fail' ? MASTER_REPLY.fail : Math.random() < 0.55 && MASTER_REPLY[who.trait] ? MASTER_REPLY[who.trait] : MASTER_REPLY.common;
    return bank[Math.floor(Math.random() * bank.length)];
  };

  // 表示名と顔
  CM.author = function (key, reel) {
    const st = G.state;
    if (key === 'rina') return { name: '受付のリナ', rina: true };
    if (key === 'master') return { name: 'ギルドマスター', master: true };
    if (key.startsWith('p:')) {
      const p = CM.PERSONAS[key.slice(2)];
      return p ? { name: p.name, look: p.look, cat: key === 'p:cat', rival: !!p.rival } : { name: '???' };
    }
    if (key.startsWith('m:') || key.startsWith('party:')) {
      const id = +key.split(':')[1];
      const a = st.adv.find((x) => x.id === id) || (reel && reel.party.find((x) => x.id === id));
      return a ? { name: a.name, look: a.look, member: true, self: key.startsWith('party:') } : { name: '元メンバー' };
    }
    if (key.startsWith('t:')) return { name: key.slice(2), traveler: true };
    return { name: key };
  };
})();
