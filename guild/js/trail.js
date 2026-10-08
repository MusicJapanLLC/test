/* ギルドの灯 — trail: 周回ごとに違う「旅路」
 *  - 遺物：ランクが上がるたびに 3つから1つ選ぶ。その周回だけ効き、再建で消える。同じ系統3つで「共鳴」
 *  - 試練の札：再建のときに最大3枚。自分で難しくすると、次の再建で星が増える
 *  - 周回の目標：周回ごとに3つ。達成すると灯火の星と魔晶石
 *  データは G.state.run（周回の記録）に入れる。再建で run が作り直されるので、自然に消える
 */
'use strict';
(function () {
  if (!G.feature('trail')) return;
  const T = (G.trail = {});
  const S = () => G.sim;

  // ---------------------------------------------------------------- 遺物
  T.FAM = {
    gold: { name: '黄金', mark: '金', col: '#f2c14e', res: { gold: 0.3 }, resText: 'ゴールド +30%' },
    wind: { name: '疾風', mark: '風', col: '#6fd6c8', res: { speed: 0.12 }, resText: '遠征時間 -12%' },
    war: { name: '武勇', mark: '武', col: '#ff7a59', res: { pow: 0.15 }, resText: '戦力 +15%' },
    luck: { name: '幸運', mark: '運', col: '#8ee07a', res: { great: 0.04, find: 20 }, resText: '大成功率 +4%・レア発見 +20' },
    sage: { name: '叡智', mark: '知', col: '#a99cff', res: { exp: 0.2, fame: 0.15 }, resText: '経験値 +20%・名声 +15%' },
    craft: { name: '匠', mark: '匠', col: '#d9a46a', res: { build: 0.12, mat: 0.3 }, resText: '施設の費用 -12%・素材 +30%' },
  };
  T.FAM_IDS = Object.keys(T.FAM);
  const R = (id, fam, name, fx) => ({ id, fam, name, fx });
  T.RELICS = [
    R('neko', 'gold', '酒場の招き猫', { gold: 0.15 }),
    R('koro', 'gold', '金貨の香炉', { gold: 0.1, build: 0.05 }),
    R('tenbin', 'gold', '商人の天秤', { gold: 0.2, speed: -0.05 }),
    R('rashin', 'gold', '黄金の羅針盤', { gold: 0.12, find: 10 }),
    R('insho', 'gold', '富豪の印章', { gold: 0.25, exp: -0.1 }),
    R('chokin', 'gold', '小さな貯金箱', { gold: 0.08, fame: 0.05 }),
    R('sunadokei', 'wind', '疾風の砂時計', { speed: 0.1 }),
    R('hane', 'wind', '渡り鳥の羽', { speed: 0.08, exp: 0.05 }),
    R('teitetsu', 'wind', '早馬の蹄鉄', { speed: 0.12, great: -0.02 }),
    R('kane', 'wind', '時忘れの鐘', { speed: 0.15, gold: -0.1 }),
    R('hata', 'wind', '風読みの旗', { speed: 0.06, succ: 0.03 }),
    R('himo', 'wind', '韋駄天の靴紐', { speed: 0.09, find: 8 }),
    R('tsunobue', 'war', '狂戦士の角笛', { pow: 0.15, succ: -0.03 }),
    R('tate', 'war', '古強者の盾', { pow: 0.08, succ: 0.04 }),
    R('ryukotsu', 'war', '竜骨の護符', { pow: 0.12 }),
    R('tsuchi', 'war', '鍛冶神の槌', { pow: 0.1, build: 0.05 }),
    R('gaito', 'war', '英雄の外套', { pow: 0.06, fame: 0.1 }),
    R('kusari', 'war', '剣闘士の鎖', { pow: 0.2, speed: -0.08 }),
    R('shiori', 'luck', '四つ葉の栞', { great: 0.03 }),
    R('kobin', 'luck', '星屑の小瓶', { great: 0.02, find: 15 }),
    R('usagi', 'luck', '幸運の兎の足', { great: 0.04, gold: -0.05 }),
    R('chizu', 'luck', '宝探しの地図', { find: 30 }),
    R('niji', 'luck', '虹の欠片', { great: 0.02, exp: 0.08 }),
    R('suzu', 'luck', '気まぐれ猫の鈴', { great: 0.05, succ: -0.04 }),
    R('megane', 'sage', '賢者の眼鏡', { exp: 0.15 }),
    R('fumen', 'sage', '吟遊詩人の譜面', { fame: 0.12 }),
    R('sekiban', 'sage', '古代の石板', { exp: 0.1, fame: 0.06 }),
    R('bokuto', 'sage', '師範の木刀', { exp: 0.2, gold: -0.08 }),
    R('hanepen', 'sage', '語り部の羽ペン', { fame: 0.18, speed: -0.05 }),
    R('toshokan', 'sage', '王立図書館の鍵', { exp: 0.08, find: 10 }),
    R('tebukuro', 'craft', '職人の手袋', { mat: 0.25 }),
    R('monosashi', 'craft', '棟梁の物差し', { build: 0.1 }),
    R('hidane', 'craft', '錬金釜の火種', { mat: 0.15, gold: 0.05 }),
    R('nomi', 'craft', '石工の鑿', { build: 0.08, mat: 0.1 }),
    R('mamorifuda', 'craft', '守り札の束', { succ: 0.05 }),
    R('lamp', 'craft', '灯台守のランプ', { succ: 0.03, speed: 0.04 }),
  ];
  T.BY = {};
  T.RELICS.forEach((r) => (T.BY[r.id] = r));
  const FX_NAME = { gold: 'ゴールド', speed: '遠征時間', pow: '戦力', great: '大成功率', find: 'レア発見', exp: '経験値', fame: '名声', build: '施設の費用', mat: '素材', succ: '成功率', req: '依頼の難しさ' };
  // 効果の文：speed と build は「減る」ほど良いので符号を反転して見せる
  T.fxText = (fx) => Object.entries(fx).map(([k, v]) => {
    if (k === 'find') return `${FX_NAME[k]} ${v >= 0 ? '+' : ''}${v}`;
    const shown = k === 'speed' || k === 'build' ? -v : v;
    return `${FX_NAME[k]} ${shown >= 0 ? '+' : ''}${Math.round(shown * 100)}%`;
  }).join('・');

  // ---------------------------------------------------------------- 試練の札
  T.TRIALS = [
    { id: 'poor', name: '金欠の札', desc: 'ゴールド -30%', fx: { gold: -0.3 }, star: 0.15 },
    { id: 'few', name: '少数精鋭の札', desc: '冒険者は4人まで', fx: {}, star: 0.2 },
    { id: 'storm', name: '大嵐の札', desc: '遠征時間 +25%', fx: { speed: -0.25 }, star: 0.15 },
    { id: 'strong', name: '強敵の札', desc: '依頼の難しさ +25%', fx: { req: 0.25 }, star: 0.25 },
    { id: 'unknown', name: '無名の札', desc: '名声 -25%', fx: { fame: -0.25 }, star: 0.3 },
  ];
  T.TRIAL = {};
  T.TRIALS.forEach((x) => (T.TRIAL[x.id] = x));

  // ---------------------------------------------------------------- 周回の目標
  const GOALS = [
    { id: 'rank8', text: 'ランク8に到達する', v: (st) => st.rank, n: 8, stars: 4 },
    { id: 'rank10', text: 'ランク10に到達する', v: (st) => st.rank, n: 10, stars: 8 },
    { id: 'boss', text: '紅蓮竜王を討伐する', v: (st) => (st.flags.runBoss ? 1 : 0), n: 1, stars: 8 },
    { id: 'legend', text: '伝説級を{n}回出す', stat: 'legend', ns: [3, 5], stars: 4 },
    { id: 'great', text: '大成功を{n}回出す', stat: 'great', ns: [15, 30], stars: 3 },
    { id: 'quests', text: '依頼を{n}回こなす', stat: 'quests', ns: [60, 120], stars: 3 },
    { id: 'nice', text: 'ナイス指示を{n}回出す', stat: 'nice', ns: [5, 10], stars: 3 },
    { id: 'relics', text: '遺物を{n}個集める', v: (st) => (st.run.relics || []).length, ns: [5, 7], stars: 3 },
    { id: 'res', text: '遺物の共鳴を起こす', v: () => (T.resonances().length ? 1 : 0), n: 1, stars: 4 },
    { id: 'fast', text: '{h}時間以内にランク8', fast: true, stars: 6 },
  ];
  const GOAL_CRY = 30;

  // ---------------------------------------------------------------- データ
  function run() { return S().run(); }
  function rr() {
    const r = run();
    if (!r.relics) r.relics = [];
    if (r.picks == null) r.picks = 0;
    if (!r.trials) r.trials = [];
    return r;
  }
  T.relics = () => rr().relics.map((id) => T.BY[id]).filter(Boolean);
  T.has = (id) => rr().relics.includes(id);
  T.picks = () => (G.state ? rr().picks : 0);
  T.trials = () => rr().trials.map((id) => T.TRIAL[id]).filter(Boolean);
  T.hasTrial = (id) => !!(G.state && G.state.run && (G.state.run.trials || []).includes(id));
  T.trialStars = () => T.trials().reduce((n, x) => n + x.star, 0);
  T.famCount = () => { const c = {}; T.relics().forEach((r) => { c[r.fam] = (c[r.fam] || 0) + 1; }); return c; };
  T.resonances = () => { const c = T.famCount(); return T.FAM_IDS.filter((f) => (c[f] || 0) >= 3); };

  // 効果の合計（sim の starFx から呼ばれる）。毎フレーム呼ばれるので、変わったときだけ数え直す
  let cacheKey = '', cache = {};
  T.fx = function (key) {
    const st = G.state;
    if (!st || !st.run) return 0;
    const r = st.run;
    const k = (r.n || 0) + ':' + (r.relics || []).join(',') + ':' + (r.trials || []).join(',');
    if (k !== cacheKey) {
      cacheKey = k;
      cache = {};
      const add = (fx) => Object.entries(fx).forEach(([kk, v]) => { cache[kk] = (cache[kk] || 0) + v; });
      (r.relics || []).forEach((id) => { if (T.BY[id]) add(T.BY[id].fx); });
      const c = {};
      (r.relics || []).forEach((id) => { const x = T.BY[id]; if (x) c[x.fam] = (c[x.fam] || 0) + 1; });
      T.FAM_IDS.forEach((f) => { if ((c[f] || 0) >= 3) add(T.FAM[f].res); });
      (r.trials || []).forEach((id) => { if (T.TRIAL[id]) add(T.TRIAL[id].fx); });
      // 行き過ぎないように
      if (cache.speed > 0.4) cache.speed = 0.4;
      if (cache.build > 0.4) cache.build = 0.4;
    }
    const v = cache[key] || 0;
    // find は「+10」のような点数。starFx の find は点数で足されるので、そのまま
    return v;
  };

  // 3つの候補（周回・何回目の選択かで決まる。選び直しで変わらない）
  T.options = function () {
    const r = rr();
    const own = new Set(r.relics);
    const pool = T.RELICS.filter((x) => !own.has(x.id));
    const seed = (r.n || 1) * 7919 + r.relics.length * 104729 + (r.reroll || 0) * 31;
    const out = [];
    const c = T.famCount();
    // 1つは、いま集めている系統から（共鳴を狙えるように）
    const fams = Object.keys(c).filter((f) => c[f] < 3 || true).sort((a, b) => c[b] - c[a]);
    let k = 0;
    if (fams.length) {
      const fp = pool.filter((x) => x.fam === fams[0]);
      if (fp.length) out.push(fp[Math.floor(G.hash(seed + 1) * fp.length)]);
    }
    while (out.length < 3 && k < 50) {
      const x = pool[Math.floor(G.hash(seed + k * 13 + 5) * pool.length)];
      if (x && !out.includes(x)) out.push(x);
      k++;
    }
    return out;
  };
  T.pick = function (id) {
    const r = rr();
    if (r.picks <= 0 || r.relics.includes(id) || !T.BY[id]) return false;
    const before = T.resonances();
    r.relics.push(id);
    r.picks--;
    r.reroll = 0;
    G.state.stats.relicsPicked = (G.state.stats.relicsPicked || 0) + 1;
    const after = T.resonances();
    const newRes = after.filter((f) => !before.includes(f));
    G.emit('trail', { pick: id, res: newRes });
    G.sim.save();
    return { res: newRes };
  };
  // 選び直し（魔晶石 20）
  T.REROLL_COST = 20;
  T.reroll = function () {
    const r = rr();
    if (!G.items.spendCry(T.REROLL_COST)) return false;
    r.reroll = (r.reroll || 0) + 1;
    return true;
  };

  // ---------------------------------------------------------------- 目標
  function goalsOf() {
    const r = run();
    const st = G.state;
    if (!r.goals) {
      const base = {};
      ['legend', 'great', 'quests', 'nice'].forEach((k) => { base[k] = k === 'great' ? (st.stats.great || 0) + (st.stats.legend || 0) : st.stats[k] || 0; });
      const seed = (r.n || 1) * 2654435761;
      const pool = GOALS.filter((g) => g.id !== 'boss' || true).slice();
      const picks = [];
      let k = 0;
      while (picks.length < 3 && k < 40) {
        const g = pool[Math.floor(G.hash(seed + k * 97) * pool.length)];
        k++;
        if (!g || picks.some((p) => p.id === g.id)) continue;
        if ((g.id === 'rank8' && picks.some((p) => p.id === 'rank10')) || (g.id === 'rank10' && picks.some((p) => p.id === 'rank8'))) continue;
        const n = g.ns ? g.ns[Math.floor(G.hash(seed + k * 7) * g.ns.length)] : g.n;
        const pk = { id: g.id, n };
        if (g.fast) {
          const best = (S().prestige().best || {})[8];
          pk.h = best ? Math.max(1, Math.ceil((best * 0.9) / 3600)) : 72;
          pk.n = 1;
        }
        picks.push(pk);
      }
      r.goals = picks;
      r.gbase = base;
      r.gdone = {};
    }
    return r;
  }
  // 目標を1周に1回だけ入れ替えられる（達成できそうにない組み合わせのときのため）
  T.canSwap = () => !goalsOf().goalSwap;
  T.swapGoal = function (id) {
    const r = goalsOf();
    if (r.goalSwap) return false;
    const i = r.goals.findIndex((g) => g.id === id);
    if (i < 0 || r.gdone[id]) return false;
    const st = G.state;
    const have = new Set(r.goals.map((g) => g.id));
    const pool = GOALS.filter((g) => !have.has(g.id) && !(g.id === 'rank8' && have.has('rank10')) && !(g.id === 'rank10' && have.has('rank8')) && !(g.id === 'rank8' && st.rank >= 8) && !(g.id === 'rank10' && st.rank >= 10));
    if (!pool.length) return false;
    const g = pool[Math.floor(G.hash((r.n || 1) * 31337 + i * 7) * pool.length)];
    const pk = { id: g.id, n: g.ns ? g.ns[0] : g.n };
    if (g.fast) { const best = (S().prestige().best || {})[8]; pk.h = best ? Math.max(1, Math.ceil((best * 0.9) / 3600)) : 72; pk.n = 1; }
    // 入れ替えた目標の数は、いまから数える
    if (g.stat) r.gbase[g.stat] = g.stat === 'great' ? (st.stats.great || 0) + (st.stats.legend || 0) : st.stats[g.stat] || 0;
    r.goals[i] = pk;
    r.goalSwap = 1;
    G.sim.save();
    return g;
  };
  T.goals = function () {
    const st = G.state;
    const r = goalsOf();
    return r.goals.map((pk) => {
      const g = GOALS.find((x) => x.id === pk.id);
      if (!g) return null;
      let cur;
      if (g.fast) cur = r.ranks && r.ranks[8] != null && r.ranks[8] <= pk.h * 3600 ? 1 : 0;
      else if (g.stat) cur = (g.stat === 'great' ? (st.stats.great || 0) + (st.stats.legend || 0) : st.stats[g.stat] || 0) - (r.gbase[g.stat] || 0);
      else cur = g.v(st);
      const n = pk.n;
      const failed = g.fast && cur < 1 && S().runSec() > pk.h * 3600;
      return { id: pk.id, text: g.text.replace('{n}', n).replace('{h}', pk.h), cur: Math.max(0, Math.min(n, cur)), n, done: cur >= n, claimed: !!r.gdone[pk.id], stars: g.stars, cry: GOAL_CRY, failed };
    }).filter(Boolean);
  };
  T.claimable = () => (G.state && G.state.flags.tut >= 90 ? T.goals().filter((g) => g.done && !g.claimed).length : 0);
  T.collect = function () {
    const r = goalsOf();
    const pr = S().prestige();
    let n = 0, stars = 0, cry = 0;
    T.goals().forEach((g) => {
      if (!g.done || g.claimed) return;
      r.gdone[g.id] = true;
      stars += g.stars;
      cry += g.cry;
      n++;
    });
    if (n) {
      pr.stars += stars;
      pr.total += stars;
      G.state.crystals = (G.state.crystals || 0) + cry;
      G.state.stats.goalsDone = (G.state.stats.goalsDone || 0) + n;
    }
    return { n, stars, cry };
  };

  // ---------------------------------------------------------------- 画面：遺物をえらぶ
  function emblem(x, size = 44) {
    const f = T.FAM[x.fam];
    return `<span class="tr-emb" style="--c:${f.col};--s:${size}px"><b>${f.mark}</b></span>`;
  }
  T.emblem = emblem;
  T.offer = function (o = {}) {
    if (T.picks() <= 0) return;
    // ほかの画面が開いているときは出さない（ランクの紋章・灯火の星の画面から、あとで選べる）
    if (G.ui.modalOpen() && !o.replace) return;
    const opts = T.options();
    if (!opts.length) { rr().picks = 0; return; }
    const c = T.famCount();
    const cards = opts.map((x) => {
      const f = T.FAM[x.fam];
      const n = (c[x.fam] || 0) + 1;
      const resHint = n === 3 ? `<em class="tr-res">共鳴！ ${f.resText}</em>` : n < 3 ? `<em>${f.name} ${n}/3</em>` : `<em>${f.name} ${n}</em>`;
      return `<button class="tr-card" data-relic="${x.id}" style="--c:${f.col}">${emblem(x, 48)}<div class="grow"><b>${G.esc(x.name)}</b><small>${T.fxText(x.fx)}</small>${resHint}</div></button>`;
    }).join('');
    const st = G.state;
    const left = T.picks();
    G.ui.modal(`<div class="tr-offer"><small>この周回だけの遺物 ${left > 1 ? `・ あと${left}回選べます` : ''}</small><h2>遺物をひとつ選ぶ</h2><div class="tr-cards">${cards}</div><p class="hint">同じ系統を3つ集めると「共鳴」して、さらに強くなります。再建すると消えます。</p></div>`, [
      { text: `選び直す<span>魔晶石 ${T.REROLL_COST}</span>`, cls: 'ghost', keep: true, fn: () => {
        if (!T.reroll()) { G.audio.sfx('error'); G.ui.toast('魔晶石が足りません', 'bad'); return; }
        G.audio.sfx('flash');
        G.ui.refreshHud();
        T.offer({ replace: true });
      } },
      { text: 'あとで', cls: 'ghost', fn: () => G.ui.toast('遺物は「灯火の星」の画面からいつでも選べます', 'info') },
    ], {
      cls: 'wide tr-modal', replace: !!o.replace,
      onShow: (card) => {
        G.$$('[data-relic]', card).forEach((b) => b.addEventListener('click', () => {
          const x = T.BY[b.dataset.relic];
          const res = T.pick(x.id);
          if (!res) return;
          b.classList.add('chosen');
          G.audio.sfx('rarity', 3);
          G.haptic(18);
          const rc = b.getBoundingClientRect();
          if (G.ui.fx.burst) G.ui.fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2);
          setTimeout(() => {
            G.ui.closeModal();
            if (res.res.length) {
              const f = T.FAM[res.res[0]];
              setTimeout(() => G.ui.modal(`<div class="tr-resonance" style="--c:${f.col}"><div class="tr-ring">${emblem(x, 72)}</div><small>遺物の共鳴</small><h2>${f.name}の共鳴</h2><p>${f.resText}</p></div>`, [{ text: 'すごい！', cls: 'primary', fn: () => { if (T.picks() > 0) setTimeout(T.offer, 300); } }], { cls: 'celebrate', onShow: () => { G.audio.sfx('rarity', 4); G.ui.fx.confetti(); } }), 260);
            } else {
              G.ui.toast(`遺物《${x.name}》：${T.fxText(x.fx)}`, 'rare3');
              if (T.picks() > 0) setTimeout(T.offer, 500);
            }
            G.ui.refreshHud();
            if (G.ui.sheetTab && G.ui.sheetTab() === 'stars') G.ui.renderSheet();
          }, 420);
        }));
      },
    });
    void st;
  };

  // ---------------------------------------------------------------- 灯火の星の画面に出す「この周回の旅路」
  T.panelHtml = function () {
    const rel = T.relics();
    const c = T.famCount();
    const res = T.resonances();
    const picks = T.picks();
    const chips = rel.length ? rel.map((x) => `<span class="tr-chip${res.includes(x.fam) ? ' res' : ''}" style="--c:${T.FAM[x.fam].col}" title="${G.esc(T.fxText(x.fx))}">${emblem(x, 22)}${G.esc(x.name)}</span>`).join('') : '<span class="tr-none">ランクが上がるたびに、遺物を1つ選べます</span>';
    const famLine = T.FAM_IDS.filter((f) => c[f]).map((f) => `<span class="tr-fam${c[f] >= 3 ? ' on' : ''}" style="--c:${T.FAM[f].col}">${T.FAM[f].name} ${Math.min(c[f], 3)}/3</span>`).join('');
    const goals = T.goals().map((g) => `<div class="tr-goal ${g.claimed ? 'got' : g.done ? 'done' : g.failed ? 'failed' : ''}"><div class="grow"><b>${G.esc(g.text)}</b><div class="bar"><i style="width:${Math.round((g.cur / g.n) * 100)}%"></i></div><small>${g.cur}/${g.n} ・ 灯火の星 +${g.stars}・魔晶石 ${g.cry}</small></div>${g.claimed ? '<span class="stamp">達成</span>' : g.done ? '<button class="btn sm go" data-goal="1">受け取る</button>' : g.failed ? '<span class="tr-fail">時間切れ</span>' : ''}${!g.done && !g.claimed && T.canSwap() ? `<button class="link inline tr-swap" data-swap="${g.id}">変える</button>` : ''}</div>`).join('');
    const tr = T.trials();
    const trialLine = tr.length ? `<div class="tr-trials"><b>試練の札</b>${tr.map((x) => `<span class="tr-tcard">${G.esc(x.name)}<small>${x.desc}</small></span>`).join('')}<em>再建の星 +${Math.round(T.trialStars() * 100)}%</em></div>` : '';
    return `<div class="sec trail"><h3>この周回の旅路${picks ? `<button class="btn sm go pulse inline" id="trPick">遺物を選ぶ（${picks}）</button>` : ''}</h3>
      <div class="tr-relics">${chips}</div>${famLine ? `<div class="tr-fams">${famLine}</div>` : ''}${trialLine}
      <h4 class="tr-h">周回の目標</h4>${goals}</div>`;
  };
  T.bindPanel = function (body) {
    const p = G.$('#trPick', body);
    if (p) p.addEventListener('click', () => { G.audio.sfx('open'); T.offer({ replace: G.ui.modalOpen() }); });
    G.$$('[data-swap]', body).forEach((b) => b.addEventListener('click', () => {
      G.ui.modal('<div class="confirm"><h2>目標を入れ替えますか？</h2><p>入れ替えは1周に1回だけです。新しい目標の数は、いまから数えます。</p></div>', [
        { text: 'やめる', cls: 'ghost' },
        { text: '入れ替える', cls: 'primary', fn: () => { const g = T.swapGoal(b.dataset.swap); if (g) { G.audio.sfx('flash'); G.ui.toast('周回の目標を入れ替えました', 'good'); } G.ui.renderSheet(); } },
      ]);
    }));
    G.$$('[data-goal]', body).forEach((b) => b.addEventListener('click', () => {
      const r = T.collect();
      if (!r.n) return;
      G.audio.sfx('rarity', 3);
      G.haptic(16);
      G.ui.toast(`周回の目標を達成！ 灯火の星 +${r.stars}・魔晶石 ${r.cry}`, 'rare3');
      G.sim.save();
      G.ui.refreshHud();
      G.ui.renderSheet();
    }));
  };
  T.sig = () => { if (!G.state) return ''; const r = rr(); return [r.relics.join(), r.picks, JSON.stringify(r.gdone || {}), T.goals().map((g) => g.id + g.cur).join(), r.goalSwap || 0].join('|'); };

  // ---------------------------------------------------------------- 再建の画面：試練の札を選ぶ
  let chosen = [];
  T.trialPickerHtml = function () {
    const cards = T.TRIALS.map((x) => `<button class="tr-trial${chosen.includes(x.id) ? ' on' : ''}" data-trial="${x.id}"><b>${G.esc(x.name)}</b><small>${x.desc}</small><em>星 +${Math.round(x.star * 100)}%</em></button>`).join('');
    const sum = chosen.reduce((n, id) => n + T.TRIAL[id].star, 0);
    return `<div class="tr-picker"><b>次の周回の試練の札 <small>最大3枚・なくてもよい</small></b><div class="tr-tgrid">${cards}</div><p class="hint" id="trSum">${chosen.length ? `次の再建で手に入る星 +${Math.round(sum * 100)}%` : '札を選ぶと、次の周回が難しくなるかわりに、次の再建で星が増えます'}</p></div>`;
  };
  T.bindPicker = function (card) {
    G.$$('[data-trial]', card).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.trial;
      if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
      else if (chosen.length < 3) chosen.push(id);
      else { G.audio.sfx('error'); G.ui.toast('試練の札は3枚までです', 'info'); return; }
      G.audio.sfx('tap');
      G.$$('[data-trial]', card).forEach((x) => x.classList.toggle('on', chosen.includes(x.dataset.trial)));
      const sum = chosen.reduce((n, k) => n + T.TRIAL[k].star, 0);
      const el = G.$('#trSum', card);
      if (el) el.textContent = chosen.length ? `次の再建で手に入る星 +${Math.round(sum * 100)}%` : '札を選ぶと、次の周回が難しくなるかわりに、次の再建で星が増えます';
    }));
  };
  T.chosenTrials = () => chosen.slice();
  T.resetPicker = () => { chosen = (G.state && G.state.run && G.state.run.trials) ? G.state.run.trials.slice() : []; };
  T.applyTrials = function (ids) {
    const r = rr();
    r.trials = (ids || []).filter((id) => T.TRIAL[id]).slice(0, 3);
    cacheKey = '';
  };

  // ランクが上がったら、遺物を選ぶ権利
  G.on('rankup', () => {
    if (!G.state) return;
    const r = rr();
    r.picks = (r.picks || 0) + 1;
    G.sim.save();
    if (G.ui && G.ui.whenFree) G.ui.whenFree(() => T.offer(), 1400);
  });
})();
