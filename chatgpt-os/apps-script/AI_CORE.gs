/*
 * Music Japan AI OPERATIONS BLACKBOX observer
 *
 * Companion module for Code.gs.
 * Human-facing operational truth remains in the integration/KPI/partner sources.
 * Machine continuity, cache, worklog, handoff, failure memory and eval state live
 * in a separate spreadsheet so AI scratch/telemetry never pollutes the human UI.
 *
 * First deploy: run setupEverything() once.
 */

const MJ_AI = Object.freeze({
  BLACKBOX_ID: '1sXZwm0ZhgNU1EnWP4MneSkM4TQeCmoqehV56uAU0yE4',
  TZ: 'Asia/Tokyo',
  VERSION: '2.0.0',
  SIGNATURE_PROPERTY: 'MJ_AI_BLACKBOX_SIGNATURE',
  SHEETS: Object.freeze({
    BOOT: '00_BOOT',
    SOURCES: '01_SOURCE_MAP',
    CACHE: '02_HOT_CACHE',
    WORKLOG: '03_WORKLOG',
    FAILURES: '04_FAILURE_MEMORY',
    RULES: '05_DECISION_RULES',
    HANDOFF: '06_HANDOFF_QUEUE',
    EVAL: '07_AGENT_EVAL',
    CHANGES: '08_CHANGE_LEDGER',
    SNAPSHOTS: '09_SNAPSHOT_INDEX',
    HEALTH: '99_HEALTH'
  })
});

/** Initialize both the human OS automation and the separate AI blackbox observer. */
function setupEverything() {
  const base = setupMusicJapanAutomation();
  const blackbox = setupAiBlackboxObserver();
  appendAiWorklog_(
    'SETUP',
    'Initialize AI blackbox observer',
    'Installed hourly observer and refreshed machine cache',
    'AI_CORE.gs + dedicated BLACKBOX',
    'SUCCESS',
    '',
    'Runtime must be verified from trigger executions; source-ready is not proof of live execution',
    ''
  );
  return { ok: true, base: base, blackbox: blackbox, aiVersion: MJ_AI.VERSION };
}

/** Low-noise observer: hourly, with worklog append only on material state change. */
function setupAiBlackboxObserver() {
  return withScriptLock_(function () {
    assertAiBlackbox_();
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === 'aiBlackboxObserver') ScriptApp.deleteTrigger(trigger);
      if (trigger.getHandlerFunction() === 'aiCoreObserver') ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger('aiBlackboxObserver').timeBased().everyHours(1).create();
    const snapshot = refreshAiBlackbox_();
    PropertiesService.getScriptProperties().setProperty(MJ_AI.SIGNATURE_PROPERTY, snapshot.signature);
    markSourceHealth_('src_gas', 'PASS', 'Apps Script observer installed / AI v' + MJ_AI.VERSION);
    return { ok: true, schedule: 'hourly', signature: snapshot.signature, version: MJ_AI.VERSION };
  });
}

function aiBlackboxObserver() {
  try {
    return withScriptLock_(function () {
      const snapshot = refreshAiBlackbox_();
      const props = PropertiesService.getScriptProperties();
      const previous = props.getProperty(MJ_AI.SIGNATURE_PROPERTY) || '';

      if (snapshot.signature !== previous) {
        appendAiWorklog_(
          'OBSERVE',
          'Material system state changed',
          snapshot.summary,
          'Central OS > BLACKBOX cache/health',
          snapshot.status === 'FAIL' ? 'FAIL' : 'OBSERVED',
          snapshot.status === 'FAIL' ? snapshot.summary : '',
          'Resolve FAIL first, then P0/P1 handoffs, then verified NEW signals',
          ''
        );
        props.setProperty(MJ_AI.SIGNATURE_PROPERTY, snapshot.signature);
      }
      return snapshot;
    });
  } catch (err) {
    try {
      appendAiFailure_('ai_blackbox_observer', 'AI blackbox observer exception', String(err && err.stack ? err.stack : err));
      appendAiWorklog_('OBSERVE', 'AI blackbox observer failed', 'AI_CORE.gs', 'Apps Script', 'FAIL', String(err), 'Inspect execution logs and source permissions', '');
    } catch (logErr) {
      console.error('Blackbox failure logger also failed: ' + logErr);
    }
    throw err;
  }
}

/** Refresh only compact high-signal cache. Source-of-truth stays outside this workbook. */
function refreshAiBlackbox_() {
  const central = getSs_();
  const blackbox = getAiBlackbox_();
  const boot = blackbox.getSheetByName(MJ_AI.SHEETS.BOOT);
  const cache = blackbox.getSheetByName(MJ_AI.SHEETS.CACHE);
  if (!boot || !cache) throw new Error('BLACKBOX BOOT/CACHE missing.');

  SpreadsheetApp.flush();
  const centralChecks = central.getSheetByName('99_チェック');
  const health = central.getSheetByName('16_SYSTEM_HEALTH');
  const top = central.getSheetByName('00_統合TOP');
  if (!centralChecks || !health || !top) throw new Error('Central health sheets missing.');

  const values = {
    'system.status': centralChecks.getRange('B3').getDisplayValue() || 'UNKNOWN',
    'system.data_contract': health.getRange('M2').getDisplayValue() || 'UNKNOWN',
    'system.new_signals': health.getRange('L2').getValue() || 0,
    'system.open_referrals': health.getRange('D2').getValue() || 0,
    'revenue.external_aug': top.getRange('A7').getValue() || 0,
    'system.gas_runtime': 'LIVE'
  };

  const now = new Date();
  updateCacheRows_(cache, values, now);
  boot.getRange('B20').setValue(now).setNumberFormat('yyyy/mm/dd hh:mm:ss');
  markSourceHealth_('src_os', values['system.status'] === 'FAIL' ? 'FAIL' : (values['system.status'] === 'PASS' ? 'PASS' : 'WARN'), 'Central OS refreshed by GAS');
  markSourceHealth_('src_gas', 'PASS', 'Observer heartbeat ' + Utilities.formatDate(now, MJ_AI.TZ, 'yyyy-MM-dd HH:mm:ss'));

  SpreadsheetApp.flush();
  const overall = blackbox.getSheetByName(MJ_AI.SHEETS.HEALTH).getRange('D11').getDisplayValue() || 'UNKNOWN';
  const openHandoffs = Number(boot.getRange('B15').getValue() || 0);
  const openFailures = Number(boot.getRange('B16').getValue() || 0);
  const staleCache = Number(boot.getRange('B17').getValue() || 0);
  const sourceWarnings = Number(boot.getRange('B18').getValue() || 0);
  const signature = [overall, values['system.status'], values['system.data_contract'], values['system.new_signals'], values['system.open_referrals'], values['revenue.external_aug'], openHandoffs, openFailures, staleCache, sourceWarnings].join('|');
  const summary = [
    'blackbox=' + overall,
    'central=' + values['system.status'],
    'contract=' + values['system.data_contract'],
    'newSignals=' + values['system.new_signals'],
    'openReferrals=' + values['system.open_referrals'],
    'externalRevenue=' + values['revenue.external_aug'],
    'handoffs=' + openHandoffs,
    'openFailures=' + openFailures,
    'staleCache=' + staleCache,
    'sourceWarnings=' + sourceWarnings
  ].join('; ');

  return { ok: overall !== 'FAIL', status: overall, signature: signature, summary: summary, observedAt: now.toISOString() };
}

function updateCacheRows_(sheet, valueMap, now) {
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 20).getValues();
  rows.forEach(function (r, idx) {
    const key = String(r[0] || '');
    if (!Object.prototype.hasOwnProperty.call(valueMap, key)) return;
    const row = idx + 2;
    sheet.getRange(row, 4).setValue(valueMap[key]);
    sheet.getRange(row, 8).setValue(now).setNumberFormat('yyyy/mm/dd hh:mm:ss');
    sheet.getRange(row, 12).setValue('VERIFIED');
  });
}

function markSourceHealth_(sourceId, state, note) {
  const blackbox = getAiBlackbox_();
  const sheet = blackbox.getSheetByName(MJ_AI.SHEETS.SOURCES);
  if (!sheet || sheet.getLastRow() < 2) return;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) !== String(sourceId)) continue;
    const row = i + 2;
    sheet.getRange(row, 12).setValue(new Date()).setNumberFormat('yyyy/mm/dd hh:mm:ss');
    sheet.getRange(row, 13).setValue(state);
    if (note) sheet.getRange(row, 16).setValue(note);
    return;
  }
}

/** Public helper for future scripts to log verified material work. */
function recordAiWorklog(kind, objective, action, evidence, result, failure, nextAction, commitSha) {
  return withScriptLock_(function () {
    return appendAiWorklog_(kind, objective, action, evidence, result, failure, nextAction, commitSha);
  });
}

function appendAiWorklog_(kind, objective, action, evidence, result, failure, nextAction, commitSha) {
  const blackbox = getAiBlackbox_();
  const sheet = blackbox.getSheetByName(MJ_AI.SHEETS.WORKLOG);
  if (!sheet) throw new Error('03_WORKLOG missing.');
  const now = new Date();
  const workId = 'work_' + Utilities.formatDate(now, MJ_AI.TZ, 'yyyyMMdd_HHmmss') + '_' + Utilities.getUuid().slice(0, 8);
  const sessionId = 'gas_' + Utilities.formatDate(now, MJ_AI.TZ, 'yyyyMMdd_HHmmss');
  const row = [
    workId, sessionId, now, now, 'Google Apps Script', String(kind || ''), String(objective || ''), String(action || ''),
    'AI BLACKBOX / Central OS', String(evidence || ''), String(result || ''), String(result || ''), String(failure || ''),
    String(nextAction || ''), String(commitSha || ''), '', '', 'AI observer v' + MJ_AI.VERSION
  ];
  sheet.appendRow(row);
  const last = sheet.getLastRow();
  sheet.getRange(last, 3, 1, 2).setNumberFormat('yyyy/mm/dd hh:mm:ss');
  return { ok: true, workId: workId, row: last };
}

function appendAiFailure_(failureKey, symptom, evidence) {
  const blackbox = getAiBlackbox_();
  const sheet = blackbox.getSheetByName(MJ_AI.SHEETS.FAILURES);
  if (!sheet) return;
  const now = new Date();
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues() : [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(failureKey)) continue;
    const row = i + 2;
    sheet.getRange(row, 3).setValue(now).setNumberFormat('yyyy/mm/dd hh:mm:ss');
    const recurrence = Number(sheet.getRange(row, 10).getValue() || 0);
    sheet.getRange(row, 10).setValue(recurrence + 1);
    sheet.getRange(row, 13).setValue(evidence);
    return;
  }
  sheet.appendRow([failureKey, now, now, 'AUTOMATION', symptom, 'UNKNOWN', 'Investigate before retrying identical path', 'Apps Script exception', 'Inspect execution logs/source permissions', 1, 'HIGH', 'OPEN', evidence, 'Auto-created by observer']);
}

function getAiBlackbox_() {
  return SpreadsheetApp.openById(MJ_AI.BLACKBOX_ID);
}

function assertAiBlackbox_() {
  const ss = getAiBlackbox_();
  Object.keys(MJ_AI.SHEETS).forEach(function (k) {
    const name = MJ_AI.SHEETS[k];
    if (!ss.getSheetByName(name)) throw new Error('AI BLACKBOX missing sheet: ' + name);
  });
  return ss;
}
