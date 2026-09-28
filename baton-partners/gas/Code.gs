/**
 * Baton Partners｜相談アンケートの受付
 *
 * 役割
 *   1. 回答をスプレッドシートに1件1行で記録する
 *   2. 社長（OWNER_EMAIL）へ、回答の全文をメールする
 *   3. 掲載企業へは「新しい相談が1件あった」ことと受付番号・今月の件数だけを通知する
 *      → お客様の会社名・氏名・連絡先・回答内容は送らない（双方了承後に社長がLINEでつなぐ）
 *   4. 月初に、前月の件数を各企業と社長へ送る（sendMonthlySummary をトリガー登録）
 *
 * 設置手順
 *   1. 記録用のスプレッドシートを作り、［拡張機能］→［Apps Script］にこのファイルを貼る
 *   2. ［プロジェクトの設定］→［スクリプト プロパティ］に次の2つを登録する
 *        OWNER_EMAIL = 社長のメールアドレス
 *        PARTNERS    = {"evorg":{"name":"株式会社エボルグ","emails":["担当者@evorg.co.jp"]}}
 *      （企業のメールアドレスはリポジトリに置かない。ここにだけ書く）
 *   3. setupSheets() を1回実行して、シートと見出しを作る
 *   4. ［デプロイ］→［新しいデプロイ］→ 種類「ウェブアプリ」
 *        実行ユーザー：自分 / アクセスできるユーザー：全員
 *      表示された URL を、サイトの環境変数 VITE_GAS_ENDPOINT に設定する
 *   5. ［トリガー］で sendMonthlySummary を「月ベースのタイマー / 1日 / 午前9〜10時」に登録する
 */

const SHEET_NAME = '相談';
const HEADERS = [
  '受付日時', '受付番号', '企業ID', '企業名', '流入',
  '会社名', 'お名前', 'メールアドレス', '役職', 'LINE表示名',
  '回答', 'ひとこと', 'ページ',
  'ステータス', '商談化', 'メモ',
];
const MAX_LEN = 2000;

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

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let monthCount;
    try {
      const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
      sheet.appendRow([
        now, receiptId, clean_(data.partnerId), partner.name, clean_(data.source),
        clean_(p.company), clean_(p.name), clean_(p.email), clean_(p.role), clean_(p.lineName),
        clean_(answers), clean_(data.comment), clean_(data.page),
        '未確認', false, '',
      ]);
      monthCount = countFor_(sheet, data.partnerId, now.getFullYear(), now.getMonth());
    } finally {
      lock.releaseLock();
    }

    notifyOwner_(partner, receiptId, now, p, answers, data);
    notifyPartner_(partner, receiptId, now, monthCount);
    return json_({ ok: true, receiptId: receiptId });
  } catch (err) {
    console.error(err);
    return json_({ ok: false });
  }
}

/** 社長あて：判断に必要な情報をすべて載せる */
function notifyOwner_(partner, receiptId, now, p, answers, data) {
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
    `LINE表示名：${p.lineName || '-'}`,
    '',
    '■ 回答',
    answers,
    '',
    '■ ひとこと',
    data.comment || '-',
    '',
    `ページ：${data.page || '-'}`,
    '',
    `※ ${partner.name} には、受付番号と件数だけを通知しています。`,
  ].join('\n');
  MailApp.sendEmail({ to: owner, subject: `【Baton Partners】${partner.name}｜新しい相談（${receiptId}）`, body: body });
}

/** 掲載企業あて：通知だけ。お客様の個人情報・回答内容は含めない */
function notifyPartner_(partner, receiptId, now, monthCount) {
  if (!partner.emails || !partner.emails.length) return;
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
    '',
    '合同会社Music Japan｜Baton Partners',
  ].join('\n');
  MailApp.sendEmail({ to: partner.emails.join(','), subject: `【Baton Partners】新しいご相談が届きました（${receiptId}）`, body: body });
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
    if (partner.emails && partner.emails.length) {
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
