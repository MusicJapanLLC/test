/*
 * Music Japan AI CORE observer
 *
 * Companion module for Code.gs. Keeps 90_AI_CORE useful after deployment
 * without turning email or inferred signals into business truth.
 *
 * Run setupEverything() instead of setupMusicJapanAutomation() on first deploy.
 */

const MJ_AI_CORE = Object.freeze({
  SHEET: '90_AI_CORE',
  SIGNATURE_PROPERTY: 'MJ_AI_CORE_SIGNATURE',
  VERSION: '1.0.0',
  WORKLOG_START_ROW: 92,
  WORKLOG_COLS: 14
});

/** One-shot setup entrypoint for the whole Apps Script project. */
function setupEverything() {
  const base = setupMusicJapanAutomation();
  const observer = setupAiCoreObserver();
  recordAiCoreWorklog_(
    'GAS setupEverything',
    'Initialized base automation + AI CORE observer',
    'Code.gs / AI_CORE.gs / 90_AI_CORE',
    'IMPLEMENTED',
    '',
    'Observer records state changes only; no direct CRM mutation',
    ''
  );
  return { ok: true, base: base, aiCore: observer, aiCoreVersion: MJ_AI_CORE.VERSION };
}

/** Install a low-noise hourly observer. It logs only when the state signature changes. */
function setupAiCoreObserver() {
  return withScriptLock_(function () {
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === 'aiCoreObserver') ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger('aiCoreObserver').timeBased().everyHours(1).create();
    const first = aiCoreSnapshot_();
    PropertiesService.getScriptProperties().setProperty(MJ_AI_CORE.SIGNATURE_PROPERTY, first.signature);
    return { ok: true, schedule: 'hourly', signature: first.signature };
  });
}

/** Observe health/signals. Append a worklog row only when material state changes. */
function aiCoreObserver() {
  try {
    return withScriptLock_(function () {
      const ss = getSs_();
      const core = ss.getSheetByName(MJ_AI_CORE.SHEET);
      if (!core) throw new Error('90_AI_CORE is missing.');

      const snapshot = aiCoreSnapshot_();
      const props = PropertiesService.getScriptProperties();
      const previous = props.getProperty(MJ_AI_CORE.SIGNATURE_PROPERTY) || '';

      // B8 is LastRecalc/heartbeat. Once GAS is live this becomes a stable runtime timestamp.
      core.getRange('B8').setValue(new Date());
      core.getRange('B8').setNumberFormat('yyyy/mm/dd hh:mm:ss');

      if (snapshot.signature !== previous) {
        recordAiCoreWorklog_(
          'AI CORE state change',
          snapshot.summary,
          '90_AI_CORE / 16_SYSTEM_HEALTH / 99_チェック / 24_SIGNAL_INBOX',
          snapshot.status === 'FAIL' ? 'FAIL' : 'OBSERVED',
          snapshot.status === 'FAIL' ? snapshot.summary : '',
          'Resolve FAIL first; then process NEW signals by evidence/confidence',
          ''
        );
        props.setProperty(MJ_AI_CORE.SIGNATURE_PROPERTY, snapshot.signature);
      }

      return snapshot;
    });
  } catch (err) {
    try {
      recordAiCoreWorklog_(
        'AI CORE observer failure',
        'Observer threw an exception',
        'AI_CORE.gs',
        'FAIL',
        String(err && err.stack ? err.stack : err),
        'Inspect source health and Apps Script execution logs',
        ''
      );
    } catch (logErr) {
      console.error('AI CORE failure logger also failed: ' + logErr);
    }
    throw err;
  }
}

/** Durable snapshot used to avoid noisy repeated logs. */
function aiCoreSnapshot_() {
  const ss = getSs_();
  const core = ss.getSheetByName(MJ_AI_CORE.SHEET);
  if (!core) throw new Error('90_AI_CORE is missing.');

  SpreadsheetApp.flush();
  const values = core.getRange('B9:B17').getDisplayValues().map(function (r) { return String(r[0] || ''); });
  const status = values[0] || 'UNKNOWN';
  const contract = values[1] || 'UNKNOWN';
  const newSignals = values[2] || '0';
  const openReferrals = values[3] || '0';
  const stale7d = values[4] || '0';
  const sourceWarnings = values[5] || '0';
  const gasRuntime = values[6] || 'UNKNOWN';
  const revenue = values[7] || '0';
  const pressure = values[8] || '0';

  const signature = [status, contract, newSignals, openReferrals, stale7d, sourceWarnings, gasRuntime, revenue, pressure].join('|');
  const summary = [
    'status=' + status,
    'contract=' + contract,
    'newSignals=' + newSignals,
    'openReferrals=' + openReferrals,
    'stale7d=' + stale7d,
    'sourceWarnings=' + sourceWarnings,
    'gas=' + gasRuntime,
    'externalRevenue=' + revenue,
    'pressure=' + pressure
  ].join('; ');

  return {
    ok: status !== 'FAIL' && contract !== 'FAIL',
    status: status,
    contract: contract,
    newSignals: newSignals,
    openReferrals: openReferrals,
    stale7d: stale7d,
    sourceWarnings: sourceWarnings,
    gasRuntime: gasRuntime,
    externalRevenue: revenue,
    pressure: pressure,
    signature: signature,
    summary: summary,
    observedAt: new Date().toISOString()
  };
}

/** Public helper for future agents/automation modules to record a verified mutation. */
function recordAiCoreWorklog(objective, changes, evidence, result, failures, nextAction, githubCommit) {
  return withScriptLock_(function () {
    return recordAiCoreWorklog_(objective, changes, evidence, result, failures, nextAction, githubCommit);
  });
}

function recordAiCoreWorklog_(objective, changes, evidence, result, failures, nextAction, githubCommit) {
  const ss = getSs_();
  const core = ss.getSheetByName(MJ_AI_CORE.SHEET);
  if (!core) throw new Error('90_AI_CORE is missing.');

  const row = nextBlankWorklogRow_(core);
  const now = new Date();
  const systemStatus = core.getRange('B9').getDisplayValue() || 'UNKNOWN';
  const dataContract = core.getRange('B10').getDisplayValue() || 'UNKNOWN';
  const sessionId = 'gas_' + Utilities.formatDate(now, MJ.TZ, 'yyyyMMdd_HHmmss') + '_' + Utilities.getUuid().slice(0, 8);

  const values = [[
    sessionId,
    now,
    'Google Apps Script',
    String(objective || ''),
    String(changes || ''),
    String(evidence || ''),
    String(result || ''),
    String(failures || ''),
    String(nextAction || ''),
    String(githubCommit || ''),
    dataContract,
    systemStatus,
    'AI_CORE observer v' + MJ_AI_CORE.VERSION,
    now
  ]];

  core.getRange(row, 1, 1, MJ_AI_CORE.WORKLOG_COLS).setValues(values);
  core.getRange(row, 2).setNumberFormat('yyyy/mm/dd hh:mm:ss');
  core.getRange(row, 14).setNumberFormat('yyyy/mm/dd hh:mm:ss');
  return { ok: true, row: row, sessionId: sessionId };
}

function nextBlankWorklogRow_(sheet) {
  const start = MJ_AI_CORE.WORKLOG_START_ROW;
  const count = Math.max(1, sheet.getMaxRows() - start + 1);
  const values = sheet.getRange(start, 1, count, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) return start + i;
  }
  sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  return sheet.getMaxRows() - 99;
}
