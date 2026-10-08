/* ギルドの灯 — talent: 才能の樹（冒険者ひとりずつ。攻め・守り・運の3系統 × 5段）
 *  点数：5レベルごとに1点 ＋ 熟練の★2つごとに1点。いつでもゴールドで振り直せる
 *  職業ごとに段の名前が違う。効果は系統と段で決まる（装備の能力と同じ単位）
 */
'use strict';
(function () {
  if (!G.feature('talent')) return;
  const TL = (G.talent = {});
  const D = G.D;

  TL.BRANCH = [
    { id: 'atk', name: '攻め', col: '#ff7a59', fx: [{ pow: 3 }, { crit: 3 }, { pow: 4 }, { crit: 5 }, { pow: 8, great: 1 }] },
    { id: 'def', name: '守り', col: '#6fb8ff', fx: [{ succ: 2 }, { succ: 2 }, { succ: 1, great: 1 }, { succ: 3 }, { succ: 4, great: 1 }] },
    { id: 'luck', name: '運', col: '#8ee07a', fx: [{ gold: 5 }, { find: 6 }, { gold: 8, mat: 5 }, { find: 10 }, { gold: 10, great: 2 }] },
  ];
  TL.NAMES = {
    warrior: [['踏み込み', '豪腕', '渾身の一撃', '闘気', '覇王の剣'], ['受け流し', '鉄の意志', '仁王立ち', '不屈', '不動の構え'], ['戦利品漁り', '勝利の勘', '宝の匂い', '武運', '天運の剣士']],
    mage: [['詠唱短縮', '魔力増幅', '二重詠唱', '魔力暴走', '大魔導'], ['魔法障壁', '見切りの眼', '結界術', '魔力循環', '絶対障壁'], ['魔石鑑定', '星読み', '錬金の知恵', '秘宝の気配', '運命の詠唱']],
    thief: [['急所狙い', '早業', '影討ち', '連撃', '必殺の刃'], ['身のこなし', '気配消し', '罠外し', '逃げ足', '残像'], ['スリの手並み', '鍵開け', '宝探し', '闇市の顔', '怪盗の勘']],
    cleric: [['裁きの光', '聖撃', '破邪', '聖なる怒り', '神罰'], ['癒しの手', '加護', '聖域', '祈りの盾', '奇跡'], ['施しの心', '巡礼の知恵', '祝福', '聖遺物の導き', '女神の微笑み']],
    archer: [['狙い澄まし', '強弓', '二連射', '鷹の目', '一撃必中'], ['間合い取り', '森の気配', '罠仕掛け', '退き撃ち', '風を読む'], ['獲物の目利き', '狩人の勘', '遠見', '森の恵み', '幸運の矢羽']],
    knight: [['突撃', '槍術', '騎乗突破', '武勲', '聖騎士の誓い'], ['盾の構え', 'かばう', '鉄壁', '忠誠', '不落の城'], ['礼節', '名誉', '王の恩賞', '騎士の誉れ', '栄光の旗']],
    bard: [['鼓舞', '戦の歌', '熱狂', '英雄譚', '喝采の嵐'], ['子守唄', '癒しの調べ', '安らぎ', '静寂の歌', '守護の旋律'], ['投げ銭', '噂話', '人気者', '大入り', '伝説の歌い手']],
    alchemist: [['調合強化', '爆薬', '連鎖反応', '劇薬', '賢者の一撃'], ['解毒', '回復薬', '防護薬', '万能薬', '不老の霊薬'], ['素材鑑定', '抽出', '黄金錬成', '等価交換', '賢者の石']],
  };
  const FX_NAME = { pow: '戦力', crit: '会心率', succ: '成功率', great: '大成功率', gold: '獲得ゴールド', find: 'レア発見', mat: '素材' };
  TL.fxText = (fx) => Object.entries(fx).map(([k, v]) => `${FX_NAME[k]} +${v}${k === 'find' ? '' : '%'}`).join('・');
  TL.nodeName = (cls, b, i) => ((TL.NAMES[cls] || TL.NAMES.warrior)[b] || [])[i] || '';

  // 点数
  TL.points = (a) => Math.floor(a.lv / 5) + Math.floor((G.sim.mastTotal ? G.sim.mastTotal(a) : 0) / 2);
  // 覚えた順の記録（職業ごと）。点数が足りなくなったら、新しいほうから休む
  function list(a) {
    a.tal = a.tal || {};
    if (!Array.isArray(a.tal[a.cls])) a.tal[a.cls] = [];
    return a.tal[a.cls];
  }
  TL.learned = (a) => list(a).slice();
  TL.active = (a) => list(a).slice(0, TL.points(a));
  TL.free = (a) => Math.max(0, TL.points(a) - list(a).length);
  TL.tier = (a, b) => { const act = TL.active(a); let n = 0; while (act.includes(b + ':' + n)) n++; return n; };
  TL.canLearn = (a, b, i) => {
    const l = list(a);
    if (l.includes(b + ':' + i)) return false;
    if (i > 0 && !l.includes(b + ':' + (i - 1))) return false;
    return TL.free(a) > 0;
  };
  TL.learn = function (a, b, i) {
    if (!TL.canLearn(a, b, i)) return false;
    list(a).push(b + ':' + i);
    G.state.stats.talents = (G.state.stats.talents || 0) + 1;
    G.emit('talent', a);
    return true;
  };
  TL.resetCost = (s = G.state) => Math.round((300 * Math.pow(1.55, Math.max(0, s.rank - 1))) / 10) * 10;
  TL.reset = function (a) {
    const c = TL.resetCost();
    if (!list(a).length) return { ok: false, why: 'none' };
    if (G.state.gold < c) return { ok: false, why: 'gold' };
    G.state.gold -= c;
    a.tal[a.cls] = [];
    return { ok: true, cost: c };
  };

  // 効果（装備の能力と同じ単位。pow は %）
  TL.advFx = function (a) {
    const out = {};
    TL.active(a).forEach((k) => {
      const [b, i] = k.split(':');
      const br = TL.BRANCH.find((x) => x.id === b);
      const fx = br && br.fx[+i];
      if (fx) Object.entries(fx).forEach(([kk, v]) => { out[kk] = (out[kk] || 0) + v; });
    });
    return out;
  };
  TL.partyFx = function (party) {
    const s = {};
    party.forEach((a) => Object.entries(TL.advFx(a)).forEach(([k, v]) => { if (k !== 'pow') s[k] = (s[k] || 0) + v; }));
    // 上限（パーティ全体）
    const cap = { succ: 15, great: 8, crit: 30, gold: 60, find: 60, mat: 40 };
    Object.keys(s).forEach((k) => { if (cap[k] != null) s[k] = Math.min(cap[k], s[k]); });
    return s;
  };

  // ---------------------------------------------------------------- 画面
  TL.open = function (a, replace) {
    const pts = TL.points(a), used = list(a).length, act = TL.active(a);
    const cols = TL.BRANCH.map((br, b) => {
      const nodes = br.fx.map((fx, i) => {
        const key = br.id + ':' + i;
        const got = list(a).includes(key);
        const on = act.includes(key);
        const can = TL.canLearn(a, br.id, i);
        return `<button class="tl-node ${on ? 'on' : got ? 'rest' : can ? 'can' : 'lock'}" data-tl="${br.id}:${i}" style="--c:${br.col}"><b>${G.esc(TL.nodeName(a.cls, b, i))}</b><small>${TL.fxText(fx)}</small>${got && !on ? '<em>休み中</em>' : ''}</button>`;
      }).join('<i class="tl-link"></i>');
      return `<div class="tl-col" style="--c:${br.col}"><h4>${br.name}</h4>${nodes}</div>`;
    }).join('');
    const fx = TL.advFx(a);
    const sum = Object.keys(fx).length ? TL.fxText(fx) : 'まだ何も覚えていません';
    const nextLv = (Math.floor(a.lv / 5) + 1) * 5;
    const html = `<div class="talent"><small>${D.CLASSES[a.cls].name}の才能の樹</small><h2>${G.esc(a.name)}</h2><div class="tl-pts"><span>才能の点 <b>${Math.max(0, pts - used)}</b> / ${pts}</span><small>Lv${nextLv}で +1・熟練の★2つごとに +1</small></div><div class="tl-tree">${cols}</div><p class="tl-sum">${sum}</p>${used > pts ? '<p class="hint">点数が足りないぶん、新しく覚えたものから休んでいます（レベルが上がると戻ります）</p>' : ''}</div>`;
    G.ui.modal(html, [
      used ? { text: `振り直す<span>${G.fmt(TL.resetCost())}G</span>`, cls: 'ghost', keep: true, fn: () => {
        const r = TL.reset(a);
        if (!r.ok) { G.audio.sfx('error'); G.ui.toast(r.why === 'gold' ? 'ゴールドが足りません' : '振り直すものがありません', 'bad'); return; }
        G.audio.sfx('shatter');
        G.ui.toast(`才能を振り直しました（${G.fmt(r.cost)}G）`, 'info');
        G.ui.refreshHud();
        G.sim.save();
        TL.open(a, true);
      } } : null,
      { text: '閉じる', cls: 'primary', fn: () => { if (G.treasury && G.treasury.advDetail) G.treasury.advDetail(a.id); } },
    ].filter(Boolean), {
      cls: 'wide tl-modal', replace: !!replace,
      onShow: (card) => {
        G.$$('[data-tl]', card).forEach((el) => el.addEventListener('click', () => {
          const [b, i] = el.dataset.tl.split(':');
          if (!TL.learn(a, b, +i)) {
            G.audio.sfx('error');
            G.ui.toast(list(a).includes(el.dataset.tl) ? 'もう覚えています' : TL.free(a) <= 0 ? `才能の点が足りません（Lv${nextLv}で +1）` : '上の段から順に覚えます', 'info');
            return;
          }
          G.audio.sfx('flash');
          G.haptic(14);
          const rc = el.getBoundingClientRect();
          if (G.ui.fx.burst) G.ui.fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2);
          G.ui.toast(`${a.name}は「${TL.nodeName(a.cls, TL.BRANCH.findIndex((x) => x.id === b), +i)}」を覚えた`, 'good');
          G.sim.save();
          TL.open(a, true);
        }));
      },
    });
  };
  TL.buttonHtml = (a) => { const f = TL.free(a); return `<button class="btn sm ghost tl-open" id="advTalent">才能の樹${f ? `<span class="tl-badge">${f}</span>` : ''}</button>`; };
})();
