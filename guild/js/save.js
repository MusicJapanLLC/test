/* ギルドの灯 — save: 消えないセーブ
 *  3か所に書き、起動時はいちばん新しいものを読む。
 *   1) この端末のブラウザ（localStorage）… すぐ書ける。数秒ごと＋操作のたび
 *   2) IndexedDB … localStorage が使えない環境の予備
 *   3) claude.ai のアーティファクト保存（db・あなた専用の場所）… 読み込み直しても、別の端末でも残る
 *  守っていること
 *   - クラウドは圧縮して（gzip → base64）1つの文書に。大きいときだけ分ける。書く回数を減らして、混雑で落ちないように
 *   - クラウドを「読めた」ことを確かめるまで、クラウドには書かない（古い・新規のデータで上書きしない）
 *   - 起動時にクラウドが間に合わなくても、あとから読めたら「新しいセーブがあります」と知らせる
 *   - 手動セーブと、セーブデータの書き出し・読み込み（コピー＆貼り付け）
 */
'use strict';
(function () {
  const SV = (G.save = {});
  const KEY = 'guild-akari-save-v1';
  const CHUNK = 180000; // 1文書 256KiB まで。base64（ASCII）なのでこの長さで収まる
  let idb = null;
  let cloud = null; // { col }
  let cloudReady = false; // クラウドの中身を確かめたか（確かめるまで書かない）
  let lastCloudJson = '', lastCloudAt = 0, cloudBusy = false, cloudPending = null, cloudFails = 0;
  SV.status = { local: false, idb: false, cloud: false, cloudReady: false, lastAt: 0, cloudAt: 0, source: 'new', err: '' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const race = (p, ms) => Promise.race([p, sleep(ms).then(() => undefined)]);

  // ---------------------------------------------------------------- 圧縮（gzip + base64）
  const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function streamBytes(stream) {
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }
  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function zip(json) {
    if (!canZip) return null;
    const bytes = new TextEncoder().encode(json);
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return b64(await streamBytes(cs));
  }
  async function unzip(str) {
    const ds = new Blob([unb64(str)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new TextDecoder().decode(await streamBytes(ds));
  }
  SV.zip = zip;
  SV.unzip = unzip;

  // ---------------------------------------------------------------- 1) localStorage
  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(j) {
    try { localStorage.setItem(KEY, j); SV.status.local = true; return true; } catch (e) { SV.status.local = false; return false; }
  }
  function lsDel() { try { localStorage.removeItem(KEY); } catch (e) { /* noop */ } }

  // ---------------------------------------------------------------- 2) IndexedDB
  function idbOpen() {
    return new Promise((res) => {
      try {
        const r = indexedDB.open('guild-akari', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
  }
  function idbGet() {
    return new Promise((res) => {
      try {
        const q = idb.transaction('kv', 'readonly').objectStore('kv').get(KEY);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  function idbSet(j) {
    try { idb.transaction('kv', 'readwrite').objectStore('kv').put(j, KEY); SV.status.idb = true; } catch (e) { SV.status.idb = false; }
  }
  function idbDel() { try { idb.transaction('kv', 'readwrite').objectStore('kv').delete(KEY); } catch (e) { /* noop */ } }

  // ---------------------------------------------------------------- 3) アーティファクトの保存（db）
  let cloudInitP = null;
  function cloudInit() {
    if (cloudInitP) return cloudInitP;
    cloudInitP = (async () => {
      if (!window.claude || typeof window.claude.use !== 'function') return null;
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) return null;
        const uid = await user.id();
        if (!uid) return null;
        return { col: db.collection('data/users/' + uid) };
      } catch (e) { return null; }
    })();
    return cloudInitP;
  }
  // 戻り値：文字列＝セーブ / null＝クラウドにセーブなし / 例外＝読めなかった
  async function cloudGet() {
    const meta = await cloud.col.doc('save').get();
    if (!meta.exists) return null;
    const m = meta.data() || {};
    if (m.reset) return null;
    let body = '';
    if (m.n) {
      const parts = await Promise.all(Array.from({ length: m.n }, (_, i) => cloud.col.doc((m.slot || 'save') + i).get()));
      if (parts.some((p) => !p.exists)) throw new Error('missing part');
      body = parts.map((p) => p.data().part).join('');
      if (body.length !== m.len) throw new Error('length mismatch');
    } else body = m.z ? m.data : m.json;
    if (typeof body !== 'string') return null;
    return m.z === 'gz64' ? unzip(body) : body;
  }
  async function cloudSet(json) {
    const z = await zip(json).catch(() => null);
    const body = z || json;
    const kind = z ? 'gz64' : '';
    const ts = Date.now();
    if (body.length <= CHUNK) {
      const doc = { z: kind, n: 0, ts, v: 2 };
      if (z) doc.data = body; else doc.json = body;
      await cloud.col.doc('save').set(doc);
      return;
    }
    // 大きいときは、使っていない側の枠（A/B）に書いてから目次を切り替える（途中で失敗しても前のセーブが残る）
    const cur = await cloud.col.doc('save').get().catch(() => null);
    const prev = cur && cur.exists ? (cur.data() || {}).slot : null;
    const slot = prev === 'saveA' ? 'saveB' : 'saveA';
    const n = Math.ceil(body.length / CHUNK);
    for (let i = 0; i < n; i++) await cloud.col.doc(slot + i).set({ part: body.slice(i * CHUNK, (i + 1) * CHUNK) });
    await cloud.col.doc('save').set({ z: kind, n, len: body.length, slot, ts, v: 2 });
  }
  let forceAfter = false;
  async function flushCloud(force) {
    if (force && cloudBusy) forceAfter = true;
    if (!cloud || !cloudReady || cloudBusy || !cloudPending) return false;
    const json = cloudPending;
    cloudPending = null;
    if (json === lastCloudJson) return true;
    cloudBusy = true;
    let ok = false;
    try {
      await cloudSet(json);
      lastCloudJson = json;
      lastCloudAt = Date.now();
      SV.status.cloud = true;
      SV.status.cloudAt = lastCloudAt;
      SV.status.err = '';
      cloudFails = 0;
      ok = true;
    } catch (e) {
      SV.status.cloud = false;
      SV.status.err = (e && (e.code || e.message)) || 'error';
      cloudFails++;
      // 混み合っているときは、少し待ってからまとめて
      if (!cloudPending) cloudPending = json;
      lastCloudAt = Date.now() - 8000 + [3000, 6000, 10000, 15000, 25000][Math.min(4, cloudFails - 1)];
    }
    cloudBusy = false;
    // 書いている間に「すぐ保存」が来ていたら、続けてもう一度
    if (ok && forceAfter && cloudPending) { forceAfter = false; return flushCloud(); }
    return ok;
  }

  // ---------------------------------------------------------------- 読み込み
  const stamp = (j) => {
    if (!j) return -1;
    try { const s = JSON.parse(j); return s && s.v === 1 ? s.lastSeen || 0 : -1; } catch (e) { return -1; }
  };
  SV.stamp = stamp;
  let bootStamp = -1;
  // 3か所を読んで、いちばん新しいセーブ（JSON 文字列）を返す。なければ null
  // 再読み込みをまたいでセーブを渡す（ストレージが使えない環境でも、同じタブなら window.name は残る）
  const HAND = 'GA-HANDOFF:';
  function takeHandoff() {
    try {
      if (typeof window.name === 'string' && window.name.startsWith(HAND)) { const j = window.name.slice(HAND.length); window.name = ''; return j; }
    } catch (e) { /* noop */ }
    return null;
  }
  SV.handoff = (json) => { try { window.name = HAND + json; } catch (e) { /* noop */ } };
  SV.init = async function (onProgress) {
    const hand = takeHandoff();
    const local = lsGet();
    idb = await race(idbOpen(), 1500) || null;
    const fromIdb = idb ? await race(idbGet(), 1500) : null;
    if (onProgress) onProgress('cloud');
    cloud = (await race(cloudInit(), 9000)) || null;
    let fromCloud = null;
    if (cloud) {
      // 読めるまで少し粘る（ここで諦めて新しいデータで上書きしないように）
      for (let i = 0; i < 2 && !cloudReady; i++) {
        try {
          const r = await race(cloudGet(), 9000);
          if (r === undefined) throw new Error('timeout');
          fromCloud = r;
          cloudReady = true;
        } catch (e) { SV.status.err = 'read: ' + ((e && e.message) || e); await sleep(600); }
      }
    }
    SV.status.cloudReady = cloudReady;
    const all = [['handoff', hand], ['local', local], ['idb', fromIdb], ['cloud', fromCloud]].map(([k, j]) => ({ k, j, t: stamp(j) })).filter((x) => x.t >= 0);
    all.sort((a, b) => b.t - a.t);
    SV.status.cloud = !!cloud && cloudReady;
    if (fromCloud) lastCloudJson = fromCloud;
    const mayCloud = !cloudReady && window.claude && typeof window.claude.use === 'function';
    if (!all.length) { bootStamp = 0; if (mayCloud) retryCloudLater(); return null; }
    SV.status.source = all[0].k;
    bootStamp = all[0].t;
    if (mayCloud) retryCloudLater();
    return all[0].j;
  };
  // 起動時にクラウドを読めなかったら、あとで読み直す。新しいセーブがあれば知らせる
  function retryCloudLater() {
    let tries = 0;
    const tick = async () => {
      if (cloudReady || tries++ > 20) return;
      try {
        if (!cloud) cloud = await race(cloudInit(), 9000) || null;
        if (!cloud) { if (cloudInitP && (await race(cloudInitP, 10)) === null) return; setTimeout(tick, 15000); return; }
        const r = await race(cloudGet(), 12000);
        if (r === undefined) throw new Error('timeout');
        cloudReady = true;
        SV.status.cloudReady = true;
        SV.status.cloud = true;
        if (r) lastCloudJson = r;
        const t = stamp(r);
        // 起動時に使ったセーブより新しければ、どちらで続けるか聞く
        if (r && t > bootStamp && SV.onNewer) SV.onNewer(r);
        else if (cloudPending) flushCloud();
      } catch (e) { setTimeout(tick, 15000); }
    };
    setTimeout(tick, 4000);
  }

  // ---------------------------------------------------------------- 書き込み
  // local と IndexedDB は毎回。クラウドは変わったときだけ、8秒に1回まで（force で即時）
  SV.write = function (json, force) {
    lsSet(json);
    if (idb) idbSet(json);
    SV.status.lastAt = Date.now();
    if (!cloud) return;
    cloudPending = json;
    if (force || Date.now() - lastCloudAt > 8000) flushCloud(force);
  };
  SV.flush = () => flushCloud();
  // 手動セーブ：いますぐ全部に書いて、結果を返す
  SV.saveNow = async function (json) {
    lsSet(json);
    if (idb) idbSet(json);
    SV.status.lastAt = Date.now();
    let cloudOk = null;
    if (cloud && cloudReady) {
      cloudPending = json;
      for (let i = 0; i < 20 && cloudBusy; i++) await sleep(150);
      cloudOk = await flushCloud();
    } else if (cloud) cloudOk = false;
    return { local: SV.status.local, idb: SV.status.idb, cloud: cloudOk };
  };
  // 新しいセーブで始め直す（書き出したデータの読み込み・クラウドの新しいセーブ）
  SV.replace = async function (json) {
    SV.handoff(json);
    lsSet(json);
    if (idb) idbSet(json);
    if (cloud && cloudReady) { cloudPending = json; lastCloudJson = ''; for (let i = 0; i < 20 && cloudBusy; i++) await sleep(150); await flushCloud(); }
  };
  setInterval(() => { if (cloudPending && Date.now() - lastCloudAt > 8000) flushCloud(); }, 2000);

  SV.clear = async function () {
    lsDel();
    if (idb) idbDel();
    if (cloud && cloudReady) {
      try { await cloud.col.doc('save').set({ reset: true, ts: Date.now(), v: 2 }); } catch (e) { /* noop */ }
    }
  };
  SV.where = function () {
    const s = SV.status;
    if (s.cloud) return 'クラウド（あなた専用）とこの端末';
    if (s.local || s.idb) return 'この端末のブラウザ';
    return '保存できない環境です（書き出しで控えを残せます）';
  };
})();
