/*
 * Music Japan Integration OS - Apps Script automation
 *
 * Design goals:
 * - Spreadsheet remains the human-readable control plane.
 * - 21_EVENT_LOG is append-only history.
 * - 22_ID_REGISTRY provides deterministic internal IDs.
 * - 24_SIGNAL_INBOX receives Gmail/business signals before any CRM mutation.
 * - External partner sheets remain source-of-truth for partner billing.
 * - Re-runs are idempotent and guarded with LockService.
 *
 * Deploy as a standalone or bound Apps Script project.
 */

const MJ = Object.freeze({
  SPREADSHEET_ID: '1MHwYyUUWaRfgAtubH8vyCoRJoV6rreHJ98a3IM5Hxew',
  TZ: 'Asia/Tokyo',
  SHEETS: Object.freeze({
    CONFIG: '10_CONFIG',
    REFERRALS: '13_REFERRAL_DB',
    ENTITY_MASTER: '17_ENTITY_MASTER',
    EVENT_LOG: '21_EVENT_LOG',
    ID_REGISTRY: '22_ID_REGISTRY',
    SOURCE_REGISTRY: '23_SOURCE_REGISTRY',
    SIGNAL_INBOX: '24_SIGNAL_INBOX'
  }),
  GMAIL_QUERY: 'newer_than:14d {from:notifications@timerex.net subject:Baton subject:請求 subject:商談 subject:紹介}',
  MAX_GMAIL_THREADS: 100,
  API_TOKEN_PROPERTY: 'MJ_API_TOKEN',
  SCRIPT_VERSION: '2.1.0'
});

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Music Japan OS')
      .addItem('自動化を初期設定', 'setupMusicJapanAutomation')
      .addItem('今すぐ同期', 'runAutomationCycle')
      .addItem('Gmailシグナル取込', 'captureGmailSignals')
      .addItem('紹介履歴を同期', 'syncReferralEvents')
      .addSeparator()
      .addItem('ヘルスチェック', 'healthCheck')
      .addToUi();
  } catch (e) {
    console.log('onOpen menu unavailable: ' + e.message);
  }
}

/** Run once after pasting/deploying the project. */
function setupMusicJapanAutomation() {
  return withScriptLock_(function () {
    const ss = getSs_();
    assertRequiredSheets_(ss);
    ensureApiToken_();
    installTriggers_();
    syncEntityRegistry_();
    syncReferralEvents_();
    captureGmailSignals_();
    touchSource_('src_gas', 'PASS', 'Apps Script setup complete / v' + MJ.SCRIPT_VERSION);
    return {
      ok: true,
      version: MJ.SCRIPT_VERSION,
      spreadsheetId: MJ.SPREADSHEET_ID,
      message: 'Music Japan automation initialized.'
    };
  });
}

/** Main periodic worker. Safe to run repeatedly. */
function runAutomationCycle() {
  return withScriptLock_(function () {
    const started = new Date();
    const entityResult = syncEntityRegistry_();
    const referralResult = syncReferralEvents_();
    const gmailResult = captureGmailSignals_();
    touchSource_('src_gas', 'PASS', 'Last cycle OK / v' + MJ.SCRIPT_VERSION);
    touchSource_('src_gmail', 'PASS', 'Gmail scan OK; added=' + gmailResult.added);
    return {
      ok: true,
      startedAt: started.toISOString(),
      entities: entityResult,
      referrals: referralResult,
      gmail: gmailResult
    };
  });
}

function syncReferralEvents() {
  return withScriptLock_(syncReferralEvents_);
}

function captureGmailSignals() {
  return withScriptLock_(captureGmailSignals_);
}

function healthCheck() {
  return withScriptLock_(function () {
    const ss = getSs_();
    assertRequiredSheets_(ss);
    const eventSheet = ss.getSheetByName(MJ.SHEETS.EVENT_LOG);
    const idSheet = ss.getSheetByName(MJ.SHEETS.ID_REGISTRY);
    const signalSheet = ss.getSheetByName(MJ.SHEETS.SIGNAL_INBOX);
    const result = {
      ok: true,
      version: MJ.SCRIPT_VERSION,
      now: new Date().toISOString(),
      eventRows: Math.max(0, eventSheet.getLastRow() - 1),
      entityRows: Math.max(0, idSheet.getLastRow() - 1),
      signalRows: Math.max(0, signalSheet.getLastRow() - 1)
    };
    touchSource_('src_gas', 'PASS', 'Health OK / events=' + result.eventRows + ' / signals=' + result.signalRows);
    return result;
  });
}

function syncEntityRegistry_() {
  const ss = getSs_();
  const master = ss.getSheetByName(MJ.SHEETS.ENTITY_MASTER);
  const registry = ss.getSheetByName(MJ.SHEETS.ID_REGISTRY);
  if (!master || !registry) throw new Error('Entity sheets are missing.');

  const existingRows = registry.getLastRow() > 1
    ? registry.getRange(2, 1, registry.getLastRow() - 1, 14).getValues()
    : [];
  const byKey = new Map();
  existingRows.forEach(function (r) {
    if (r[3]) byKey.set(String(r[3]), r);
  });

  const masterRows = master.getLastRow() > 1
    ? master.getRange(2, 1, master.getLastRow() - 1, Math.min(13, master.getLastColumn())).getValues()
    : [];

  const now = new Date();
  const additions = [];
  masterRows.forEach(function (r) {
    const entityKey = clean_(r[0]);
    if (!entityKey || byKey.has(entityKey)) return;
    const canonicalName = clean_(r[1]) || entityKey;
    additions.push([
      deterministicId_('org_', entityKey),
      'ORGANIZATION',
      canonicalName,
      entityKey,
      canonicalName,
      'apps-script',
      '',
      '',
      now,
      now,
      true,
      0.90,
      'deterministic-sha256',
      'Auto-registered from 17_ENTITY_MASTER; canonical external ID can be attached later.'
    ]);
    byKey.set(entityKey, additions[additions.length - 1]);
  });

  if (additions.length) {
    registry.getRange(registry.getLastRow() + 1, 1, additions.length, 14).setValues(additions);
  }
  return { added: additions.length, totalKnown: byKey.size };
}

function syncReferralEvents_() {
  const ss = getSs_();
  const refSheet = ss.getSheetByName(MJ.SHEETS.REFERRALS);
  const eventSheet = ss.getSheetByName(MJ.SHEETS.EVENT_LOG);
  const idSheet = ss.getSheetByName(MJ.SHEETS.ID_REGISTRY);
  if (!refSheet || !eventSheet || !idSheet) throw new Error('Referral/event sheets are missing.');

  const idRows = idSheet.getLastRow() > 1
    ? idSheet.getRange(2, 1, idSheet.getLastRow() - 1, 14).getValues()
    : [];
  const entityIdByKey = new Map();
  idRows.forEach(function (r) {
    if (r[3] && r[0]) entityIdByKey.set(String(r[3]), String(r[0]));
  });

  const lastEventByObject = new Map();
  if (eventSheet.getLastRow() > 1) {
    const erows = eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 18).getValues();
    erows.forEach(function (r) {
      const objectId = clean_(r[5]);
      if (!objectId) return;
      const recorded = r[2] instanceof Date ? r[2].getTime() : 0;
      const prev = lastEventByObject.get(objectId);
      if (!prev || recorded >= prev.recorded) {
        lastEventByObject.set(objectId, { status: clean_(r[11]), recorded: recorded });
      }
    });
  }

  if (refSheet.getLastRow() <= 1) return { added: 0, scanned: 0 };
  const rows = refSheet.getRange(2, 1, refSheet.getLastRow() - 1, 14).getValues();
  const now = new Date();
  const additions = [];

  rows.forEach(function (r) {
    const sourceName = clean_(r[1]);
    const targetName = clean_(r[2]);
    if (!sourceName || !targetName) return;

    const isDone = r[3] === true || String(r[3]).toUpperCase() === 'TRUE';
    const state = clean_(r[4]) || (isDone ? '紹介済' : '紹介予定');
    const sourceKey = clean_(r[10]) || normalizeEntityKey_(sourceName);
    const targetKey = normalizeEntityKey_(targetName);
    const referralId = clean_(r[11]) || ('ref_' + sourceKey + '__' + targetKey);
    const previous = lastEventByObject.get(referralId);

    if (previous && previous.status === state) return;

    const type = isDone ? 'REFERRAL_INTRODUCED' : 'REFERRAL_PLANNED';
    additions.push([
      newEventId_(type + '|' + referralId + '|' + state + '|' + now.getTime()),
      now,
      now,
      previous ? 'REFERRAL_STATUS_CHANGED' : type,
      entityIdByKey.get(sourceKey) || deterministicId_('org_', sourceKey),
      referralId,
      sourceKey,
      sourceName,
      entityIdByKey.get(targetKey) || deterministicId_('org_', targetKey),
      targetName,
      previous ? previous.status : '',
      state,
      '13_REFERRAL_DB',
      'Apps Script sync',
      now,
      'Apps Script',
      false,
      previous ? 'Detected referral state transition.' : 'Detected new referral relation.'
    ]);
    lastEventByObject.set(referralId, { status: state, recorded: now.getTime() });
  });

  if (additions.length) {
    eventSheet.getRange(eventSheet.getLastRow() + 1, 1, additions.length, 18).setValues(additions);
  }
  return { added: additions.length, scanned: rows.length };
}

function captureGmailSignals_() {
  const ss = getSs_();
  const signalSheet = ss.getSheetByName(MJ.SHEETS.SIGNAL_INBOX);
  const idSheet = ss.getSheetByName(MJ.SHEETS.ID_REGISTRY);
  if (!signalSheet || !idSheet) throw new Error('Signal or ID registry sheet is missing.');

  const knownSignals = new Set();
  if (signalSheet.getLastRow() > 1) {
    signalSheet.getRange(2, 1, signalSheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
      if (r[0]) knownSignals.add(String(r[0]));
    });
  }

  const entities = idSheet.getLastRow() > 1
    ? idSheet.getRange(2, 1, idSheet.getLastRow() - 1, 14).getValues()
    : [];

  const threads = GmailApp.search(MJ.GMAIL_QUERY, 0, MJ.MAX_GMAIL_THREADS);
  const additions = [];
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      const signalId = 'gmail_' + msg.getId();
      if (knownSignals.has(signalId)) return;

      const subject = clean_(msg.getSubject());
      const from = clean_(msg.getFrom());
      const body = clean_(msg.getPlainBody()).slice(0, 10000);
      const haystack = (subject + '\n' + from + '\n' + body).toLowerCase();
      const match = matchEntity_(haystack, entities);
      const type = classifyEmail_(subject, from);
      const suggestion = suggestAction_(type);
      const summary = summarizeSignal_(subject, from, type);
      const hash = sha256Hex_(from + '|' + subject + '|' + msg.getDate().toISOString()).slice(0, 16);

      additions.push([
        signalId,
        msg.getDate(),
        'Gmail',
        from,
        subject,
        match ? match.id : '',
        match ? match.key : '',
        type,
        summary,
        suggestion,
        match ? 0.95 : 0.80,
        'NEW',
        'https://mail.google.com/mail/#all/' + msg.getId(),
        hash
      ]);
      knownSignals.add(signalId);
    });
  });

  if (additions.length) {
    signalSheet.getRange(signalSheet.getLastRow() + 1, 1, additions.length, 14).setValues(additions);
  }
  return { added: additions.length, scannedThreads: threads.length };
}

function matchEntity_(haystack, entities) {
  let best = null;
  entities.forEach(function (r) {
    const id = clean_(r[0]);
    const name = clean_(r[2]);
    const key = clean_(r[3]);
    const alias = clean_(r[4]);
    if (!id || !key) return;
    const candidates = [name, key, alias]
      .map(function (x) { return String(x || '').toLowerCase(); })
      .filter(function (x) { return x.length >= 3; });
    const hit = candidates.some(function (x) { return haystack.indexOf(x) >= 0; });
    if (hit && (!best || key.length > best.key.length)) best = { id: id, key: key };
  });
  return best;
}

function classifyEmail_(subject, from) {
  const s = String(subject || '').toLowerCase();
  const f = String(from || '').toLowerCase();
  if (f.indexOf('timerex.net') >= 0 || s.indexOf('日程調整') >= 0 || s.indexOf('予定を追加') >= 0) return 'MEETING_SIGNAL';
  if (s.indexOf('baton') >= 0 || s.indexOf('新規回答') >= 0) return 'NEEDS_RESPONSE';
  if (s.indexOf('請求') >= 0 || s.indexOf('invoice') >= 0) return 'INVOICE_SIGNAL';
  if (s.indexOf('商談') >= 0 || s.indexOf('面談') >= 0) return 'MEETING_FOLLOWUP';
  if (s.indexOf('紹介') >= 0) return 'REFERRAL_SIGNAL';
  return 'BUSINESS_EMAIL';
}

function suggestAction_(type) {
  const map = {
    MEETING_SIGNAL: 'CRM/Calendarと案件候補を確認',
    NEEDS_RESPONSE: '送客判断・案件状態を確認',
    INVOICE_SIGNAL: '請求状態と外部月次請求を照合',
    MEETING_FOLLOWUP: '商談結果・次アクションをCRMへ記録',
    REFERRAL_SIGNAL: '紹介関係とEvent Logを確認',
    BUSINESS_EMAIL: '内容を確認して必要ならCRMへ反映'
  };
  return map[type] || map.BUSINESS_EMAIL;
}

function summarizeSignal_(subject, from, type) {
  return '[' + type + '] ' + subject + ' / ' + from;
}

function touchSource_(sourceId, health, note) {
  const ss = getSs_();
  const sheet = ss.getSheetByName(MJ.SHEETS.SOURCE_REGISTRY);
  if (!sheet || sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(sourceId)) continue;
    sheet.getRange(i + 2, 14).setValue(new Date());
    sheet.getRange(i + 2, 15).setValue(health);
    if (note) sheet.getRange(i + 2, 17).setValue(note);
    return;
  }
}

function installTriggers_() {
  const ownedHandlers = new Set(['runAutomationCycle']);
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (ownedHandlers.has(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('runAutomationCycle').timeBased().everyMinutes(15).create();
}

function ensureApiToken_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty(MJ.API_TOKEN_PROPERTY);
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(MJ.API_TOKEN_PROPERTY, token);
  }
  return token;
}

/** Minimal authenticated API. The token lives in Script Properties, never in sheet cells. */
function doGet(e) {
  try {
    authorizeRequest_(e);
    const action = e && e.parameter ? e.parameter.action : 'health';
    if (action === 'health') return jsonOutput_(healthCheck());
    if (action === 'run') return jsonOutput_(runAutomationCycle());
    return jsonOutput_({ ok: false, error: 'Unknown action.' }, 400);
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) }, 500);
  }
}

function doPost(e) {
  try {
    authorizeRequest_(e);
    const payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = payload.action || '';
    if (action === 'run') return jsonOutput_(runAutomationCycle());
    if (action === 'event') return jsonOutput_(appendExternalEvent_(payload));
    if (action === 'signal') return jsonOutput_(appendExternalSignal_(payload));
    return jsonOutput_({ ok: false, error: 'Unknown action.' }, 400);
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) }, 500);
  }
}

function appendExternalEvent_(payload) {
  const ss = getSs_();
  const sheet = ss.getSheetByName(MJ.SHEETS.EVENT_LOG);
  const now = new Date();
  const objectId = clean_(payload.objectId);
  if (!objectId) throw new Error('objectId is required.');
  const eventId = clean_(payload.eventId) || newEventId_(JSON.stringify(payload) + now.getTime());
  if (valueExists_(sheet, 1, eventId)) return { ok: true, duplicate: true, eventId: eventId };
  sheet.appendRow([
    eventId,
    payload.occurredAt ? new Date(payload.occurredAt) : now,
    now,
    clean_(payload.eventType) || 'EXTERNAL_EVENT',
    clean_(payload.entityId),
    objectId,
    clean_(payload.entityKey),
    clean_(payload.entityName),
    clean_(payload.relatedEntityId),
    clean_(payload.relatedEntityName),
    clean_(payload.statusBefore),
    clean_(payload.statusAfter),
    clean_(payload.sourceSystem) || 'external-api',
    clean_(payload.sourceRef),
    payload.sourceUpdatedAt ? new Date(payload.sourceUpdatedAt) : now,
    clean_(payload.actor) || 'external-api',
    false,
    clean_(payload.note)
  ]);
  return { ok: true, eventId: eventId };
}

function appendExternalSignal_(payload) {
  const ss = getSs_();
  const sheet = ss.getSheetByName(MJ.SHEETS.SIGNAL_INBOX);
  const now = new Date();
  const signalId = clean_(payload.signalId) || ('api_' + sha256Hex_(JSON.stringify(payload)).slice(0, 20));
  if (valueExists_(sheet, 1, signalId)) return { ok: true, duplicate: true, signalId: signalId };
  sheet.appendRow([
    signalId,
    payload.receivedAt ? new Date(payload.receivedAt) : now,
    clean_(payload.source) || 'API',
    clean_(payload.from),
    clean_(payload.subject),
    clean_(payload.entityId),
    clean_(payload.entityKey),
    clean_(payload.signalType) || 'EXTERNAL_SIGNAL',
    clean_(payload.summary),
    clean_(payload.suggestedAction),
    Number(payload.confidence || 0.8),
    'NEW',
    clean_(payload.sourceUrl),
    clean_(payload.hash) || sha256Hex_(JSON.stringify(payload)).slice(0, 16)
  ]);
  return { ok: true, signalId: signalId };
}

function authorizeRequest_(e) {
  const expected = PropertiesService.getScriptProperties().getProperty(MJ.API_TOKEN_PROPERTY);
  if (!expected) throw new Error('API token not initialized. Run setupMusicJapanAutomation first.');
  const queryToken = e && e.parameter ? clean_(e.parameter.token) : '';
  let bodyToken = '';
  if (e && e.postData && e.postData.contents) {
    try { bodyToken = clean_(JSON.parse(e.postData.contents).token); } catch (_) {}
  }
  if (queryToken !== expected && bodyToken !== expected) throw new Error('Unauthorized.');
}

function valueExists_(sheet, column, value) {
  if (!sheet || sheet.getLastRow() < 2) return false;
  const finder = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext();
  return !!finder;
}

function assertRequiredSheets_(ss) {
  Object.keys(MJ.SHEETS).forEach(function (key) {
    const name = MJ.SHEETS[key];
    if (!ss.getSheetByName(name)) throw new Error('Required sheet missing: ' + name);
  });
}

function getSs_() {
  return SpreadsheetApp.openById(MJ.SPREADSHEET_ID);
}

function deterministicId_(prefix, key) {
  return prefix + sha256Hex_(String(key)).slice(0, 12);
}

function newEventId_(seed) {
  return 'evt_' + sha256Hex_(String(seed) + '|' + Utilities.getUuid()).slice(0, 14);
}

function normalizeEntityKey_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/株式会社/g, '')
    .replace(/合同会社/g, '')
    .replace(/有限会社/g, '')
    .replace(/（株）/g, '')
    .replace(/[\s　]/g, '')
    .trim();
}

function sha256Hex_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function clean_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function withScriptLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another automation cycle is running.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
