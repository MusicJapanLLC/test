/* Optional Supabase cloud backup adapter. Legacy snapshots are never economy authority. */
(function (scope) {
  'use strict';
  const SAVE_KEY = 'lantern-journey-v09';
  const MAX_BYTES = 2 * 1024 * 1024;
  const ROOT_FIELDS = ['version','scene','next','selectedChapter','difficulty','resources','heroes','unlocked','party','decks','deck','gear','equipped','serial','clears','tonic','daily','story','run','settings','seen','journey','expansion','trials','rewards','pass'];
  const bytes = value => new TextEncoder().encode(value).length;
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  class CloudSaveError extends Error {
    constructor(code, message, details = {}) { super(message); this.name = 'CloudSaveError'; this.code = code; this.details = details; }
  }
  function inspect(value, depth = 0) {
    if (depth > 24) throw new CloudSaveError('invalid_save','記録の構造が深すぎます');
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (['__proto__','constructor','prototype'].includes(key)) throw new CloudSaveError('invalid_save','記録に無効な項目があります');
        inspect(value[key], depth + 1);
      }
    } else if (typeof value === 'number' && !Number.isFinite(value)) throw new CloudSaveError('invalid_save','記録に無効な数値があります');
  }
  function prepareSnapshot(raw, validate) {
    if (typeof raw !== 'string' || bytes(raw) > MAX_BYTES || typeof validate !== 'function') throw new CloudSaveError('invalid_save','記録を確認できません');
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new CloudSaveError('invalid_save','記録の形式が壊れています'); }
    inspect(parsed);
    if (!parsed || parsed.version !== 9 || parsed.journey?.crystals?.paid && parsed.journey.crystals.paid !== 0) throw new CloudSaveError('invalid_save','この記録は移行できません');
    const clean = Object.fromEntries(ROOT_FIELDS.filter(key => Object.hasOwn(parsed,key)).map(key => [key,parsed[key]]));
    let result;
    try { result = validate(clean); } catch { result = null; }
    if (!result || result.journey?.crystals?.paid && result.journey.crystals.paid !== 0) throw new CloudSaveError('invalid_save','記録の整合性を確認できません');
    return JSON.parse(JSON.stringify(Object.fromEntries(ROOT_FIELDS.filter(key => Object.hasOwn(result,key)).map(key => [key,result[key]]))));
  }
  function createAdapter({url,publishableKey,getAccessToken,validate,storage,fetchImpl = scope.fetch,saveKey = SAVE_KEY}) {
    let origin;
    try { origin = new URL(url); } catch { throw new CloudSaveError('unconfigured','クラウド保存は未接続です'); }
    if (origin.protocol !== 'https:' || !/\.supabase\.co$/.test(origin.hostname) || origin.username || origin.password || typeof publishableKey !== 'string' || !publishableKey.startsWith('sb_publishable_')) throw new CloudSaveError('unconfigured','クラウド保存の接続先を確認できません');
    const base = origin.origin;
    async function request(path,body) {
      const token = await getAccessToken();
      if (!token) throw new CloudSaveError('signed_out','クラウド保存にはログインしてください');
      let response;
      try { response = await fetchImpl(base + '/rest/v1/' + path, {method:body?'POST':'GET',headers:{apikey:publishableKey,Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'}); }
      catch { throw new CloudSaveError('offline','通信できません 端末の記録は保持されています'); }
      let data; try { data = await response.json(); } catch { throw new CloudSaveError('unavailable','クラウドの応答を確認できません'); }
      if (!response.ok) {
        const conflict = data?.message?.includes('revision_conflict');
        throw new CloudSaveError(conflict?'conflict':response.status===401?'signed_out':'unavailable',conflict?'別の端末で記録が進んでいます 記録を比較してください':'クラウド保存を完了できません');
      }
      return data;
    }
    function backupLocal(label = 'before-cloud') {
      const raw = storage.getItem(saveKey);
      if (raw === null) return null;
      prepareSnapshot(raw,validate);
      const key = saveKey + '-' + label;
      try {
        // The first migration backup is immutable. Later restore backups have unique labels.
        if (storage.getItem(key) === null) storage.setItem(key,raw);
        if (storage.getItem(key) === null) throw Error('backup failed');
      } catch { throw new CloudSaveError('backup_failed','端末の退避保存ができません 移行は行っていません'); }
      return key;
    }
    async function load() {
      const rows = await request('lantern_cloud_saves?select=revision,snapshot,updated_at,checksum,trust');
      if (!Array.isArray(rows) || rows.length > 1) throw new CloudSaveError('invalid_remote','クラウド記録を確認できません');
      if (!rows.length) return null;
      const row = rows[0];
      if (!Number.isSafeInteger(row.revision) || row.revision < 1 || row.trust !== 'legacy_unverified') throw new CloudSaveError('invalid_remote','クラウド記録の版を確認できません');
      return {...row,snapshot:prepareSnapshot(JSON.stringify(row.snapshot),validate)};
    }
    async function upload({rawSave,expectedRevision,requestId,deviceId}) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !uuid(requestId) || !uuid(deviceId)) throw new CloudSaveError('invalid_request','保存の版番号を確認できません');
      const snapshot = prepareSnapshot(rawSave,validate);
      backupLocal();
      const data = await request('rpc/lantern_save_cloud',{p_snapshot:snapshot,p_expected_revision:expectedRevision,p_request_id:requestId,p_device_id:deviceId});
      if (!data || !Number.isSafeInteger(data.revision) || data.revision < 1 || data.current_revision !== data.revision) throw new CloudSaveError('conflict','別の端末で記録が進んでいます 記録を比較してください');
      return data;
    }
    async function restore({confirmedRevision,backupId}) {
      if (!uuid(backupId)) throw new CloudSaveError('invalid_request','退避先を確認できません');
      const localBefore = storage.getItem(saveKey);
      const remote = await load();
      if (!remote || remote.revision !== confirmedRevision) throw new CloudSaveError('conflict','クラウドの記録が更新されました もう一度比較してください');
      if (storage.getItem(saveKey) !== localBefore) throw new CloudSaveError('conflict','端末の冒険が進みました もう一度記録を比較してください');
      const backupKey = backupLocal('before-restore-' + backupId);
      // This method is called only after the comparison UI confirms a specific revision.
      try { storage.setItem(saveKey,JSON.stringify(remote.snapshot)); }
      catch { throw new CloudSaveError('local_write_failed','復元できません 退避した記録は保持されています'); }
      return {snapshot:remote.snapshot,revision:remote.revision,backupKey};
    }
    return Object.freeze({load,upload,restore,backupLocal});
  }
  const api = Object.freeze({SAVE_KEY,MAX_BYTES,CloudSaveError,prepareSnapshot,createAdapter});
  scope.LanternCloudSave = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
