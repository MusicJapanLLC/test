/**
 * ═══════════════════════════════════════════════════════════════
 *  リーガルチェック（LegalOn）アンケート受信 / Google Apps Script
 * ═══════════════════════════════════════════════════════════════
 *
 *  ⚠️ 貼り付け先を間違えないこと
 *
 *  これは Baton の gas/Code.gs とは【別物】です。
 *  同じ Apps Script プロジェクトに貼ると、doPost が二重定義になって
 *  両方が壊れます。必ず別のプロジェクトに貼ってください。
 *
 *  書き込み先スプレッドシート:
 *    https://docs.google.com/spreadsheets/d/17-PN1b8H740nUdmbJJBfik6OKns8xhRp8bhJ9Di6ZdA/edit
 *
 *  このスプレッドシートには Baton が使っている既存シート
 *  （engineer / webgl / system / newgrad / wordpress / crm）があります。
 *  このコードは 'legal' シートしか触りません。既存シートは読みも書きもしません。
 *
 * ───────────────────────────────────────────────────────────────
 *  ■ 設置手順
 *
 *  1. 上のスプレッドシートを開く
 *  2. 「拡張機能」→「Apps Script」
 *
 *     ★ ここで開いた画面に Baton のコード（doPost や setupSheets）が
 *       すでに入っている場合は、この方法は使えません。
 *       その場合は下の【別プロジェクトで作る場合】に進んでください。
 *
 *  3. 空のプロジェクトなら、中身を消してこのコードを貼り付ける
 *  4. 保存（Ctrl+S / Cmd+S）
 *  5. 関数プルダウンで setupLegalSheet を選び「実行」
 *       → 初回は権限の確認が出る。
 *         「詳細」→「（プロジェクト名）に移動」→「許可」で承認する
 *       → 'legal' シートとヘッダーができる（既存シートはそのまま）
 *  6. 右上「デプロイ」→「新しいデプロイ」
 *  7. 歯車 →「ウェブアプリ」
 *  8. 実行ユーザー: 自分 ／ アクセスできるユーザー: 全員
 *  9. 「デプロイ」を押し、ウェブアプリのURLをコピー
 * 10. そのURLを、リーガルチェック用 Vercel プロジェクトの
 *     環境変数 VITE_GAS_ENDPOINT に設定する
 *     ※ Baton の Vercel プロジェクトには絶対に入れないこと
 *
 * ───────────────────────────────────────────────────────────────
 *  ■ 別プロジェクトで作る場合（Baton のコードが既に入っているとき）
 *
 *  1. https://script.google.com/home を開く
 *  2. 「新しいプロジェクト」を作る
 *  3. このコードを貼る
 *  4. 下の SPREADSHEET_ID がスプレッドシートのIDと合っているか確認する
 *     （URLの /d/ と /edit の間の文字列）
 *  5. あとは上の 4〜10 と同じ
 *
 * ───────────────────────────────────────────────────────────────
 *  ■ 列を増やしたときの注意
 *     すでに 'legal' シートがある状態でヘッダーを増やしても、
 *     1行目は自動では書き換わりません。
 *     列構成を変えたら 'legal' シートを一度削除してから
 *     setupLegalSheet を実行し直してください。
 *     （テスト行しか無いうちに済ませること）
 *
 *  ■ 疎通確認
 *     コピーしたURLをブラウザで開いて「OK」と出れば届いています。
 *
 *  ■ コードを直したあと
 *     「デプロイ」→「デプロイを管理」→ 鉛筆マーク →
 *     バージョンを「新バージョン」にして更新する。
 *     新しいデプロイを作り直すとURLが変わるので注意。
 *
 * ═══════════════════════════════════════════════════════════════
 */

/** 書き込み先のスプレッドシート。スプレッドシートに紐付いていない場合に使う */
var SPREADSHEET_ID = '17-PN1b8H740nUdmbJJBfik6OKns8xhRp8bhJ9Di6ZdA';

/** このコードが触ってよい唯一のシート */
var SHEET_NAME = 'legal';

/** 通知メールの宛先 */
var NOTIFY_TO = 'music.japan.llc@gmail.com';

var TZ = 'Asia/Tokyo';

/** 設問文。通知メールを読めるようにするための写し */
var QUESTIONS = [
  '契約書は月にどのくらい見ますか',
  'いまの法務体制はどれが近いですか',
  '契約書のレビューで感じていることはどれですか',
  '知りたいことはどれですか',
  '導入を考えている時期はいつ頃ですか'
];

var HEADERS = [
  '送信日時',
  '会社名',
  '業種',
  'ご担当者名',
  'メールアドレス',
  '電話番号',
  '役職',
  '資本金',
  '従業員数',
  'Q1 月間レビュー件数',
  'Q2 法務体制',
  'Q3 課題',
  'Q4 知りたいこと',
  'Q5 検討時期',
  'ひとこと',
  '連絡方法'
];

/** スプレッドシートを取得。バインドされていればそれを、なければIDで開く */
function book() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * 画面右下の通知。独立プロジェクトでは出せないので、その場合は黙って飛ばす。
 */
function toast(message, title) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) ss.toast(message, title, 8);
  } catch (ignore) {}
  Logger.log(title + ': ' + message);
}

/**
 * 'legal' シートを取得。なければ作る。
 * 既にあれば作り直さない。他のシートには一切触れない。
 */
function legalSheet() {
  var ss = book();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#EDF1F7');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);
    for (var i = 2; i <= HEADERS.length; i++) sheet.setColumnWidth(i, 200);
  }
  return sheet;
}

/**
 * 初回セットアップ。1度だけ実行する。
 * 'legal' シートとヘッダーを用意する。既存シートは触らない。
 */
function setupLegalSheet() {
  var sheet = legalSheet();
  toast(
    "'" + SHEET_NAME + "' シートを用意しました（既存シートは変更していません）",
    'リーガルチェック'
  );
  return sheet.getName();
}

/**
 * 複数選択は「、」区切りで1セルに。
 * 「その他：〇〇」の形は、そのまま連結して残す。
 */
function flatten(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Array]') return value.join('、');
  return String(value);
}

/** JST の 'yyyy/MM/dd HH:mm:ss' */
function nowJst() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss');
}

/** 疎通確認用 */
function doGet() {
  return ContentService.createTextOutput('OK');
}

/** サイトからの送信を受け取る */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    return ContentService.createTextOutput('BUSY');
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('NO_BODY');
    }

    var data = JSON.parse(e.postData.contents);

    // このコードは legal 以外を受け付けない。取り違え事故を防ぐため
    if (String(data.serviceId || '').trim() !== 'legal') {
      return ContentService.createTextOutput('UNKNOWN_SERVICE');
    }

    var answers = data.answers || {};
    var profile = data.profile || {};

    legalSheet().appendRow([
      nowJst(),
      flatten(profile.company),
      flatten(profile.industry),
      flatten(profile.name),
      flatten(profile.email),
      flatten(profile.tel),
      flatten(profile.role),
      flatten(profile.capital),
      flatten(profile.employees),
      flatten(answers.q1),
      flatten(answers.q2),
      flatten(answers.q3),
      flatten(answers.q4),
      flatten(answers.q5),
      flatten(data.comment),
      flatten(data.contactMethod)
    ]);

    notify(profile, answers, data);

    return ContentService.createTextOutput('OK');
  } catch (err) {
    try {
      MailApp.sendEmail({
        to: NOTIFY_TO,
        subject: '【リーガルチェック】受信エラー',
        body:
          '受信処理でエラーが発生しました。\n\n' +
          err +
          '\n\n受信内容:\n' +
          (e && e.postData ? e.postData.contents : '(なし)')
      });
    } catch (ignore) {}
    return ContentService.createTextOutput('ERROR');
  } finally {
    lock.releaseLock();
  }
}

/** 新規回答を知らせるメール。電話番号を最初に置く */
function notify(profile, answers, data) {
  var company = flatten(profile.company);
  var lines = [];

  lines.push('リーガルチェックのページから、新しい回答が届きました。');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('電話番号 : ' + (flatten(profile.tel) || '（未入力）'));
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('受信日時 : ' + nowJst());
  lines.push('会社名   : ' + company);
  lines.push('業種     : ' + flatten(profile.industry));
  lines.push('担当者名 : ' + flatten(profile.name));
  lines.push('メール   : ' + flatten(profile.email));
  lines.push('役職     : ' + flatten(profile.role));
  lines.push('資本金   : ' + flatten(profile.capital));
  lines.push('従業員数 : ' + flatten(profile.employees));
  lines.push('検討時期 : ' + flatten(answers.q5));
  lines.push('連絡方法 : ' + flatten(data.contactMethod));
  lines.push('');
  lines.push('── 回答 ──────────────────────');

  for (var i = 0; i < QUESTIONS.length; i++) {
    var key = 'q' + (i + 1);
    lines.push('Q' + (i + 1) + '. ' + QUESTIONS[i]);
    lines.push('    ' + (flatten(answers[key]) || '（未回答）'));
  }

  lines.push('');
  lines.push('ひとこと : ' + (flatten(data.comment) || '（なし）'));
  lines.push('');
  lines.push('スプレッドシート:');
  lines.push(book().getUrl() + '#gid=' + legalSheet().getSheetId());

  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: '【リーガルチェック】新規回答：' + (company || '会社名未入力'),
    body: lines.join('\n')
  });
}

/**
 * 動作確認用。
 * 実行すると legal シートにテスト行が1件入り、通知メールが1通届く。
 * 確認できたら、入ったテスト行は手で削除してよい。
 */
function testLegalSubmission() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        serviceId: 'legal',
        timestamp: new Date().toISOString(),
        answers: {
          q1: '5〜10件',
          q2: '法務担当が1〜3名いる',
          q3: ['時間がかかる', '見落としがないか不安'],
          q4: ['料金プラン', '同業種の導入事例'],
          q5: '3ヶ月以内'
        },
        profile: {
          company: '【テスト】株式会社サンプル',
          industry: '情報通信・IT',
          name: 'テスト太郎',
          email: 'test@example.com',
          tel: '070-0000-0000',
          role: '法務責任者',
          capital: '1,000万円',
          employees: '50名'
        },
        comment: 'これは動作確認用のテスト送信です。',
        contactMethod: 'メール'
      })
    }
  };

  var result = doPost(fake).getContent();
  toast('結果: ' + result, 'テスト');
  return result;
}
