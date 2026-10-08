// ギルドの灯 — 推し（ギルドに1人。推しの冒険譚は特別になる）
(function () {
  'use strict';
  if (!G.feature('oshi')) return;
  const O = (G.oshi = {});

  O.COLORS = [
    { id: 'sakura', name: '桜', c: '#ff8fb8' },
    { id: 'flame', name: '紅', c: '#ff6a3d' },
    { id: 'sun', name: '金', c: '#ffc94a' },
    { id: 'leaf', name: '若葉', c: '#6fdc8c' },
    { id: 'sea', name: '空', c: '#4fc3ff' },
    { id: 'violet', name: '藤', c: '#b48cff' },
    { id: 'snow', name: '雪', c: '#eef3ff' },
    { id: 'night', name: '宵', c: '#7a86ff' },
  ];
  // 推し度（ポイント）の段階
  O.LV = [0, 20, 60, 150, 300, 600];
  O.LV_NAME = ['推し始め', '推し活', 'ガチ推し', '最推し', '推し一筋', '永遠の推し'];
  O.UNLOCK = [
    '推し色の弾幕・常連の反応',
    '冒険譚の入場カットイン',
    'いいねすると、推しからお礼の一言',
    '戦闘中、推し色のオーラをまとう',
    'いいねがハートの雨になる',
    '勝利の特別ポーズ・称号「推し一筋」',
  ];
  O.GAIN = { like: 5, post: 8, watch: 2, nice: 5 };

  function data() {
    const st = G.state;
    if (!st.oshi || typeof st.oshi !== 'object') st.oshi = { id: null, color: 'sakura', pts: {}, lvSeen: {} };
    const o = st.oshi;
    if (!o.pts) o.pts = {};
    if (!o.lvSeen) o.lvSeen = {};
    if (!O.COLORS.some((c) => c.id === o.color)) o.color = 'sakura';
    return o;
  }
  O.data = data;
  O.id = function () {
    if (!G.state) return null;
    const o = data();
    if (o.id && !G.state.adv.some((a) => a.id === o.id)) return null; // 解雇・引退した
    return o.id || null;
  };
  O.is = (id) => !!id && O.id() === id;
  O.adv = () => { const id = O.id(); return id ? G.state.adv.find((a) => a.id === id) || null : null; };
  O.name = () => { const a = O.adv(); return a ? a.name : ''; };
  O.colorId = () => data().color;
  O.color = () => (O.COLORS.find((c) => c.id === data().color) || O.COLORS[0]).c;
  O.pt = (id) => { id = id || O.id(); return id ? Math.floor(data().pts[id] || 0) : 0; };
  O.levelOf = (p) => { let l = 0; O.LV.forEach((v, i) => { if (p >= v) l = i; }); return l; };
  O.level = (id) => (id || O.id() ? O.levelOf(O.pt(id)) : -1);
  O.next = (id) => { const l = O.level(id); return l >= O.LV.length - 1 ? null : O.LV[l + 1]; };
  O.has = (lv) => O.id() && O.level() >= lv; // その段階の演出が解放されているか
  O.inParty = (party) => { const id = O.id(); return !!id && (party || []).some((p) => p && p.id === id); };
  // 推しがパーティにいると、大成功率が少しだけ上がる
  O.partyGreat = (party) => (O.inParty(party) ? 0.02 + 0.004 * Math.max(0, O.level()) : 0);

  O.set = function (id) {
    const o = data();
    const prev = o.id;
    o.id = id;
    if (id && o.pts[id] == null) o.pts[id] = 0;
    G.emit('oshi', { id, prev });
    G.sim.save();
  };
  O.setColor = function (cid) {
    if (!O.COLORS.some((c) => c.id === cid)) return;
    data().color = cid;
    G.emit('oshi', { id: O.id() });
    G.sim.save();
  };

  // 推し度を上げる（推しが関わったときだけ）
  O.gain = function (advId, n, why) {
    if (!advId || !O.is(advId) || !(n > 0)) return 0;
    const o = data();
    const before = O.levelOf(o.pts[advId] || 0);
    o.pts[advId] = (o.pts[advId] || 0) + n;
    const after = O.levelOf(o.pts[advId]);
    G.state.stats.oshiPts = (G.state.stats.oshiPts || 0) + n;
    if (after > before) {
      const key = advId + ':' + after;
      if (!o.lvSeen[key]) {
        o.lvSeen[key] = 1;
        setTimeout(() => levelUp(advId, after), why === 'like' || why === 'post' ? 900 : 300);
      }
    }
    return n;
  };
  // 冒険譚での出来事（like / post / watch / nice）
  O.onReel = function (reel, why) {
    if (!reel || !reel.party || !O.inParty(reel.party)) return 0;
    return O.gain(O.id(), O.GAIN[why] || 1, why);
  };

  function levelUp(advId, lv) {
    const a = G.state.adv.find((x) => x.id === advId);
    if (!a) return;
    G.emit('oshiLevel', { id: advId, lv });
    const html = `<div class="oshi-up" style="--oshi:${O.color()}"><div class="ou-heart">♥</div><small>推し度アップ</small><h2>${G.esc(a.name)}</h2><p class="ou-lv">${O.LV_NAME[lv]} <b>Lv${lv}</b></p><p class="ou-new">解放：${O.UNLOCK[lv]}</p></div>`;
    G.ui.modal(html, [{ text: 'やったね！', cls: 'primary', fn: () => {} }], { cls: 'celebrate', onShow: () => { G.audio.sfx('rarity', Math.min(4, 1 + lv)); if (G.ui.fx && G.ui.fx.confetti) G.ui.fx.confetti(); } });
  }

  // ---------------------------------------------------------------- 冒険者の詳細に出す欄
  O.detailHtml = function (a) {
    const me = O.is(a.id);
    const p = O.pt(a.id);
    if (!me) {
      const cur = O.adv();
      return `<div class="oshi-box off"><button class="btn sm oshi-set" id="oshiSet">♡ 推しにする</button><small>${cur ? `いまの推し：${G.esc(cur.name)}（推し度は人ごとに残ります）` : '推しの冒険譚は特別な演出になり、大成功率も少し上がる'}${p ? ` ・ ${G.esc(a.name)}の推し度 ${p}` : ''}</small></div>`;
    }
    const lv = O.level(a.id);
    const nx = O.next(a.id);
    const base = O.LV[lv];
    const pct = nx ? Math.round(((p - base) / (nx - base)) * 100) : 100;
    const chips = O.COLORS.map((c) => `<button class="oshi-col${c.id === O.colorId() ? ' on' : ''}" data-ocol="${c.id}" style="--c:${c.c}" aria-label="${c.name}"></button>`).join('');
    const list = O.UNLOCK.map((u, i) => `<li class="${i <= lv ? 'got' : ''}"><b>Lv${i}</b>${u}</li>`).join('');
    return `<div class="oshi-box on" style="--oshi:${O.color()}"><div class="ob-head"><span class="ob-heart">♥</span><b>推し</b><em>${O.LV_NAME[lv]} Lv${lv}</em><small>${nx ? `${p} / ${nx}` : `${p}（最大）`}</small></div><div class="ob-bar"><i style="width:${pct}%"></i></div><div class="ob-cols"><small>推し色</small>${chips}</div><details class="ob-list"><summary>推し度で解放されるもの</summary><ul>${list}</ul><p class="hint">推しの冒険譚にいいね +${O.GAIN.like}・コメント +${O.GAIN.post}・見届け +${O.GAIN.watch}・ナイス指示 +${O.GAIN.nice}</p></details><button class="link inline" id="oshiOff">推しをやめる</button></div>`;
  };
  O.bindDetail = function (card, a, rerender) {
    const s = G.$('#oshiSet', card);
    if (s) s.addEventListener('click', () => {
      O.set(a.id);
      G.audio.sfx('heart');
      G.haptic(12);
      G.ui.toast(`${a.name}を推しにしました ♥`, 'good');
      rerender();
    });
    const off = G.$('#oshiOff', card);
    if (off) off.addEventListener('click', () => { O.set(null); G.audio.sfx('soft'); rerender(); });
    G.$$('[data-ocol]', card).forEach((b) => b.addEventListener('click', () => { O.setColor(b.dataset.ocol); G.audio.sfx('tap'); rerender(); }));
  };
  // 一覧に付ける小さな印
  O.badge = (a) => (O.is(a.id) ? `<span class="oshi-badge" style="--oshi:${O.color()}" title="推し">♥</span>` : '');

  G.on('claimed', (reel) => { if (reel && !reel.digest) O.onReel(reel, 'watch'); });
})();
