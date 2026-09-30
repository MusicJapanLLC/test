/**
 * Baton Partners｜相談アンケートの受付
 *
 * 役割
 *   1. 回答をスプレッドシートに1件1行で記録する
 *   2. 社長（OWNER_EMAIL）へ、回答の全文と添付資料のリンクをメールする
 *      → 添付資料は社長のGoogleドライブに、受付番号ごとのフォルダで保存する（共有はしない）
 *   3. 掲載企業へは「新しい相談が1件あった」ことと受付番号・今月の件数だけを通知する
 *      → お客様の会社名・氏名・連絡先・回答内容は送らない（双方了承後に社長がLINEでつなぐ）
 *      → 通知の契機は「アンケートの送信」。通知＝紹介成立ではない（紹介はステータス列で管理）
 *      → 同じ受付番号が2回届いても、記録・通知は1回だけ（送信の再試行による重複を防ぐ）
 *      → 送れなかった通知は「企業通知」列に「失敗」と残し、retryPartnerNotices で送り直す
 *      → 企業が通知を望まない場合は、PARTNERS の notify を false にすれば止まる
 *   4. 月初に、前月の件数を各企業と社長へ送る（sendMonthlySummary をトリガー登録）
 *
 * 設置手順
 *   1. 記録用のスプレッドシートを作り、［拡張機能］→［Apps Script］にこのファイルを貼る
 *   2. ［プロジェクトの設定］→［スクリプト プロパティ］に次の2つを登録する
 *        OWNER_EMAIL = 社長のメールアドレス
 *        PARTNERS    = {"evorg":{"name":"株式会社エボルグ","emails":["担当者@evorg.co.jp"],"notify":true}}
 *      （企業のメールアドレスはリポジトリに置かない。ここにだけ書く）
 *      任意：FILES_FOLDER_ID = 添付資料を置くドライブのフォルダID（未設定なら初回に自動で作る）
 *   3. setupSheets() を1回実行して、シートと見出しを作る（ドライブの権限もここで許可する）
 *   4. ［デプロイ］→［新しいデプロイ］→ 種類「ウェブアプリ」
 *        実行ユーザー：自分 / アクセスできるユーザー：全員
 *      表示された URL を、サイトの環境変数 VITE_GAS_ENDPOINT に設定する
 *   5. ［トリガー］で sendMonthlySummary を「月ベースのタイマー / 1日 / 午前9〜10時」に登録する
 *   6. ［トリガー］で retryPartnerNotices を「時間ベースのタイマー / 1時間おき」に登録する
 */

const SHEET_NAME = '相談';
const HEADERS = [
  '受付日時', '受付番号', '企業ID', '企業名', '流入',
  '会社名', 'お名前', 'メールアドレス', '役職',
  '回答', 'ひとこと', 'ポートフォリオURL', '資料', 'ページ', '企業通知',
  'ステータス', '商談化', 'メモ',
];
const MAX_LEN = 2000;
// 添付の上限（サイト側の client/submit.ts と揃える）
const FILE_MAX_TOTAL = 30 * 1024 * 1024;
const FILE_MAX_COUNT = 5;
const FILE_EXT = /\.(pdf|pptx?|key|docx?|xlsx?|csv|png|jpe?g|gif|webp|zip)$/i;
const FILES_FOLDER_NAME = 'Baton Partners｜相談の添付資料';

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  // ステータスはプルダウン、商談化はチェックボックス（紹介件数・商談件数を数えるため）
  const rows = sheet.getMaxRows() - 1;
  sheet.getRange(2, HEADERS.indexOf('ステータス') + 1, rows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['未確認', '紹介先へ確認中', '紹介済み', '見送り'], true).build(),
  );
  sheet.getRange(2, HEADERS.indexOf('商談化') + 1, rows, 1).insertCheckboxes();
  filesRoot_(); // ドライブの権限確認と、保存先フォルダの用意
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const partners = getPartners_();
    const partner = partners[data.partnerId];
    if (!partner) return json_({ ok: false, error: 'unknown partner' });

    const p = data.profile || {};
    if (!p.company || !p.name || !p.email) return json_({ ok: false, error: 'missing fields' });

    const receiptId = clean_(data.receiptId) || Utilities.getUuid().slice(0, 8).toUpperCase();
    const now = new Date();
    const answers = formatAnswers_(data.questions || {}, data.answers || {});
    const portfolioUrl = /^https?:\/\//i.test(String(data.portfolioUrl || '')) ? clean_(data.portfolioUrl) : '';

    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    let monthCount, row, saved;
    try {
      // 送信の再試行などで同じ受付番号が届いたら、記録も通知もしない
      if (hasReceipt_(sheet, receiptId)) return json_({ ok: true, receiptId: receiptId, duplicate: true });
      saved = saveFiles_(data.files, receiptId, partner.name, p.company);
      sheet.appendRow([
        now, receiptId, clean_(data.partnerId), partner.name, clean_(data.source),
        clean_(p.company), clean_(p.name), clean_(p.email), clean_(p.role),
        clean_(answers), clean_(data.comment), portfolioUrl, saved.folderUrl, clean_(data.page), '未送信',
        '未確認', false, '',
      ]);
      row = sheet.getLastRow();
      monthCount = countFor_(sheet, data.partnerId, now.getFullYear(), now.getMonth());
    } finally {
      lock.releaseLock();
    }

    notifyOwner_(partner, receiptId, now, p, answers, data, portfolioUrl, saved);
    setNotice_(sheet, row, notifyPartner_(partner, receiptId, now, monthCount));
    return json_({ ok: true, receiptId: receiptId });
  } catch (err) {
    console.error(err);
    return json_({ ok: false });
  }
}

/** 社長あて：判断に必要な情報をすべて載せる */
function notifyOwner_(partner, receiptId, now, p, answers, data, portfolioUrl, saved) {
  const owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
  if (!owner) return;
  const body = [
    `${partner.name} への相談が届きました。`,
    '',
    `受付番号：${receiptId}`,
    `受付日時：${fmt_(now)}`,
    '',
    '■ お客様',
    `会社名：${p.company}`,
    `お名前：${p.name}`,
    `メール：${p.email}`,
    `役職：${p.role || '-'}`,
    '',
    '■ 回答',
    answers,
    '',
    '■ ひとこと',
    data.comment || '-',
    '',
    '■ 共有いただいた資料',
    `URL：${portfolioUrl || '-'}`,
    saved.files.length ? `ファイル：${saved.files.join('、')}` : 'ファイル：-',
    saved.folderUrl ? `保存先：${saved.folderUrl}` : '',
    saved.skipped.length ? `受け取れなかったもの：${saved.skipped.join('、')}` : '',
    '',
    `ページ：${data.page || '-'}`,
    '',
    `※ ${partner.name} には、受付番号と件数だけを通知しています。資料は双方の了承後に共有してください。`,
  ].join('\n');
  MailApp.sendEmail({ to: owner, subject: `【Baton Partners】${partner.name}｜新しい相談（${receiptId}）`, body: body });
}

/**
 * 掲載企業あて：通知だけ。お客様の個人情報・回答内容は含めない。
 * 戻り値は「企業通知」列に書く状態（送信済み / 停止中 / 宛先なし / 失敗：理由）。
 */
function notifyPartner_(partner, receiptId, now, monthCount) {
  if (partner.notify === false) return '停止中';
  if (!partner.emails || !partner.emails.length) return '宛先なし';
  const body = [
    `${partner.name} ご担当者様`,
    '',
    'Baton Partners 経由で、新しいご相談が1件届きました。',
    '',
    `受付番号：${receiptId}`,
    `受付日時：${fmt_(now)}`,
    `今月のご相談件数：${monthCount}件`,
    '',
    '内容はMusic Japanが確認し、ご紹介の可否とタイミングを判断したうえでご連絡します。',
    'お客様の連絡先は、双方のご了承をいただいてから、LINEグループでおつなぎする際に共有します。',
    '',
    'この件についてのお問い合わせは、受付番号を添えてMusic Japanまでご連絡ください。',
    'この通知が不要な場合も、Music Japanへお知らせいただければ停止します。',
    '',
    '合同会社Music Japan｜Baton Partners',
  ].join('\n');
  try {
    MailApp.sendEmail({ to: partner.emails.join(','), subject: `【Baton Partners】新しいご相談が届きました（${receiptId}）`, body: body });
    return '送信済み';
  } catch (err) {
    console.error(err);
    return `失敗：${String(err && err.message || err).slice(0, 80)}`;
  }
}

/** 1時間おきに実行：送れなかった企業通知を送り直す */
function retryPartnerNotices() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const partners = getPartners_();
  const values = sheet.getDataRange().getValues();
  const c = function (name) { return HEADERS.indexOf(name); };
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const state = String(r[c('企業通知')]);
    if (state.indexOf('失敗') !== 0 && state !== '未送信') continue;
    const partner = partners[r[c('企業ID')]];
    const d = r[c('受付日時')];
    if (!partner || !(d instanceof Date)) continue;
    const count = countFor_(sheet, r[c('企業ID')], d.getFullYear(), d.getMonth());
    setNotice_(sheet, i + 1, notifyPartner_(partner, r[c('受付番号')], d, count));
  }
}

/** 月初に実行：前月の件数を各企業と社長へ */
function sendMonthlySummary() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const partners = getPartners_();
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const label = `${target.getFullYear()}年${target.getMonth() + 1}月`;
  const lines = [];

  Object.keys(partners).forEach(function (id) {
    const partner = partners[id];
    const s = statsFor_(sheet, id, target.getFullYear(), target.getMonth());
    lines.push(`${partner.name}：相談 ${s.total}件 / 紹介済み ${s.introduced}件 / 商談化 ${s.meetings}件`);
    if (partner.notify !== false && partner.emails && partner.emails.length) {
      MailApp.sendEmail({
        to: partner.emails.join(','),
        subject: `【Baton Partners】${label}のご相談件数`,
        body: [
          `${partner.name} ご担当者様`, '',
          `${label}の Baton Partners 経由のご相談件数をお知らせします。`, '',
          `ご相談：${s.total}件`, `ご紹介済み：${s.introduced}件`, `商談化：${s.meetings}件`, '',
          '合同会社Music Japan｜Baton Partners',
        ].join('\n'),
      });
    }
  });

  const owner = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
  if (owner) {
    MailApp.sendEmail({ to: owner, subject: `【Baton Partners】${label}の件数まとめ`, body: lines.join('\n') || '対象の企業がありません。' });
  }
}

// ── 以下、内部関数 ──────────────────────────────

/**
 * 添付資料をドライブに保存する。受付番号ごとにフォルダを分け、共有設定は変えない（社長だけが見られる）。
 * 形式・件数・合計サイズはサイト側でも止めているが、ここでも確かめる。
 */
function saveFiles_(files, receiptId, partnerName, company) {
  const result = { folderUrl: '', files: [], skipped: [] };
  if (!Array.isArray(files) || !files.length) return result;
  let total = 0;
  let folder = null;
  files.slice(0, FILE_MAX_COUNT).forEach(function (f) {
    const name = String((f && f.name) || '').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 120);
    try {
      if (!name || !FILE_EXT.test(name)) throw new Error('形式');
      const bytes = Utilities.base64Decode(String(f.data || ''));
      total += bytes.length;
      if (total > FILE_MAX_TOTAL) throw new Error('容量');
      if (!folder) {
        folder = filesRoot_().createFolder(`${receiptId}｜${partnerName}｜${String(company || '').slice(0, 40)}`);
        result.folderUrl = folder.getUrl();
      }
      folder.createFile(Utilities.newBlob(bytes, String(f.type || 'application/octet-stream'), name));
      result.files.push(name);
    } catch (err) {
      result.skipped.push(name || '（名前なし）');
    }
  });
  if (files.length > FILE_MAX_COUNT) result.skipped.push(`ほか${files.length - FILE_MAX_COUNT}件（件数の上限）`);
  return result;
}

function filesRoot_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FILES_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder(FILES_FOLDER_NAME);
  props.setProperty('FILES_FOLDER_ID', folder.getId());
  return folder;
}

function getPartners_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PARTNERS') || '{}';
  return JSON.parse(raw);
}

function rowsFor_(sheet, partnerId, year, month) {
  const values = sheet.getDataRange().getValues().slice(1);
  const col = function (name) { return HEADERS.indexOf(name); };
  return values.filter(function (r) {
    const d = r[col('受付日時')];
    return r[col('企業ID')] === partnerId && d instanceof Date && d.getFullYear() === year && d.getMonth() === month;
  });
}

function hasReceipt_(sheet, receiptId) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const col = HEADERS.indexOf('受付番号') + 1;
  return sheet.getRange(2, col, last - 1, 1).getValues().some(function (r) { return r[0] === receiptId; });
}

function setNotice_(sheet, row, state) {
  sheet.getRange(row, HEADERS.indexOf('企業通知') + 1).setValue(state);
}

function countFor_(sheet, partnerId, year, month) {
  return rowsFor_(sheet, partnerId, year, month).length;
}

function statsFor_(sheet, partnerId, year, month) {
  const rows = rowsFor_(sheet, partnerId, year, month);
  return {
    total: rows.length,
    introduced: rows.filter(function (r) { return r[HEADERS.indexOf('ステータス')] === '紹介済み'; }).length,
    meetings: rows.filter(function (r) { return r[HEADERS.indexOf('商談化')] === true; }).length,
  };
}

function formatAnswers_(questions, answers) {
  return Object.keys(answers).map(function (id) {
    const v = answers[id];
    return `${questions[id] || id}：${Array.isArray(v) ? v.join('、') : v}`;
  }).join('\n');
}

/** 長さを制限し、数式として解釈される先頭文字（= + - @）を無効化する */
function clean_(v) {
  const s = String(v == null ? '' : v).slice(0, MAX_LEN);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function fmt_(d) {
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
