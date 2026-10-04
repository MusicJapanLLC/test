/* ギルドの灯 — notify: お知らせ
 *  - 画面の上からすべり降りるバナー（タップでその画面へ）
 *  - お知らせ箱（HUD のベル）… 過去40件
 *  - 端末への通知 … 画面を離れている間にパーティが帰ってきたら（許可された環境のみ）
 *  - アプリ版のために、これから起きる出来事の一覧（upcoming）も出せる
 */
'use strict';
(function () {
  const N = (G.notify = {});
  const art = G.art;
  let queue = [];
  let cur = null, hideT = 0, quiet = true, prevFree = null, drag = null;
  const lastShown = {};

  N.init = function () {
    const bell = G.$('#bellBtn');
    bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-3.3 0-5.6 2.5-5.6 5.8v3.6L4.6 16h14.8l-1.8-3.6V8.8C17.6 5.5 15.3 3 12 3z" fill="currentColor"/><path d="M9.6 18.2a2.4 2.4 0 004.8 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg><i class="nb" hidden></i>';
    bell.addEventListener('click', () => {
      G.audio.init();
      G.haptic(6);
      if (G.ui.sheetTab() === 'inbox') G.ui.closeSheet();
      else G.ui.openSheet('inbox');
    });
    const el = G.$('#notice');
    el.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, dy: 0 }; });
    el.addEventListener('pointermove', (e) => { if (!drag) return; drag.dy = Math.min(0, e.clientY - drag.y); el.style.transform = `translateY(${drag.dy}px)`; });
    el.addEventListener('pointerup', () => {
      const d = drag;
      drag = null;
      el.style.transform = '';
      if (d && d.dy < -24) { hide(); return; }
      if (cur && cur.action) { const a = cur.action; hide(); act(a); }
      else hide();
    });
    G.on('started', () => { quiet = false; next(); });
    G.on('resolved', ({ reel, party }) => {
      const p = party[0];
      const n = G.reels.unseen().length;
      N.push({
        kind: 'return', key: 'return', action: 'reels',
        face: p ? art.portrait(p.look, 44) : null,
        title: p ? `${p.name}${party.length > 1 ? 'たち' : ''}が帰ってきた！` : 'パーティが帰ってきた！',
        body: n > 1 ? `冒険譚が ${n}本 届いています。結果は見てのお楽しみ` : '冒険譚が届きました。結果は見てのお楽しみ',
      });
      void reel;
    });
    G.on('built', (id) => N.push({ kind: 'built', key: 'built', action: 'build', icon: 'build', title: `${G.D.FAC[id].name}が完成しました！`, body: 'ギルドが少し大きくなりました' }));
    G.on('rankup', (r) => N.push({ kind: 'rank', action: null, icon: 'rank', silent: true, title: `ギルドランク ${r} に上がった！`, body: G.D.RANK_TITLES[r - 1] + ' ・ 魔晶石 +30' }));
    G.on('rareItem', (it) => N.push({ kind: 'item', action: 'treasury', icon: 'item', silent: true, title: `《${it.name}》を手に入れた`, body: `${G.items.RARITY[it.rarity].name}の${it.kind === 'relic' ? '秘宝' : '装備品'}` }));
    updateBadge();
  };

  let prevBoost = {};
  N.tick = function () {
    if (!G.items) return;
    ['speed', 'gold', 'luck', 'feast'].forEach((k) => {
      const on = !!G.items.boost(k);
      if (prevBoost[k] && !on) N.push({ kind: 'boost', key: 'boost' + k, action: k === 'feast' ? 'build' : 'treasury', icon: 'clock', title: `${G.items.BOOST_NAME[k]}が終わりました`, body: k === 'feast' ? '施設の画面から、また宴を開けます' : '持ち物からもう一度使えます' });
      prevBoost[k] = on;
    });
    const free = G.items.canFree();
    if (prevFree === false && free) N.push({ kind: 'chest', key: 'chest', action: 'treasury', icon: 'chest', title: '無料の宝箱が開けられます', body: '宝物庫で黄金の宝箱をひとつ、無料で開けられます' });
    prevFree = free;
  };

  // n: { kind, title, body, action, face, icon, key, silent }
  N.push = function (n) {
    const st = G.state;
    if (!st.inbox) st.inbox = [];
    const rec = { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), ts: G.now(), kind: n.kind, title: n.title, body: n.body, action: n.action || null, read: false };
    // 同じ種類が続いたら1件にまとめる
    const top = st.inbox[0];
    if (n.key && top && top.kind === n.kind && !top.read && G.now() - top.ts < 120) { top.title = rec.title; top.body = rec.body; top.ts = rec.ts; }
    else st.inbox.unshift(rec);
    if (st.inbox.length > 40) st.inbox.length = 40;
    updateBadge();
    if (document.hidden) { system(n); return; }
    if (n.silent) return;
    // 冒険譚を見ている最中は、帰還のバナーは出さない（ベルの数字だけ）
    if (n.kind === 'return' && G.reels.isOpen()) return;
    // 同じお知らせは45秒に1回まで（ベルの数字は増える）
    if (n.key && !(cur && cur.key === n.key) && Date.now() - (lastShown[n.key] || 0) < 45000) return;
    if (n.key) lastShown[n.key] = Date.now();
    if (cur && n.key && cur.key === n.key) { cur = n; fill(n); clearTimeout(hideT); hideT = setTimeout(hide, 4200); bump(); return; }
    const qi = n.key ? queue.findIndex((q) => q.key === n.key) : -1;
    if (qi >= 0) queue[qi] = n; else queue.push(n);
    next();
  };

  function next() {
    if (cur || quiet || !queue.length) return;
    if (G.ui.modalOpen && G.ui.modalOpen()) { setTimeout(next, 800); return; }
    cur = queue.shift();
    const el = G.$('#notice');
    fill(cur);
    el.hidden = false;
    el.classList.remove('out');
    requestAnimationFrame(() => el.classList.add('in'));
    G.audio.sfx(cur.kind === 'return' ? 'door' : 'claim');
    G.haptic(12);
    clearTimeout(hideT);
    hideT = setTimeout(hide, 4200);
  }
  function fill(n) {
    const el = G.$('#notice');
    const ico = n.face ? `<img alt="" src="${n.face}">` : `<span class="ni ${n.icon || ''}">${ICON[n.icon] || ICON.bell}</span>`;
    el.innerHTML = `${ico}<div><b>${G.esc(n.title)}</b><small>${G.esc(n.body || '')}</small></div>${n.action ? '<i class="go">›</i>' : ''}`;
  }
  function bump() {
    const el = G.$('#notice');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  function hide() {
    const el = G.$('#notice');
    clearTimeout(hideT);
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => { el.hidden = true; cur = null; next(); }, 260);
  }
  function act(a) {
    G.audio.sfx('tap');
    if (a === 'reels') { if (G.reels.isOpen()) return; G.ui.closeSheet(true); G.reels.open(); return; }
    if (G.reels.isOpen()) G.reels.close();
    setTimeout(() => G.ui.openSheet(a), G.reels.isOpen() ? 300 : 0);
  }
  N.act = act;

  function updateBadge() {
    const b = G.$('#bellBtn .nb');
    if (!b || !G.state) return;
    const n = (G.state.inbox || []).filter((x) => !x.read).length;
    b.hidden = !n;
    b.textContent = n > 9 ? '9+' : n;
  }

  // ---------------------------------------------------------------- 端末への通知
  function system(n) {
    const st = G.state;
    if (!st.settings.notify) return;
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const x = new Notification(n.title, { body: n.body || '', tag: n.kind, renotify: true });
      x.onclick = () => { try { window.focus(); } catch (e) { /* noop */ } if (n.action) act(n.action); x.close(); };
    } catch (e) { /* この環境では使えない */ }
  }
  N.supported = () => { try { return 'Notification' in window; } catch (e) { return false; } };
  N.permission = () => { try { return 'Notification' in window ? Notification.permission : 'unsupported'; } catch (e) { return 'unsupported'; } };
  N.request = async function () {
    if (!N.supported()) return 'unsupported';
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  };
  // これから起きること（アプリ版のローカル通知用）
  N.upcoming = function () {
    const st = G.state;
    const out = st.active.map((e) => ({ at: e.endAt, title: `${(st.adv.find((a) => a.id === e.party[0]) || {}).name || 'パーティ'}が帰ってきます`, body: e.q.name }));
    if (st.building) out.push({ at: st.building.endAt, title: `${G.D.FAC[st.building.id].name}が完成します`, body: '' });
    if (G.items && !G.items.canFree()) out.push({ at: (st.freeChestAt || 0) + G.items.FREE_INTERVAL, title: '無料の宝箱が開けられます', body: '' });
    return out.sort((a, b) => a.at - b.at);
  };

  // ---------------------------------------------------------------- お知らせ箱
  N.render = function (body) {
    const st = G.state;
    const list = st.inbox || [];
    let h = '';
    const perm = N.permission();
    if (perm !== 'granted' && perm !== 'unsupported' && st.settings.notify) {
      h += `<button class="card notif-ask" id="nAsk"><span class="ni">${ICON.bell}</span><div class="grow"><b>端末にも知らせる</b><small>画面を離れている間にパーティが帰ってきたら、端末の通知でお知らせします</small></div></button>`;
    }
    if (!list.length) h += '<p class="empty">お知らせはまだありません</p>';
    list.forEach((n) => {
      h += `<button class="card notif ${n.read ? '' : 'unread'}" data-nid="${n.id}"><span class="ni ${n.kind}">${ICON[KIND_ICON[n.kind]] || ICON.bell}</span><div class="grow"><b>${G.esc(n.title)}</b><small>${G.esc(n.body || '')}</small></div><span class="nt">${ago(n.ts)}</span></button>`;
    });
    body.innerHTML = `<div class="sec">${h}</div>`;
    list.forEach((n) => { n.read = true; });
    updateBadge();
    G.$$('[data-nid]', body).forEach((b) => b.addEventListener('click', () => {
      const n = list.find((x) => x.id === b.dataset.nid);
      if (n && n.action) { G.ui.closeSheet(true); act(n.action); }
    }));
    const ask = G.$('#nAsk', body);
    if (ask) ask.addEventListener('click', async () => {
      const r = await N.request();
      G.ui.toast(r === 'granted' ? '端末への通知をオンにしました' : r === 'unsupported' ? 'この環境では端末通知が使えません（アプリ版で対応します）' : '通知は許可されませんでした。ギルドの中ではこれまでどおりお知らせします', r === 'granted' ? 'good' : 'info');
      G.ui.renderSheet();
    });
  };
  N.sig = () => (G.state.inbox || []).length + ':' + ((G.state.inbox || [])[0] || {}).ts;
  function ago(ts) {
    const s = Math.max(0, G.now() - ts);
    if (s < 60) return 'たった今';
    if (s < 3600) return `${Math.floor(s / 60)}分前`;
    if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
    return `${Math.floor(s / 86400)}日前`;
  }

  const KIND_ICON = { return: 'door', built: 'build', rank: 'rank', item: 'item', chest: 'chest', daily: 'gift', boost: 'clock' };
  const ICON = {
    bell: '<svg viewBox="0 0 24 24"><path d="M12 3c-3.3 0-5.6 2.5-5.6 5.8v3.6L4.6 16h14.8l-1.8-3.6V8.8C17.6 5.5 15.3 3 12 3z" fill="currentColor"/></svg>',
    door: '<svg viewBox="0 0 24 24"><path d="M6 21V5l9-2v18z" fill="currentColor" opacity=".35"/><path d="M6 21V5l9-2v18M15 5h3v16M3 21h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12.5" cy="12.5" r="1.2" fill="currentColor"/></svg>',
    build: '<svg viewBox="0 0 24 24"><polygon points="3,11 12,3 21,11 21,21 3,21" fill="currentColor" opacity=".35"/><polygon points="3,11 12,3 21,11 21,21 3,21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    rank: '<svg viewBox="0 0 24 24"><polygon points="12,2 20,6.5 20,15.5 12,22 4,15.5 4,6.5" fill="currentColor"/></svg>',
    item: '<svg viewBox="0 0 24 24"><polygon points="15,2 21,2 21,8 10,19 5,14" fill="currentColor"/><polygon points="3,16 8,21 5,23 1,19" fill="currentColor"/></svg>',
    chest: '<svg viewBox="0 0 24 24"><path d="M3 11h18v10H3zM3.5 11c0-4.5 3.5-7 8.5-7s8.5 2.5 8.5 7" fill="currentColor" opacity=".35"/><path d="M3 11h18v10H3zM3.5 11c0-4.5 3.5-7 8.5-7s8.5 2.5 8.5 7" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="10" y="12" width="4" height="5" fill="currentColor"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" fill="currentColor" opacity=".35"/><path d="M3 9h18v12H3zM12 9v12M2 9h20M12 9C9 3 5 5 7 8M12 9c3-6 7-4 5-1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  };
})();
