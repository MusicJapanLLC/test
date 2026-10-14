/**
 * ═══════════════════════════════════════════════════════════════
 *  MJ STORE ご要望・バグ報告の受信 / Google Apps Script
 * ═══════════════════════════════════════════════════════════════
 *
 *  ■ 設置手順（Baton と同じ流れ）
 *
 *  1. 受け取り用のスプレッドシートを新規作成して開く
 *  2. 上部メニューの「拡張機能」→「Apps Script」
 *  3. エディタの中身をすべて消して、このファイルの内容を貼り付けて保存
 *  4. 関数選択で setupSheet を選んで「実行」（初回は権限を許可）
 *       → 「ご要望」シートとヘッダーができる
 *  5. 右上の「デプロイ」→「新しいデプロイ」→ 歯車 →「ウェブアプリ」
 *       実行ユーザー：自分　／　アクセスできるユーザー：全員
 *  6. 表示された「ウェブアプリのURL」（…/exec）をコピー
 *  7. Vercel の環境変数 VITE_GAS_ENDPOINT に貼って、再デプロイ
 *
 *  ■ 疎通確認
 *     コピーしたURLをブラウザで開いて「OK」と出れば届いている。
 *
 *  ■ コードを直したら
 *     「デプロイを管理」→ 鉛筆 → バージョン「新バージョン」で更新する。
 *     新しいデプロイを作るとURLが変わるので注意。
 * ═══════════════════════════════════════════════════════════════
 */

/** 通知メールの宛先 */
var NOTIFY_TO = 'music.japan.llc@gmail.com';
var TZ = 'Asia/Tokyo';
var SHEET = 'ご要望';

var HEADERS = [
  '受付日時', 'チケット', '用件', '作品', '深刻度', '内容',
  'お名前', '返信先', '環境', '送信ページ', '状態', 'メモ'
];

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  sh.setColumnWidth(6, 420);
  sh.setColumnWidth(9, 260);
  /* 状態はプルダウンで管理する */
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['未対応', '確認中', '対応済み', '見送り'], true).build();
  sh.getRange(2, 11, 1000, 1).setDataValidation(rule);
}

function doGet() {
  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var p = JSON.parse(e.postData.contents);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
    if (!sh) { setupSheet(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET); }

    var clip = function (v, n) { return String(v || '').slice(0, n); };
    var row = [
      Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss'),
      clip(p.ticket, 20),
      clip(p.typeLabel, 40),
      clip(p.gameTitle, 80),
      clip(p.severity, 40),
      clip(p.message, 2000),
      clip(p.name, 60),
      clip(p.contact, 120),
      clip(p.env, 400),
      clip(p.page, 300),
      '未対応',
      ''
    ];
    /* 先頭が = + - @ のセルは数式として解釈されないようにする */
    row = row.map(function (v) { return /^[=+\-@]/.test(v) ? "'" + v : v; });
    sh.appendRow(row);

    var subject = '[MJ STORE] ' + row[2] + '：' + row[3] + '（' + row[1] + '）';
    var body = [
      'MJ STORE にご要望が届きました。',
      '',
      'チケット：' + row[1],
      '用件　　：' + row[2],
      '作品　　：' + row[3],
      row[4] ? '深刻度　：' + row[4] : '',
      '',
      '── 内容 ──',
      row[5],
      '',
      'お名前　：' + (row[6] || '（なし）'),
      '返信先　：' + (row[7] || '（返信不要）'),
      row[8] ? '環境　　：' + row[8] : '',
      '',
      SpreadsheetApp.getActiveSpreadsheet().getUrl()
    ].filter(function (l) { return l !== null; }).join('\n');
    MailApp.sendEmail({ to: NOTIFY_TO, subject: subject, body: body });

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
