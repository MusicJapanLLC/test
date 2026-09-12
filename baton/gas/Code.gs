/**
 * ═══════════════════════════════════════════════════════════════
 *  Baton アンケート受信 / Google Apps Script
 * ═══════════════════════════════════════════════════════════════
 *
 *  ■ 設置手順
 *
 *  1. 回答を貯めるスプレッドシートを新規作成して開く
 *  2. 上部メニューの「拡張機能」→「Apps Script」
 *  3. エディタの中身をすべて消して、このファイルの内容を貼り付ける
 *  4. 保存（Ctrl+S / Cmd+S）
 *  5. 上部の関数選択で setupSheets を選び、「実行」
 *       → 初回は権限の確認画面が出る。
 *         「詳細」→「（プロジェクト名）に移動」→「許可」で承認する
 *       → 6つのシートとヘッダーが一括で作られる
 *  6. 右上の「デプロイ」→「新しいデプロイ」
 *  7. 歯車マーク →「ウェブアプリ」を選択
 *  8. 次のとおり設定する
 *       説明          : Baton survey endpoint（任意の文字列でよい）
 *       実行ユーザー  : 自分
 *       アクセスできるユーザー : 全員
 *  9. 「デプロイ」を押し、表示された「ウェブアプリのURL」をコピー
 *       （https://script.google.com/macros/s/AKfycb.../exec の形）
 * 10. そのURLを Vercel の環境変数 VITE_GAS_ENDPOINT に設定して再デプロイ
 *
 *  ■ 疎通確認
 *     コピーしたURLをブラウザで開いて「OK」と表示されれば届いている。
 *
 *  ■ コードを直したあとの注意
 *     「デプロイ」→「デプロイを管理」→ 鉛筆マーク →
 *     バージョンを「新バージョン」にして更新する。
 *     新しいデプロイを作り直すとURLが変わってしまうので注意。
 *
 * ═══════════════════════════════════════════════════════════════
 */

/** 通知メールの宛先 */
var NOTIFY_TO = 'music.japan.llc@gmail.com';

/** タイムゾーン */
var TZ = 'Asia/Tokyo';

/**
 * サービスごとの設定。
 * hasCapital が true のシートだけ「資本金」列を持つ。
 * questions のラベルは src/data/services.ts の設問文の写し。
 * サイト側で設問を変えたら、ここも合わせて直すと通知メールが読みやすい。
 */
var SERVICES = {
  engineer: {
    name: 'テクフリ（株式会社アイデンティティー）',
    hasCapital: true,
    questions: [
      '足りていない職種はどれですか',
      '人が必要になるのはいつ頃ですか',
      '採用で困っていることはどれが近いですか',
      '知りたいことはどれですか'
    ]
  },
  webgl: {
    name: 'Standment（合同会社Music Japan）',
    hasCapital: true,
    questions: [
      '今のサイトはいつ作られましたか',
      'サイトで一番やりたいことはどれですか',
      'いま感じていることはどれが近いですか',
      '想定している予算はどのくらいですか'
    ]
  },
  system: {
    name: 'ZOOA（株式会社ZOOA）',
    hasCapital: false,
    questions: [
      'いまの状況に一番近いのはどれですか',
      '社内の開発体制はどうなっていますか',
      '感じていることはどれが近いですか',
      '検討している時期はいつ頃ですか'
    ]
  },
  newgrad: {
    name: 'PEP lab',
    hasCapital: false,
    questions: [
      '新卒採用の状況はどれが近いですか',
      '年間の採用予定人数はどのくらいですか',
      '感じていることはどれが近いですか',
      'いま使っている採用手法はどれですか'
    ]
  },
  wordpress: {
    name: 'サイト引越し屋さん（株式会社DPパートナーズ）',
    hasCapital: false,
    questions: [
      '今のサイトはどれで作られていますか',
      '困っていることはどれが近いですか',
      'いまの保守はどうしていますか',
      '管理しているサイトはいくつありますか'
    ]
  },
  crm: {
    name: 'Empro（株式会社エボルグ）',
    hasCapital: false,
    questions: [
      '人材紹介事業の位置づけはどれですか',
      'いまの管理方法はどれですか',
      '感じていることはどれが近いですか',
      '事業に関わっているのは何名くらいですか'
    ]
  }
};

/** シートの列構成。serviceId ごとに「資本金」の有無で分岐する */
function buildHeaders(serviceId) {
  var config = SERVICES[serviceId];
  var headers = ['送信日時', '会社名', 'ご担当者名', 'メールアドレス', '役職'];
  if (config && config.hasCapital) headers.push('資本金');
  headers.push('Q1', 'Q2', 'Q3', 'Q4', 'ひとこと', '連絡方法');
  return headers;
}

/** 配列（複数選択）は「、」区切りで1セルにまとめる */
function flatten(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Array]') return value.join('、');
  return String(value);
}

/** JST の 'yyyy/MM/dd HH:mm:ss' */
function nowJst() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss');
}

/** シートを取得。なければ作り、ヘッダーが空なら1行目を書き込む */
function getSheet(serviceId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(serviceId);
  if (!sheet) sheet = ss.insertSheet(serviceId);

  var headers = buildHeaders(serviceId);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#F1F3F5');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);
    for (var i = 2; i <= headers.length; i++) sheet.setColumnWidth(i, 200);
  }
  return sheet;
}

/**
 * 初回セットアップ。
 * この関数を1度だけ実行すると、6シートとヘッダーが一括で作られる。
 */
function setupSheets() {
  var ids = Object.keys(SERVICES);
  for (var i = 0; i < ids.length; i++) getSheet(ids[i]);

  // 新規スプレッドシートに残る空の「シート1」は、使っていなければ消す
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leftovers = ['シート1', 'Sheet1'];
  for (var j = 0; j < leftovers.length; j++) {
    var extra = ss.getSheetByName(leftovers[j]);
    if (extra && ss.getSheets().length > 1 && extra.getLastRow() === 0) ss.deleteSheet(extra);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('6つのシートを用意しました', 'Baton', 5);
}

/** 疎通確認用。ブラウザでURLを開くと OK と表示される。Baton側の照会もここを通る */
function doGet(e) {
  if (e && e.parameter && typeof e.parameter.action === 'string' && e.parameter.action.indexOf('baton_') === 0) {
    return batonJsonOut(batonHandleGet(e.parameter));
  }
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

    // Baton Introduction System 宛のリクエストはここで分岐する（既存アンケートとは別処理）
    if (data && typeof data.action === 'string' && data.action.indexOf('baton_') === 0) {
      return batonJsonOut(batonHandlePost(data));
    }

    var serviceId = String(data.serviceId || '').trim();
    if (!SERVICES[serviceId]) {
      return ContentService.createTextOutput('UNKNOWN_SERVICE');
    }

    var answers = data.answers || {};
    var profile = data.profile || {};
    var sheet = getSheet(serviceId);

    var row = [
      nowJst(),
      flatten(profile.company),
      flatten(profile.name),
      flatten(profile.email),
      flatten(profile.role)
    ];
    if (SERVICES[serviceId].hasCapital) row.push(flatten(profile.capital));
    row.push(
      flatten(answers.q1),
      flatten(answers.q2),
      flatten(answers.q3),
      flatten(answers.q4),
      flatten(data.comment),
      flatten(data.contactMethod)
    );

    sheet.appendRow(row);

    notify(serviceId, profile, answers, data);

    return ContentService.createTextOutput('OK');
  } catch (err) {
    // 記録は落とさない。失敗しても通知だけは飛ばす
    try {
      MailApp.sendEmail({
        to: NOTIFY_TO,
        subject: '【Baton】受信エラー',
        body: '受信処理でエラーが発生しました。\n\n' + err + '\n\n受信内容:\n' +
          (e && e.postData ? e.postData.contents : '(なし)')
      });
    } catch (ignore) {}
    return ContentService.createTextOutput('ERROR');
  } finally {
    lock.releaseLock();
  }
}

/** 新規回答を知らせるメール */
function notify(serviceId, profile, answers, data) {
  var config = SERVICES[serviceId];
  var lines = [];

  lines.push(config.name + ' のページから、新しい回答が届きました。');
  lines.push('');
  lines.push('受信日時 : ' + nowJst());
  lines.push('会社名   : ' + flatten(profile.company));
  lines.push('担当者名 : ' + flatten(profile.name));
  lines.push('メール   : ' + flatten(profile.email));
  lines.push('役職     : ' + flatten(profile.role));
  if (config.hasCapital) lines.push('資本金   : ' + flatten(profile.capital));
  lines.push('連絡方法 : ' + flatten(data.contactMethod));
  lines.push('');
  lines.push('── 回答 ──────────────────────');

  for (var i = 0; i < config.questions.length; i++) {
    var key = 'q' + (i + 1);
    lines.push('Q' + (i + 1) + '. ' + config.questions[i]);
    lines.push('    ' + (flatten(answers[key]) || '（未回答）'));
  }

  var comment = flatten(data.comment);
  lines.push('');
  lines.push('ひとこと : ' + (comment || '（なし）'));
  lines.push('');
  lines.push('スプレッドシート:');
  lines.push(SpreadsheetApp.getActiveSpreadsheet().getUrl());

  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: '【Baton】' + config.name + ' に新規回答',
    body: lines.join('\n')
  });
}

/**
 * 動作確認用。
 * この関数を実行すると、engineer シートにテスト行が1件入り、
 * 通知メールが1通届く。サイトを公開する前に、書き込みと通知を確かめられる。
 *
 * 確認できたら、入ったテスト行は手で削除してよい。
 */
function testSubmission() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        serviceId: 'engineer',
        timestamp: new Date().toISOString(),
        answers: {
          q1: ['フロントエンド', 'バックエンド'],
          q2: '今すぐ',
          q3: ['採用に時間がかかる'],
          q4: ['単価の相場']
        },
        profile: {
          company: '【テスト】株式会社サンプル',
          name: 'テスト太郎',
          email: 'test@example.com',
          role: '代表取締役',
          capital: '1,000万円未満'
        },
        comment: 'これは動作確認用のテスト送信です。',
        contactMethod: 'メール'
      })
    }
  };

  var result = doPost(fake).getContent();
  Logger.log('結果: ' + result);

  if (result === 'OK') {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'engineer シートに1件入りました。メールも確認してください', 'テスト成功', 8);
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('失敗: ' + result, 'テスト', 8);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  Baton Introduction System（紹介システム）/ 仕様 v1.1
 * ═══════════════════════════════════════════════════════════════
 *  上のアンケート受信（SERVICES / setupSheets）とは完全に独立した別機能。
 *  「この人と話したい」→ 申請者メール認証 → 掲載者承認/辞退 → 社長へ通知、を扱う。
 *
 *  ■ 追加セットアップ手順
 *  1. 関数選択で setupBatonSheets を選び「実行」
 *       → PROFILES / REQUESTS / TOKENS / RESULTS の4シートができる
 *       → PROFILES には初期6件が入る（掲載者メールは暫定で全員 NOTIFY_TO）
 *  2. 実際の掲載者（承認/辞退する本人）のメールが決まったら、
 *     PROFILES シートの recipient_email 列を直接書き換える（再デプロイ不要）
 *  3. 「デプロイを管理」で新バージョンとして更新する（既存の手順と同じ）
 *  4. 時間主導トリガーを1つ追加する（3日リマインド・7日expireに必要）
 *       「トリガー」→「トリガーを追加」
 *       実行する関数: batonDailyJob
 *       イベントのソース: 時間主導 → 日付ベースのタイマー → 午前9時〜10時 など
 *
 *  ■ 動作確認
 *     testBatonFlow() を実行すると、engineer プロフィールへのテスト申請を
 *     1件作り、認証メールが飛ぶところまで確認できる（Logger.log に手順が出る）
 *
 *  ■ プロフィールの公開情報（氏名・写真・紹介文など）について
 *     サイト側の表示は src/data/profiles.ts の静的データを使っている
 *     （LCP最適化のため、ページ表示のたびにこのシートを読みには行かない）。
 *     このシートの public_bio / topics / image / media_url は、今後
 *     実データに差し替える際の作業用メモ欄として用意してあるだけで、
 *     現状サイトの表示には使われていない。
 *     実際にサイトへ反映する情報を変えたい場合は profiles.ts を編集する。
 *     一方 recipient_email と active は、このシートの値がそのまま
 *     動作（誰に承認メールを送るか / 申請を受け付けるか）を左右する。
 */

var BATON_SHEETS = { PROFILES: 'PROFILES', REQUESTS: 'REQUESTS', TOKENS: 'TOKENS', RESULTS: 'RESULTS' };

var BATON_HEADERS = {
  PROFILES: ['profile_id', 'slug', 'name', 'company', 'title', 'public_bio', 'topics', 'image', 'media_url', 'recipient_email', 'active'],
  REQUESTS: ['request_id', 'profile_id', 'applicant_name', 'applicant_company', 'applicant_title', 'applicant_email', 'purpose', 'comment', 'note', 'status', 'created_at', 'verified_at', 'expires_at', 'reminded_at'],
  TOKENS: ['request_id', 'token_hash', 'type', 'created_at', 'expires_at', 'used_at'],
  RESULTS: ['request_id', 'introduced_at', 'meeting_at', 'next_action', 'outcome', 'memo']
};

/** 初期プロフィール。実際の担当者名・掲載者メールが決まり次第シート側で上書きする */
function batonInitialProfileRows() {
  return [
    ['engineer', 'engineer', 'テクフリ', '株式会社アイデンティティー', 'ご担当者', '', '', '', '', NOTIFY_TO, true],
    ['webgl', 'webgl', 'Standment', '合同会社Music Japan', 'ご担当者', '', '', '', '', NOTIFY_TO, true],
    ['system', 'system', 'ZOOA', '株式会社ZOOA', 'ご担当者', '', '', '', '', NOTIFY_TO, true],
    ['newgrad', 'newgrad', 'PEP lab', 'PEP lab', 'ご担当者', '', '', '', '', NOTIFY_TO, true],
    ['wordpress', 'wordpress', 'サイト引越し屋さん', '株式会社DPパートナーズ', 'ご担当者', '', '', '', '', NOTIFY_TO, true],
    ['crm', 'crm', 'Empro', '株式会社エボルグ', 'ご担当者', '', '', '', '', NOTIFY_TO, true]
  ];
}

/** 本番のURL。カスタムドメインを取得したらここを差し替える */
var BATON_SITE_URL = 'https://baton-liart.vercel.app/';

/** メール認証は24時間、承認/辞退の回答期限は認証から7日間、リマインドは3日後 */
var BATON_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
var BATON_RESPOND_TTL_MS = 7 * 24 * 60 * 60 * 1000;
var BATON_REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

var BATON_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function batonJsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** doPost からの Baton 向けリクエストをここで振り分ける */
function batonHandlePost(data) {
  try {
    switch (data.action) {
      case 'baton_talk_submit':
        return batonSubmitTalk(data);
      case 'baton_verify_confirm':
        return batonConfirmVerify(String(data.t || ''));
      case 'baton_respond_action':
        return batonRespondAction(String(data.t || ''), String(data.decision || ''));
      default:
        return { ok: false, error: 'unknown_action' };
    }
  } catch (err) {
    return { ok: false, error: 'server_error', message: String(err) };
  }
}

/** doGet からの Baton 向け照会をここで振り分ける（状態を変えない読み取り専用） */
function batonHandleGet(params) {
  try {
    switch (params.action) {
      case 'baton_verify_check':
        return batonCheckVerify(String(params.t || ''));
      case 'baton_respond_check':
        return batonCheckRespond(String(params.t || ''));
      default:
        return { ok: false, error: 'unknown_action' };
    }
  } catch (err) {
    return { ok: false, error: 'server_error', message: String(err) };
  }
}

function getBatonSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  var headers = BATON_HEADERS[name];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F1F3F5');
    sheet.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) sheet.setColumnWidth(i, 160);
  }
  return sheet;
}

/**
 * 初回セットアップ。PROFILES / REQUESTS / TOKENS / RESULTS を作り、
 * PROFILES にだけ初期6件を入れる（2回実行しても重複しない）。
 */
function setupBatonSheets() {
  var names = Object.keys(BATON_SHEETS);
  for (var i = 0; i < names.length; i++) getBatonSheet(BATON_SHEETS[names[i]]);

  var profilesSheet = getBatonSheet(BATON_SHEETS.PROFILES);
  if (profilesSheet.getLastRow() <= 1) {
    var rows = batonInitialProfileRows();
    profilesSheet.getRange(2, 1, rows.length, BATON_HEADERS.PROFILES.length).setValues(rows);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('Baton Introduction System の4シートを用意しました', 'Baton', 5);
}

/** シートの全データ行を、ヘッダー名をキーにしたオブジェクトの配列で返す（_row は実シート行番号） */
function batonReadRows(sheetName) {
  var sheet = getBatonSheet(sheetName);
  var headers = BATON_HEADERS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, i) {
    var obj = { _row: i + 2 };
    headers.forEach(function (h, idx) { obj[h] = row[idx]; });
    return obj;
  });
}

function batonFindRow(sheetName, keyField, keyValue) {
  var rows = batonReadRows(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][keyField]) === String(keyValue)) return rows[i];
  }
  return null;
}

function batonAppendRow(sheetName, obj) {
  var headers = BATON_HEADERS[sheetName];
  var sheet = getBatonSheet(sheetName);
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
}

function batonSetCell(sheetName, rowIndex, field, value) {
  var headers = BATON_HEADERS[sheetName];
  var col = headers.indexOf(field) + 1;
  if (col <= 0) return;
  getBatonSheet(sheetName).getRange(rowIndex, col).setValue(value);
}

function batonGetProfile(profileId) {
  var row = batonFindRow(BATON_SHEETS.PROFILES, 'profile_id', profileId);
  if (!row) return null;
  if (row.active === false || String(row.active).toUpperCase() === 'FALSE') return null;
  return row;
}

function batonNewId(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1e6);
}

/** 十分に長いランダムトークン。シートにはこの値そのものではなく、hashだけを保存する */
function batonRandomToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function batonHashToken(token) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  return Utilities.base64EncodeWebSafe(digest);
}

function batonUrl(path, token) {
  return BATON_SITE_URL.replace(/\/$/, '') + '/' + path + '/?t=' + encodeURIComponent(token);
}

// ── 申請の作成（① CTA → ② Talk Request） ──────────────────────

function batonSubmitTalk(data) {
  // ハニーポット。埋まっていたらボット扱いにして、何もせず成功したふりをする
  if (data.hp) return { ok: true };

  var profileId = String(data.profileId || '').trim();
  var applicant = data.applicant || {};
  var name = String(applicant.name || '').trim();
  var company = String(applicant.company || '').trim();
  var title = String(applicant.title || '').trim();
  var email = String(applicant.email || '').trim();
  var purpose = String(data.purpose || '').trim();
  var comment = String(data.comment || '').trim();
  var note = String(data.note || '').trim();

  if (!name || !company || !email || !purpose || !comment) {
    return { ok: false, error: 'invalid', message: '必須項目が未入力です。' };
  }
  if (!BATON_EMAIL_RE.test(email)) {
    return { ok: false, error: 'invalid', message: 'メールアドレスの形式をご確認ください。' };
  }

  var profile = batonGetProfile(profileId);
  if (!profile) return { ok: false, error: 'invalid', message: 'このプロフィールは現在受け付けていません。' };

  // 簡易レート制限。同じメールからの立て続けの送信をはじく
  var cache = CacheService.getScriptCache();
  var rlKey = 'baton_rl_' + email;
  if (cache.get(rlKey)) return { ok: false, error: 'rate_limited', message: 'しばらく時間をおいて、もう一度お試しください。' };
  cache.put(rlKey, '1', 60);

  // 同一人物からの重複申請だけ防ぐ（「最大3人」のような総数上限は設けない）
  var existing = batonReadRows(BATON_SHEETS.REQUESTS).some(function (r) {
    return String(r.profile_id) === profileId &&
      String(r.applicant_email).toLowerCase() === email.toLowerCase() &&
      (r.status === 'email_pending' || r.status === 'recipient_pending' || r.status === 'approved');
  });
  if (existing) {
    return { ok: false, error: 'duplicate', message: 'このプロフィールには、すでに申請済みです。' };
  }

  var requestId = batonNewId('req');
  batonAppendRow(BATON_SHEETS.REQUESTS, {
    request_id: requestId,
    profile_id: profileId,
    applicant_name: name,
    applicant_company: company,
    applicant_title: title,
    applicant_email: email,
    purpose: purpose,
    comment: comment,
    note: note,
    status: 'email_pending',
    created_at: new Date(),
    verified_at: '',
    expires_at: '',
    reminded_at: ''
  });

  var token = batonRandomToken();
  batonAppendRow(BATON_SHEETS.TOKENS, {
    request_id: requestId,
    token_hash: batonHashToken(token),
    type: 'email_verify',
    created_at: new Date(),
    expires_at: new Date(Date.now() + BATON_VERIFY_TTL_MS),
    used_at: ''
  });

  MailApp.sendEmail({
    to: email,
    subject: '【Baton】メールアドレスのご確認',
    body: [
      name + ' 様',
      '',
      profile.name + '（' + profile.company + '）さんへの「この人と話したい」申請を受け付けました。',
      '以下のリンクから、メールアドレスの確認をお願いします（24時間以内）。',
      '',
      batonUrl('verify', token),
      '',
      'このメールに心当たりがない場合は、破棄してください。',
      '── 合同会社Music Japan'
    ].join('\n')
  });

  return { ok: true };
}

// ── ③ Email Verify ──────────────────────────────────────────

function batonCheckVerify(token) {
  var tokenRow = token ? batonFindRow(BATON_SHEETS.TOKENS, 'token_hash', batonHashToken(token)) : null;
  if (!tokenRow || tokenRow.type !== 'email_verify') return { ok: true, state: 'invalid' };
  if (tokenRow.used_at) return { ok: true, state: 'used' };
  if (tokenRow.expires_at && new Date() > new Date(tokenRow.expires_at)) return { ok: true, state: 'expired' };

  var requestRow = batonFindRow(BATON_SHEETS.REQUESTS, 'request_id', tokenRow.request_id);
  var profile = requestRow ? batonGetProfile(requestRow.profile_id) : null;
  return { ok: true, state: 'ready', profileName: profile ? profile.name + '（' + profile.company + '）' : undefined };
}

function batonConfirmVerify(token) {
  var tokenRow = token ? batonFindRow(BATON_SHEETS.TOKENS, 'token_hash', batonHashToken(token)) : null;
  if (!tokenRow || tokenRow.type !== 'email_verify') return { ok: false, error: 'invalid' };
  if (tokenRow.used_at) return { ok: false, error: 'used' };
  if (tokenRow.expires_at && new Date() > new Date(tokenRow.expires_at)) return { ok: false, error: 'expired' };

  var requestRow = batonFindRow(BATON_SHEETS.REQUESTS, 'request_id', tokenRow.request_id);
  if (!requestRow) return { ok: false, error: 'invalid' };
  var profile = batonGetProfile(requestRow.profile_id);
  if (!profile) return { ok: false, error: 'invalid' };

  batonSetCell(BATON_SHEETS.TOKENS, tokenRow._row, 'used_at', new Date());

  var expiresAt = new Date(Date.now() + BATON_RESPOND_TTL_MS);
  batonSetCell(BATON_SHEETS.REQUESTS, requestRow._row, 'status', 'recipient_pending');
  batonSetCell(BATON_SHEETS.REQUESTS, requestRow._row, 'verified_at', new Date());
  batonSetCell(BATON_SHEETS.REQUESTS, requestRow._row, 'expires_at', expiresAt);

  var respondToken = batonRandomToken();
  batonAppendRow(BATON_SHEETS.TOKENS, {
    request_id: requestRow.request_id,
    token_hash: batonHashToken(respondToken),
    type: 'recipient_action',
    created_at: new Date(),
    expires_at: expiresAt,
    used_at: ''
  });

  batonSendRecipientMail(requestRow, profile, respondToken, false);
  batonSendAdminMail(
    '【Baton】新規申請',
    batonRequestSummaryLines(requestRow, profile).concat(['', '掲載者・社長の双方に、承認/辞退の依頼メールを送っています。'])
  );

  return { ok: true };
}

// ── ④ Recipient（掲載者の承認/辞退） ────────────────────────────

function batonCheckRespond(token) {
  var tokenRow = token ? batonFindRow(BATON_SHEETS.TOKENS, 'token_hash', batonHashToken(token)) : null;
  if (!tokenRow || tokenRow.type !== 'recipient_action') return { ok: true, state: 'invalid' };
  if (tokenRow.used_at) return { ok: true, state: 'used' };
  if (tokenRow.expires_at && new Date() > new Date(tokenRow.expires_at)) return { ok: true, state: 'expired' };

  var requestRow = batonFindRow(BATON_SHEETS.REQUESTS, 'request_id', tokenRow.request_id);
  if (!requestRow || requestRow.status !== 'recipient_pending') return { ok: true, state: 'used' };
  var profile = batonGetProfile(requestRow.profile_id);

  return {
    ok: true,
    state: 'ready',
    profileName: profile ? profile.name : undefined,
    request: {
      applicantName: requestRow.applicant_name,
      applicantCompany: requestRow.applicant_company,
      applicantTitle: requestRow.applicant_title,
      purpose: requestRow.purpose,
      comment: requestRow.comment,
      note: requestRow.note
    }
  };
}

function batonRespondAction(token, decision) {
  if (decision !== 'approved' && decision !== 'declined') return { ok: false, error: 'invalid' };

  var tokenRow = token ? batonFindRow(BATON_SHEETS.TOKENS, 'token_hash', batonHashToken(token)) : null;
  if (!tokenRow || tokenRow.type !== 'recipient_action') return { ok: false, error: 'invalid' };
  if (tokenRow.used_at) return { ok: false, error: 'used' };
  if (tokenRow.expires_at && new Date() > new Date(tokenRow.expires_at)) return { ok: false, error: 'expired' };

  var requestRow = batonFindRow(BATON_SHEETS.REQUESTS, 'request_id', tokenRow.request_id);
  if (!requestRow || requestRow.status !== 'recipient_pending') return { ok: false, error: 'used' };
  var profile = batonGetProfile(requestRow.profile_id);
  if (!profile) return { ok: false, error: 'invalid' };

  batonSetCell(BATON_SHEETS.TOKENS, tokenRow._row, 'used_at', new Date());
  batonSetCell(BATON_SHEETS.REQUESTS, requestRow._row, 'status', decision);

  batonSendAdminMail(
    decision === 'approved' ? '【Baton】承認' : '【Baton】辞退',
    batonRequestSummaryLines(requestRow, profile).concat([
      '',
      decision === 'approved'
        ? '掲載者が承認しました。紹介方法・タイミングはこちらでご判断ください（連絡先の自動共有はしていません）。'
        : '掲載者が辞退しました。この申請はここで終了です。'
    ])
  );

  MailApp.sendEmail({
    to: requestRow.applicant_email,
    subject: decision === 'approved' ? '【Baton】ご申請の結果について' : '【Baton】ご申請の結果について',
    body: [
      requestRow.applicant_name + ' 様',
      '',
      profile.name + 'さんへのご申請について、ご本人からご回答がありました。',
      '',
      decision === 'approved'
        ? '今回、話をしてもよいとのことです。追って合同会社Music Japanより、ご紹介方法についてご連絡します。'
        : '今回は見送りたいとのことでした。またの機会にご検討いただけますと幸いです。',
      '',
      '── 合同会社Music Japan'
    ].join('\n')
  });

  return { ok: true };
}

// ── メール本文の共通部分 / 管理者通知 ───────────────────────────

function batonRequestSummaryLines(requestRow, profile) {
  return [
    'プロフィール: ' + profile.name + '（' + profile.company + '）',
    '申請者     : ' + requestRow.applicant_name + ' / ' + requestRow.applicant_company + ' / ' + (requestRow.applicant_title || '(未記入)'),
    'メール     : ' + requestRow.applicant_email,
    '目的       : ' + requestRow.purpose,
    'コメント   : ' + requestRow.comment,
    '補足       : ' + (requestRow.note || '(なし)')
  ];
}

function batonSendAdminMail(subject, bodyLines) {
  MailApp.sendEmail({ to: NOTIFY_TO, subject: subject, body: bodyLines.join('\n') });
}

function batonSendRecipientMail(requestRow, profile, token, isReminder) {
  var recipient = profile.recipient_email;
  if (!recipient) return;

  var lines = [
    (isReminder ? '（リマインドです）' : '') + profile.name + ' 様',
    '',
    'あなたと話したいという方から、Batonを通じて申請が届いています。',
    '',
  ].concat(batonRequestSummaryLines(requestRow, profile)).concat([
    '',
    '内容をご確認のうえ、下記のリンクから承認・辞退をお選びください。',
    batonUrl('respond', token),
    '',
    '※承認しても、連絡先が自動で共有されることはありません。紹介方法は合同会社Music Japanが個別にご案内します。',
    '',
    '── 合同会社Music Japan'
  ]);

  MailApp.sendEmail({
    to: recipient,
    subject: (isReminder ? '【Baton】（再送）' : '【Baton】') + 'あなたと話したいという方がいます',
    body: lines.join('\n')
  });
}

// ── 3日リマインド・7日expire（時間主導トリガーで毎日実行する） ───────

function batonDailyJob() {
  var now = new Date();
  var rows = batonReadRows(BATON_SHEETS.REQUESTS);

  rows.forEach(function (row) {
    if (row.status === 'email_pending' && row.created_at) {
      if (now - new Date(row.created_at) > BATON_VERIFY_TTL_MS) {
        batonSetCell(BATON_SHEETS.REQUESTS, row._row, 'status', 'expired');
      }
      return;
    }

    if (row.status !== 'recipient_pending') return;

    var expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    if (expiresAt && now > expiresAt) {
      batonSetCell(BATON_SHEETS.REQUESTS, row._row, 'status', 'expired');
      var profileForExpire = batonGetProfile(row.profile_id);
      if (profileForExpire) {
        batonSendAdminMail(
          '【Baton】期限切れ',
          batonRequestSummaryLines(row, profileForExpire).concat([
            '',
            '7日間ご回答がなかったため、この申請は期限切れになりました。必要であれば手動で再送してください。'
          ])
        );
      }
      return;
    }

    if (!row.reminded_at && row.verified_at && now - new Date(row.verified_at) >= BATON_REMIND_AFTER_MS) {
      var profile = batonGetProfile(row.profile_id);
      if (!profile) return;

      var token = batonRandomToken();
      batonAppendRow(BATON_SHEETS.TOKENS, {
        request_id: row.request_id,
        token_hash: batonHashToken(token),
        type: 'recipient_action',
        created_at: new Date(),
        expires_at: expiresAt || new Date(Date.now() + BATON_RESPOND_TTL_MS),
        used_at: ''
      });
      batonSendRecipientMail(row, profile, token, true);
      batonSetCell(BATON_SHEETS.REQUESTS, row._row, 'reminded_at', now);
    }
  });
}

/**
 * 動作確認用。engineer プロフィールへテスト申請を1件作り、
 * 認証メールが届くところまで確認できる。届いたら、そのメールのリンクを
 * 実際に開いて手続きを進めてよい（テスト行は確認後に手で消してよい）。
 */
function testBatonFlow() {
  var result = batonSubmitTalk({
    profileId: 'engineer',
    applicant: { name: 'テスト太郎', company: '【テスト】株式会社サンプル', title: '担当者', email: 'test@example.com' },
    purpose: '情報交換',
    comment: 'これは動作確認用のテスト送信です。',
    note: '',
    hp: ''
  });

  Logger.log('結果: ' + JSON.stringify(result));
  if (result.ok) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'REQUESTS に1件入りました。test@example.com 宛の認証メールを確認してください', 'テスト成功', 8);
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('失敗: ' + JSON.stringify(result), 'テスト', 8);
  }
}
