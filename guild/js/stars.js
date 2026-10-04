/* ギルドの灯 — stars: 灯火の星（星座の強化）と、ギルドの再建
 *  星座の画面：上に夜空と星座、タップした星の説明と「灯す」、下に「ギルドの再建」
 */
'use strict';
(function () {
  const SR = (G.stars = {});
  const S = G.sim, D = G.D, art = G.art;
  let sel = 'pow';

  const STAR_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><polygon points="10,1 12.4,7.2 19,7.6 13.9,11.8 15.6,18.4 10,14.8 4.4,18.4 6.1,11.8 1,7.6 7.6,7.2" fill="currentColor"/></svg>';
  SR.STAR_SVG = STAR_SVG;

  SR.sig = () => { const pr = S.prestige(); return [pr.stars, pr.runs, JSON.stringify(pr.tree), sel, G.state.rank, G.state.fame].join('|'); };
  SR.open = () => { G.audio.init(); G.ui.openSheet('stars'); };

  // 夜空（星くず・星雲・線）を1枚の絵に
  function skyImage(w, h) {
    const st = G.state;
    const key = 'starsky:' + w + 'x' + h + ':' + JSON.stringify(S.prestige().tree);
    return art.url(art.cached(key, w, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#060a1e');
      g.addColorStop(1, '#141a3e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 星雲
      [[0.3, 0.35, '#5a3a9a'], [0.72, 0.62, '#2a5a9a'], [0.5, 0.9, '#7a3a6a']].forEach(([x, y, c]) => {
        const rg = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, w * 0.5);
        rg.addColorStop(0, G.rgba(c, 0.35));
        rg.addColorStop(1, G.rgba(c, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      });
      for (let i = 0; i < 160; i++) {
        const x = G.hash(i * 7.1) * w, y = G.hash(i * 3.3 + 1) * h;
        ctx.fillStyle = `rgba(255,250,230,${0.15 + G.hash(i) * 0.55})`;
        const r = G.hash(i * 11) < 0.1 ? 1.4 : 0.7;
        ctx.fillRect(x, y, r, r);
      }
      // 星座の線
      const P = (n) => [n.x / 100 * w, n.y / 118 * h];
      const C = [w * 0.5, h * 0.48];
      const lines = [];
      S.STAR_NODES.forEach((n) => {
        const from = n.from ? S.STAR_NODE[n.from] : null;
        lines.push([from ? P(from) : C, P(n), S.starLv(n.id) > 0 && (!from || S.starLv(from.id) > 0)]);
      });
      lines.forEach(([a, b, on]) => {
        ctx.strokeStyle = on ? 'rgba(255,214,120,0.85)' : 'rgba(160,180,255,0.22)';
        ctx.lineWidth = on ? 1.6 : 1;
        ctx.setLineDash(on ? [] : [3, 4]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        if (on) {
          ctx.strokeStyle = 'rgba(255,214,120,0.18)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      });
      ctx.setLineDash([]);
      // 中心の灯火
      const rg = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], 46);
      rg.addColorStop(0, 'rgba(255,220,140,0.9)');
      rg.addColorStop(0.3, 'rgba(255,170,80,0.35)');
      rg.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(C[0], C[1], 46, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(C[0], C[1] + 4);
      ctx.scale(1.25, 1.25);
      art.poly(ctx, [-6, 10, 6, 10, 5, -2, -5, -2], '#7a4f2a');
      art.poly(ctx, [-5, -2, 5, -2, 4, -12, -4, -12], 'rgba(255,240,200,0.55)');
      art.poly(ctx, [-2.4, -4, 2.4, -4, 0, -13], '#ffcf5a');
      art.poly(ctx, [-1.2, -4, 1.2, -4, 0, -9], '#fff4c0');
      art.poly(ctx, [-7, -12, 7, -12, 0, -17], '#3a2a20');
      ctx.restore();
    }, h));
  }

  SR.render = function (body) {
    const st = G.state;
    const pr = S.prestige();
    const rb = S.rebirthStars();
    const can = S.canRebirth();
    const n = S.STAR_NODE[sel] || S.STAR_NODES[0];
    const lv = S.starLv(n.id);
    const maxed = lv >= n.max;
    const open = S.starOpen(n.id);
    const cost = maxed ? 0 : S.starCost(n.id);
    const W = Math.min(window.innerWidth, 640) - 28, H = Math.round(W * 1.18);
    const nodes = S.STAR_NODES.map((x) => {
      const l = S.starLv(x.id);
      const cls = [l >= x.max ? 'max' : l > 0 ? 'on' : '', S.starOpen(x.id) ? '' : 'locked', x.unlock ? 'unl' : '', x.id === sel ? 'sel' : '', !S.starOpen(x.id) || l >= x.max || pr.stars < S.starCost(x.id) ? '' : 'can'].join(' ');
      return `<button class="sn ${cls}" data-star="${x.id}" style="left:${x.x}%;top:${(x.y / 118) * 100}%" aria-label="${G.esc(x.name)}">${STAR_SVG}<i>${x.short}<em>${x.max > 1 ? `${l}/${x.max}` : l ? '開放' : ''}</em></i></button>`;
    }).join('');
    let h = `<div class="stars-top"><span class="st-have">${STAR_SVG}<b>${G.fmt(pr.stars)}</b><small>灯火の星</small></span><span class="st-runs">再建 <b>${pr.runs}</b>回 ・ これまでに <b>${G.fmt(pr.total)}</b>個</span></div>
      <div class="sky" style="background-image:url(${skyImage(W, H)});aspect-ratio:100/118">${nodes}</div>
      <div class="card sn-detail ${maxed ? 'max' : ''}"><div class="grow"><b>${G.esc(n.name)}${n.max > 1 ? ` <small>Lv${lv}/${n.max}</small>` : ''}</b>
        <small>${lv ? `いま：${n.desc(lv)}` : 'まだ灯していません'}</small>
        ${maxed ? '' : `<small class="nx">次：${n.desc(lv + 1)}</small>`}
        ${open ? '' : `<small class="lock">先に「${S.STAR_NODE[n.from].name}」を灯してください</small>`}</div>
        ${maxed ? '<span class="stamp">最大</span>' : `<button class="btn sm ${open && pr.stars >= cost ? 'primary' : 'cant'}" id="starBuy">${STAR_SVG}<span>${cost}</span></button>`}</div>`;
    // 再建
    const beds = D.beds(Math.max(1, S.starLv('start') >= 2 ? 2 : 1));
    h += `<div class="sec rebirth"><h3>ギルドの再建</h3><div class="card rb ${can ? 'ready' : ''}">
      <div class="rb-head"><div class="rb-earn"><small>いま再建すると</small><b>${STAR_SVG}+${rb.total}</b></div>
        <ul class="rb-break"><li><span>名声 ${G.fmt(st.fame)}</span><b>+${rb.fame}</b></li><li><span>竜王の討伐</span><b>+${rb.boss}</b></li><li><span>深淵 新記録</span><b>+${rb.abyss}</b></li></ul></div>
      <div class="rb-keep"><div><b>残るもの</b><small>装備・秘宝・魔晶石・持ち物・技・深淵の記録・灯火の星・図鑑</small></div><div><b>最初からになるもの</b><small>ゴールド・素材・名声とランク・施設・冒険者のレベル（上位${beds}人はそのまま、ほかは「かつての仲間」として無料で呼び戻せる）</small></div></div>
      <button class="btn ${can ? 'danger big' : 'cant'} wide" id="rebirthBtn">${can ? 'ギルドを再建する' : `ランク${S.REBIRTH_RANK}から再建できます（いまランク${st.rank}）`}</button></div>
      <p class="hint">灯火の星を灯すと、再建したあとも、ずっと強いままです。新しい職業や土地も、ここで開きます。</p></div>`;
    body.innerHTML = h;
    G.$$('[data-star]', body).forEach((b) => b.addEventListener('click', () => { sel = b.dataset.star; G.audio.sfx('tap'); G.ui.renderSheet(); }));
    const bb = G.$('#starBuy', body);
    if (bb) bb.addEventListener('click', () => buy(n.id));
    G.$('#rebirthBtn', body).addEventListener('click', () => { if (can) confirmRebirth(); else { G.audio.sfx('error'); G.ui.toast(`ランク${S.REBIRTH_RANK}になると、ギルドを再建できます`, 'info'); } });
  };

  function buy(id) {
    const r = S.buyStar(id);
    if (!r.ok) {
      G.audio.sfx('error');
      G.ui.toast(r.why === 'stars' ? '灯火の星が足りません。ギルドを再建すると手に入ります' : r.why === 'locked' ? '先に、つながっている星を灯してください' : 'これ以上は灯せません', 'bad');
      return;
    }
    const n = S.STAR_NODE[id];
    G.audio.sfx('rarity', n.unlock ? 4 : 2);
    G.haptic(18);
    const el = G.$(`[data-star="${id}"]`);
    if (el) { const rc = el.getBoundingClientRect(); G.ui.fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2); }
    G.ui.toast(n.unlock ? `${n.name}が開いた！` : `${n.name} Lv${r.lv}：${n.desc(r.lv)}`, n.unlock ? 'rare4' : 'rare3');
    if (n.unlock) G.ui.fx.confetti();
    G.sim.save();
    G.ui.refreshHud();
    G.ui.renderSheet();
  }

  function confirmRebirth() {
    const st = G.state;
    const rb = S.rebirthStars();
    const away = st.active.length, unseen = G.reels.unseen().length;
    G.audio.sfx('open');
    G.ui.modal(`<div class="confirm rb-confirm"><h2>ギルドを再建しますか？</h2><p>灯火の星 <b>+${rb.total}</b> を手に、ギルドを一から建て直します。</p>${away ? `<p class="warn">遠征中の ${away} 組は、結果なしで帰ってきます。</p>` : ''}${unseen ? `<p class="warn">まだ見ていない冒険譚 ${unseen} 本は、見届けボーナスなしで受け取ります。</p>` : ''}<p class="hint">取り消せません。</p></div>`, [
      { text: 'やめる', cls: 'ghost' },
      { text: '再建する', cls: 'danger', fn: () => setTimeout(doRebirth, 200) },
    ]);
  }
  function doRebirth() {
    const ov = document.createElement('div');
    ov.id = 'rebirthFx';
    ov.innerHTML = '<div class="rf-flame"></div><p>ギルドの再建</p><small>新しい灯りを、ともそう</small>';
    document.body.appendChild(ov);
    G.audio.sfx('rankup');
    G.audio.sfx('flash');
    G.haptic(40);
    requestAnimationFrame(() => ov.classList.add('on'));
    setTimeout(() => {
      G.ui.closeSheet(true);
      S.rebirth();
      G.sim.save(true);
      setTimeout(() => location.reload(), 900);
    }, 1600);
  }

  // 再建のあと、最初に開いたときのお祝い
  SR.afterBoot = function () {
    const st = G.state;
    if (!st.flags.justReborn && st.flags.justReborn !== 0) return;
    const n = st.flags.justReborn;
    delete st.flags.justReborn;
    G.sim.save();
    G.ui.whenFree(() => G.ui.modal(`<div class="skill-get rb-done"><div class="rf-flame small"></div><small>再建 ${S.prestige().runs}回目</small><h2>新しいギルドの始まり</h2><p>灯火の星 <b>+${n}</b> を手に入れました。<br>ランクの紋章から「灯火の星」を開いて、星座を灯しましょう。</p>${(st.alumni || []).length ? `<p class="hint">かつての仲間 ${st.alumni.length}人は、冒険者の画面からいつでも呼び戻せます</p>` : ''}</div>`, [{ text: '星座を見る', cls: 'primary big', fn: () => SR.open() }], { cls: 'celebrate', onShow: () => G.ui.fx.confetti() }), 900);
  };
})();
