/* ギルドの灯 — save: 消えないセーブ
 *  3か所に同時に書き、起動時はいちばん新しいものを読む。
 *   1) この端末のブラウザ（localStorage）… すぐ書ける。数秒ごと＋操作のたび
 *   2) IndexedDB … localStorage が使えない環境の予備
 *   3) claude.ai のアーティファクト保存（db・あなた専用の場所）… 読み込み直しても、別の端末でも残る
 *  どれか1つでも残っていれば続きから遊べる。
 */
'use strict';
(function () {
  const SV = (G.save = {});
  const KEY = 'guild-akari-save-v1';
  const CHUNK = 60000; // クラウドは1文書 256KiB まで。日本語を含んでも収まる長さで分ける
  let idb = null;
  let cloud = null; // { col }
  let lastCloudJson = '', lastCloudAt = 0, cloudBusy = false, cloudPending = null;
  SV.status = { local: false, idb: false, cloud: false, lastAt: 0, source: 'new' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const race = (p, ms) => Promise.race([p, sleep(ms).then(() => null)]);

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
  async function cloudInit() {
    if (!window.claude || typeof window.claude.use !== 'function') return null;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return null;
      const uid = await user.id();
      if (!uid) return null;
      return { col: db.collection('data/users/' + uid) };
    } catch (e) { return null; }
  }
  async function cloudGet() {
    try {
      const meta = await cloud.col.doc('save').get();
      if (!meta.exists) return null;
      const m = meta.data() || {};
      if (m.reset) return null;
      if (!m.n) return typeof m.json === 'string' ? m.json : null;
      const parts = await Promise.all(Array.from({ length: m.n }, (_, i) => cloud.col.doc('save' + i).get()));
      if (parts.some((p) => !p.exists)) return null;
      const s = parts.map((p) => p.data().part).join('');
      return s.length === m.len ? s : null;
    } catch (e) { return null; }
  }
  async function cloudSet(json) {
    if (json.length <= CHUNK) {
      await cloud.col.doc('save').set({ json, n: 0, ts: Date.now(), v: 1 });
      return;
    }
    const n = Math.ceil(json.length / CHUNK);
    for (let i = 0; i < n; i++) await cloud.col.doc('save' + i).set({ part: json.slice(i * CHUNK, (i + 1) * CHUNK) });
    await cloud.col.doc('save').set({ n, len: json.length, ts: Date.now(), v: 1 });
  }
  async function flushCloud() {
    if (!cloud || cloudBusy || !cloudPending) return;
    const json = cloudPending;
    cloudPending = null;
    if (json === lastCloudJson) return;
    cloudBusy = true;
    try {
      await cloudSet(json);
      lastCloudJson = json;
      lastCloudAt = Date.now();
      SV.status.cloud = true;
    } catch (e) {
      SV.status.cloud = false;
      // 混み合っているときは次の機会にまとめて
      if (!cloudPending) cloudPending = json;
    }
    cloudBusy = false;
  }

  // ---------------------------------------------------------------- 読み込み
  const stamp = (j) => {
    if (!j) return -1;
    try { const s = JSON.parse(j); return s && s.v === 1 ? s.lastSeen || 0 : -1; } catch (e) { return -1; }
  };
  // 3か所を読んで、いちばん新しいセーブ（JSON 文字列）を返す。なければ null
  SV.init = async function () {
    const local = lsGet();
    idb = await race(idbOpen(), 1500);
    const fromIdb = idb ? await race(idbGet(), 1500) : null;
    cloud = await race(cloudInit(), 3500);
    const fromCloud = cloud ? await race(cloudGet(), 3500) : null;
    const all = [['local', local], ['idb', fromIdb], ['cloud', fromCloud]].map(([k, j]) => ({ k, j, t: stamp(j) })).filter((x) => x.t >= 0);
    all.sort((a, b) => b.t - a.t);
    SV.status.cloud = !!cloud;
    if (fromCloud) lastCloudJson = fromCloud;
    if (!all.length) return null;
    SV.status.source = all[0].k;
    return all[0].j;
  };

  // ---------------------------------------------------------------- 書き込み
  // local と IndexedDB は毎回。クラウドは変わったときだけ、12秒に1回まで（force で即時）
  SV.write = function (json, force) {
    lsSet(json);
    if (idb) idbSet(json);
    SV.status.lastAt = Date.now();
    if (!cloud) return;
    cloudPending = json;
    if (force || Date.now() - lastCloudAt > 12000) flushCloud();
  };
  SV.flush = () => flushCloud();
  setInterval(() => { if (cloudPending && Date.now() - lastCloudAt > 12000) flushCloud(); }, 4000);

  SV.clear = async function () {
    lsDel();
    if (idb) idbDel();
    if (cloud) {
      try { await cloud.col.doc('save').set({ reset: true, ts: Date.now(), v: 1 }); } catch (e) { /* noop */ }
    }
  };
  SV.where = function () {
    const s = SV.status;
    if (s.cloud) return 'クラウド（あなた専用）とこの端末';
    if (s.local || s.idb) return 'この端末のブラウザ';
    return '保存できない環境です（閉じると消えます）';
  };
})();
