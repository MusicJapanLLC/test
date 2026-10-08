// 実績と称号：遊んだぶんだけ積み上がる長い目標。段ごとに魔晶石、最後の段で称号
(function () {
  const A = (G.achieve = {});
  const st = () => G.state;
  const ss = () => G.state.stats || {};
  const maxLv = () => Math.max(0, ...G.state.adv.map((a) => a.lv));
  const facMax = () => G.D.FACILITIES.filter((f) => G.state.fac[f.id] >= f.maxLv).length;
  const urCount = () => Object.keys(G.state.dex || {}).filter((k) => k.endsWith(':4')).length;
  const dexCount = () => Object.keys(G.state.dex || {}).length;
  const skillCount = () => G.state.adv.reduce((n, a) => n + Object.keys(a.sk || {}).length, 0);
  const monsters = () => Object.keys(G.state.seenMonsters || {}).length;
  const legends = () => Object.values(G.state.seenMonsters || {}).filter((v) => v >= 3).length;
  const fishDex = () => (G.state.fish ? Object.keys(G.state.fish.dex || {}).length : 0);
  const pr = () => G.state.prestige || { runs: 0, total: 0 };
  const REW = [10, 20, 40, 80, 150, 300];
  // 1行 = 段のある実績。title は最後の段の称号
  A.LINES = [
    { id: 'quests', cat: '冒険', name: '依頼をこなす', unit: '回', v: () => ss().quests || 0, n: [10, 100, 500, 2000, 10000], title: '依頼の鬼' },
    { id: 'great', cat: '冒険', name: '大成功を出す', unit: '回', v: () => ss().great || 0, n: [5, 50, 300, 1500], title: '幸運の申し子' },
    { id: 'legend', cat: '冒険', name: '伝説級の冒険譚', unit: '本', v: () => ss().legend || 0, n: [1, 10, 50, 200], title: '伝説の語り部' },
    { id: 'boss', cat: '冒険', name: '紅蓮竜王を討伐', unit: '回', v: () => ss().boss || 0, n: [1, 3, 10], title: '竜殺し' },
    { id: 'abyss', cat: '冒険', name: '深淵の迷宮を下る', unit: '階', v: () => (G.state.abyss ? G.state.abyss.best || 0 : 0), n: [10, 30, 50, 80, 100], title: '深淵の踏破者' },
    { id: 'witness', cat: '冒険譚', name: '冒険譚を見届ける', unit: '本', v: () => ss().witnessed || 0, n: [10, 100, 500, 2000], title: '最前列の観客' },
    { id: 'likes', cat: '冒険譚', name: '冒険譚で応援する', unit: '回', v: () => ss().likes || 0, n: [20, 200, 1000, 5000], title: '応援団長' },
    { id: 'posts', cat: '冒険譚', name: 'マスターとしてコメント', unit: '回', v: () => ss().posts || 0, n: [1, 10, 50, 200], title: '名物マスター' },
    { id: 'nice', cat: '冒険譚', name: 'ナイス指示を出す', unit: '回', v: () => ss().nice || 0, n: [1, 20, 100, 500, 2000], title: '名指揮官' },
    { id: 'oshi', cat: '冒険譚', name: '推し度を上げる', unit: 'Lv', v: () => (G.oshi ? Math.max(0, ...Object.values((G.state.oshi || {}).pts || {}).map((p) => G.oshi.levelOf(p))) : 0), n: [1, 2, 3, 4, 5], title: '推し一筋' },
    { id: 'rank', cat: 'ギルド', name: 'ギルドランクを上げる', unit: '', v: () => G.state.rank, n: [3, 5, 8, 10], title: '竜をも恐れぬギルド長' },
    { id: 'facmax', cat: 'ギルド', name: '施設を最大レベルに', unit: '棟', v: facMax, n: [1, 3, 5, 7], title: '匠の館の主' },
    { id: 'gold', cat: 'ギルド', name: 'ゴールドを稼ぐ', unit: 'G', v: () => ss().goldEarned || 0, n: [1e5, 1e7, 1e9, 1e11, 1e13], title: '黄金の主' },
    { id: 'feast', cat: 'ギルド', name: '宴を開く', unit: '回', v: () => ss().feasts || 0, n: [1, 10, 50], title: '宴好き' },
    { id: 'login', cat: 'ギルド', name: 'ギルドに顔を出す', unit: '日', v: () => (G.state.login ? G.state.login.n : 0), n: [7, 30, 100, 365], title: '皆勤のマスター' },
    { id: 'members', cat: '冒険者', name: '仲間を集める', unit: '人', v: () => G.state.adv.length, n: [4, 8, 12, 16], title: '大所帯' },
    { id: 'maxlv', cat: '冒険者', name: '冒険者を育てる', unit: 'Lv', v: maxLv, n: [20, 50, 100, 150], title: '名伯楽' },
    { id: 'skills', cat: '冒険者', name: '技を閃く', unit: '個', v: skillCount, n: [5, 20, 50, 100], title: '閃きの導き手' },
    { id: 'change', cat: '冒険者', name: '転職・継承', unit: '回', v: () => (ss().classChanges || 0) + (ss().inherits || 0), n: [1, 5, 20], title: '道を拓く者' },
    { id: 'chests', cat: '宝', name: '宝箱を開ける', unit: '回', v: () => ss().chests || 0, n: [10, 100, 500, 2000], title: '宝の山' },
    { id: 'enhance', cat: '宝', name: '装備を強化する', unit: '回', v: () => ss().enhance || 0, n: [10, 100, 1000], title: '鍛冶の友' },
    { id: 'ur', cat: '宝', name: 'URの装備を手に入れる', unit: '種', v: urCount, n: [1, 5, 15], title: '至宝の収集家' },
    { id: 'dex', cat: '宝', name: '装備図鑑を埋める', unit: '種', v: dexCount, n: [10, 30, 60, 100], title: '博物学者' },
    { id: 'monster', cat: '図鑑', name: '魔物図鑑を埋める', unit: '種', v: monsters, n: [5, 10, 15], title: '魔物博士' },
    { id: 'monlegend', cat: '図鑑', name: '魔物に「伝」の印', unit: '種', v: legends, n: [1, 5, 10, 15], title: '伝説の記録者' },
    { id: 'fish', cat: '図鑑', name: '魚を釣る', unit: '匹', v: () => ss().fish || 0, n: [10, 100, 500, 2000], title: '桟橋の主' },
    { id: 'fishdex', cat: '図鑑', name: '魚図鑑を埋める', unit: '種', v: fishDex, n: [5, 10, 15, 19], title: '釣り名人' },
    { id: 'runs', cat: '再建', name: 'ギルドを再建する', unit: '回', v: () => pr().runs || 0, n: [1, 3, 5, 10, 20, 50], title: '不滅の灯' },
    { id: 'stars', cat: '再建', name: '灯火の星を集める', unit: '個', v: () => pr().total || 0, n: [20, 100, 300, 1000], title: '星を継ぐ者' },
    { id: 'trials', cat: '再建', name: '試練の札を積んで再建', unit: '枚', v: () => pr().trialsDone || 0, n: [1, 5, 15, 30], title: '試練を越えし者' },
    { id: 'goals', cat: '再建', name: '周回の目標を達成', unit: '件', v: () => ss().goalsDone || 0, n: [1, 10, 30, 100], title: '旅路の達人' },
    { id: 'relics', cat: '再建', name: '遺物を選ぶ', unit: '個', v: () => ss().relicsPicked || 0, n: [5, 30, 100, 300], title: '遺物の目利き' },
  ];
  A.BY = {};
  A.LINES.forEach((l) => (A.BY[l.id] = l));

  function data() {
    const s = st();
    s.ach = s.ach || { got: {}, title: '' };
    s.ach.got = s.ach.got || {};
    return s.ach;
  }
  A.data = data;
  // いま何段目まで達成しているか（受け取り済みとは別）
  A.reached = (l) => { const v = l.v(); let k = 0; while (k < l.n.length && v >= l.n[k]) k++; return k; };
  A.claimed = (l) => data().got[l.id] || 0;
  A.claimable = () => A.LINES.reduce((n, l) => n + Math.max(0, A.reached(l) - A.claimed(l)), 0);
  A.total = () => A.LINES.reduce((n, l) => n + l.n.length, 0);
  A.done = () => A.LINES.reduce((n, l) => n + A.claimed(l), 0);
  A.titles = () => A.LINES.filter((l) => A.claimed(l) >= l.n.length).map((l) => l.title);
  A.title = () => { const t = data().title; return t && A.titles().includes(t) ? t : ''; };
  A.reward = (k) => REW[Math.min(k, REW.length - 1)];

  A.claim = function (id) {
    const l = A.BY[id];
    if (!l) return null;
    const d = data();
    const k = d.got[id] || 0;
    if (A.reached(l) <= k) return null;
    const cry = A.reward(k);
    d.got[id] = k + 1;
    G.items.addCons('cry', cry);
    const titled = d.got[id] >= l.n.length;
    if (titled && !d.title) d.title = l.title;
    G.sim.save();
    return { cry, titled, title: l.title, tier: k + 1 };
  };
  A.claimAll = function () {
    let cry = 0, n = 0;
    const titles = [];
    A.LINES.forEach((l) => { let r; while ((r = A.claim(l.id))) { cry += r.cry; n++; if (r.titled) titles.push(r.title); } });
    return { cry, n, titles };
  };

  // 新しく段を達成したらお知らせ（数秒ごとに確認）
  let acc = 0, known = null;
  A.tick = function (dt) {
    acc += dt;
    if (acc < 2.5 || !G.state) return;
    acc = 0;
    const now = A.LINES.map((l) => A.reached(l));
    if (!known) { known = now; return; }
    A.LINES.forEach((l, i) => {
      if (now[i] > known[i] && now[i] > A.claimed(l)) {
        G.ui.toast(`実績達成！「${l.name}」${fmtN(l, l.n[now[i] - 1])}`, 'rare3', 'ach');
        G.audio.sfx('rarity', 3);
      }
    });
    known = now;
    G.ui.refreshHud();
  };
  function fmtN(l, n) { return l.unit === 'G' ? G.fmt(n) + 'G' : l.unit === 'Lv' ? 'Lv' + n : G.fmt(n) + l.unit; }

  // ---------------------------------------------------------------- 画面
  A.open = function (replace) {
    const d = data();
    const can = A.claimable();
    const cats = [...new Set(A.LINES.map((l) => l.cat))];
    const titles = A.titles();
    let h = `<div class="ach"><h2>実績</h2><p class="sub">${A.done()} / ${A.total()} 段 ・ 称号 ${titles.length} / ${A.LINES.length}</p>`;
    if (can) h += `<button class="btn primary wide" id="achAll">まとめて受け取る（${can}）</button>`;
    h += `<div class="ach-title"><b>いまの称号</b><span>${A.title() ? `《${G.esc(A.title())}》` : 'なし（実績の最後の段で手に入ります）'}</span>${titles.length ? '<button class="link inline" id="achTitle">変える</button>' : ''}</div>`;
    cats.forEach((c) => {
      h += `<h3 class="mini">${c}</h3><div class="ach-list">`;
      A.LINES.filter((l) => l.cat === c).forEach((l) => {
        const k = A.claimed(l), r = A.reached(l), v = l.v();
        const full = k >= l.n.length;
        const next = l.n[Math.min(k, l.n.length - 1)];
        const prev = k > 0 ? l.n[k - 1] : 0;
        const pct = full ? 100 : Math.max(0, Math.min(100, ((v - prev) / Math.max(1, next - prev)) * 100));
        const ready = r > k;
        h += `<div class="ach-row ${full ? 'full' : ''} ${ready ? 'ready' : ''}"><div class="ach-tier">${l.n.map((_, i) => `<i class="${i < k ? 'on' : i < r ? 'can' : ''}"></i>`).join('')}</div>
          <div class="grow"><b>${l.name}${full ? `<em>《${l.title}》</em>` : ''}</b><div class="bar"><i style="width:${pct}%"></i></div><small>${full ? `${fmtN(l, v)} ・ すべて達成` : `${fmtN(l, Math.min(v, next))} / ${fmtN(l, next)}`}</small></div>
          ${ready ? `<button class="btn sm go" data-ach="${l.id}">受け取る<span>魔晶石 ${A.reward(k)}</span></button>` : full ? '<span class="stamp">達成</span>' : `<span class="ach-rw">魔晶石 ${A.reward(k)}</span>`}</div>`;
      });
      h += '</div>';
    });
    h += '</div>';
    G.ui.modal(h, [{ text: '閉じる', cls: 'primary' }], {
      cls: 'wide', replace: !!replace,
      onShow: (card) => {
        G.$$('[data-ach]', card).forEach((b) => b.addEventListener('click', () => {
          const r = A.claim(b.dataset.ach);
          if (!r) return;
          G.audio.sfx('claim');
          G.haptic(12);
          if (r.titled) { G.ui.fx.confetti(); G.audio.sfx('rarity', 4); G.ui.toast(`称号《${r.title}》を手に入れた！`, 'rare4'); } else G.ui.toast(`魔晶石 +${r.cry}`, 'good');
          G.ui.refreshHud();
          const sc = card.scrollTop;
          A.open(true);
          G.$('#modalCard').scrollTop = sc;
        }));
        const all = G.$('#achAll', card);
        if (all) all.addEventListener('click', () => {
          const r = A.claimAll();
          G.audio.sfx('rarity', 3);
          G.haptic(20);
          G.ui.fx.confetti();
          G.ui.toast(`実績 ${r.n}段ぶん ・ 魔晶石 +${r.cry}${r.titles.length ? ` ・ 称号${r.titles.map((t) => `《${t}》`).join('')}` : ''}`, 'rare3');
          G.ui.refreshHud();
          A.open(true);
        });
        const tb = G.$('#achTitle', card);
        if (tb) tb.addEventListener('click', () => pickTitle());
      },
    });
  };
  function pickTitle() {
    const d = data();
    const list = A.titles();
    G.ui.modal(`<div class="ach-pick"><h2>称号をえらぶ</h2><p class="hint">マスターとしてコメントしたときに、名前の横に出ます</p><div class="ach-titles">${['', ...list].map((t) => `<button class="btn ${d.title === t ? 'primary' : 'ghost'}" data-tt="${G.esc(t)}">${t ? `《${G.esc(t)}》` : 'つけない'}</button>`).join('')}</div></div>`, [{ text: '戻る', cls: 'ghost', fn: () => setTimeout(() => A.open(), 240) }], {
      replace: true,
      onShow: (card) => G.$$('[data-tt]', card).forEach((b) => b.addEventListener('click', () => { d.title = b.dataset.tt; G.audio.sfx('tap'); G.sim.save(); A.open(true); })),
    });
  }
})();
