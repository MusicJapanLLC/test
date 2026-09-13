/**
 * ═══════════════════════════════════════════════════════════════
 *  Baton Introduction System（紹介システム） / Google Apps Script
 * ═══════════════════════════════════════════════════════════════
 *
 *  このファイルは「この人と話したい」→ 申請者メール認証 → 本人の承認/辞退
 *  → 社長へ通知、という一次紹介の流れだけを扱う。
 *
 *  ⚠️ このファイルに、6サービス（テクフリ/Standment/ZOOA/PEP lab/
 *  サイト引越し屋さん/Empro）のアンケート受信コードを絶対に混ぜないこと。
 *  過去に一度混ぜたことがあり、その古いコードの setupSheets() を実行した
 *  結果、このスプレッドシート（LINE会話ログ）に無関係な6シート
 *  （engineer/webgl/system/newgrad/wordpress/crm）が作られる事故が起きた。
 *  6サービス側のコードは gas/Code.services.gs に分離してある。
 *  そちらは完全に別のスプレッドシート・別のApps Scriptプロジェクトとして
 *  独立に運用すること（詳しくは gas/Code.services.gs の先頭コメント参照）。
 *
 *  ■ 設置手順（独立プロジェクトとして作る。スプレッドシートには紐付けない）
 *
 *  「LINE会話ログ」スプレッドシートには、すでに別のApps Scriptプロジェクトが
 *  紐付いている（LINEのやり取りを記録するためのもの）。1つのスプレッドシート
 *  に紐付けられるApps Scriptプロジェクトは1つだけなので、このコードを
 *  そのシートの「拡張機能→Apps Script」に貼ると、既存のLINE記録用スクリプト
 *  を壊す（上書きする）おそれがある。絶対にそちらでは開かないこと。
 *
 *  ★ すでに壁谷さんのプロフィールで動いている場合（既存プロジェクトの更新）
 *  新しいプロジェクトは作らない。https://script.google.com/ の一覧から、
 *  すでにデプロイ済みの「Baton Introduction System」プロジェクトを開き、
 *  中身をこのファイルの内容で丸ごと置き換えて保存 → 下記6を実行 →
 *  「デプロイ」→「デプロイを管理」→ 鉛筆マーク → 新バージョンで更新する。
 *  新規デプロイを作り直すとURLが変わり VITE_GAS_ENDPOINT が壊れるので、
 *  必ず「新バージョン」を使うこと。
 *
 *  ★ まだ一度も作っていない場合（新規セットアップ）は、以下の手順どおり:
 *
 *  1. https://script.google.com/ を直接開く（スプレッドシート経由ではない）
 *  2. 「新しいプロジェクト」
 *  3. エディタの中身をすべて消して、このファイルの内容を貼り付ける
 *  4. 保存（Ctrl+S / Cmd+S）
 *  5. 上の BATON_SPREADSHEET_ID が「LINE会話ログ」のURLのIDと
 *     一致しているか確認する（このコードは openById() で名指しして
 *     そのスプレッドシートを開くので、紐付けなくても正しく読み書きできる）
 *  6. 上部の関数選択で setupBatonSheets を選び、「実行」
 *       → 初回は権限の確認画面が出る。
 *         「詳細」→「（プロジェクト名）に移動」→「許可」で承認する
 *       → BATON_REQUESTS シートが用意される（無ければ作る／既存の列は
 *         無傷のまま、足りない列だけ右側に追加する）
 *  7. 右上の「デプロイ」→「新しいデプロイ」
 *  8. 歯車マーク →「ウェブアプリ」を選択
 *  9. 次のとおり設定する
 *       説明          : Baton Introduction System（任意の文字列でよい）
 *       実行ユーザー  : 自分
 *       アクセスできるユーザー : 全員
 * 10. 「デプロイ」を押し、表示された「ウェブアプリのURL」をコピー
 *       （https://script.google.com/macros/s/AKfycb.../exec の形）
 * 11. そのURLを VITE_GAS_ENDPOINT に設定して再デプロイ
 * 12. 時間主導トリガーを1つ追加する（3日リマインド・7日expireに必要）
 *       「トリガー」→「トリガーを追加」
 *       実行する関数: batonDailyJob
 *       イベントのソース: 時間主導 → 日付ベースのタイマー → 午前9時〜10時 など
 *
 *  ■ 疎通確認
 *     コピーしたURLをブラウザで開いて「OK」と表示されれば届いている。
 *
 *  ■ コードを直したあとの注意
 *     「デプロイ」→「デプロイを管理」→ 鉛筆マーク →
 *     バージョンを「新バージョン」にして更新する。
 *     新しいデプロイを作り直すとURLが変わってしまうので注意。
 *
 *  ■ このコードが対象にしているスプレッドシートについて
 *  このスクリプトは「LINE会話ログ」スプレッドシート（既存の紹介業務で
 *  使っているもの）に紐づけて使う前提。中の BATON_REQUESTS シートに
 *  1行＝1申請として書き込む。既存の「会話ログ」「紹介チェック」
 *  「紹介履歴_RAW」の各シートには一切触れない。
 *
 *  BATON_REQUESTS の元々の列（すでにある。順番も含めて変更しない）:
 *    request_id / 申請日時 / 話したい人 / 申請者 / 会社名 / メール /
 *    コメント / 状態 / 本人回答 / 本人回答日時 / 社長通知日時 /
 *    紹介済 / 紹介日時 / プロフィールURL
 *  このスクリプトが右側に追加する列（setupBatonSheets実行時に無ければ足す）:
 *    profile_id / 役職 / 目的 / 備考 / 添付資料 /
 *    認証トークンhash / 認証期限 / 認証日時 /
 *    回答トークンhash / 回答期限 / リマインド日時
 *  「紹介済」「紹介日時」はこのスクリプトからは書き換えない。
 *  実際に紹介した後、社長が手で入れる想定（既存の紹介チェックと同じ運用）。
 *
 *  ■ プロフィール（掲載者）の設定について
 *  氏名・会社・掲載者メールは、下の BATON_PROFILES にコードで書く。
 *  人物が増えたら、この中にオブジェクトを1件追加する
 *  （新しい人物の追加手順は baton/docs/ADDING_A_PROFILE.md を参照）。
 *  recipientEmail は非公開情報。ここにしか置かない（サイト側のコード
 *  src/data/profiles.ts には一切含めない）。追加したばかりの人物は、
 *  本人の受信用メールアドレスに書き換えて active: true にするまで、
 *  「話したい」の申請を受け付けない（active: false のままにしておく）。
 *  掲載される公開情報（写真・紹介文など）は src/data/profiles.ts 側の担当。
 *
 *  ■ 添付資料について
 *  申請フォームで添付されたファイルは、Googleドライブの
 *  「Baton 添付資料」フォルダ（無ければ自動作成）に保存し、
 *  リンク共有（閲覧のみ）にしたうえで、そのURLを添付資料列に記録する。
 *
 *  ■ 動作確認
 *     testBatonFlow() を実行すると、kabeya プロフィールへのテスト申請を
 *     1件作り、認証メールが飛ぶところまで確認できる（Logger.log に結果が出る）
 *
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * このスクリプトが読み書きするスプレッドシートのID。
 * 値は「LINE会話ログ」スプレッドシートのURLの
 * https://docs.google.com/spreadsheets/d/【ここ】/edit
 * の部分。念のため、実際のURLと一致しているか確認すること。
 */
var BATON_SPREADSHEET_ID = '1e5fVGFQiUOx_HMVaTTj6C4TLNI2Pi5Hx2-gnoOnCiew';

/** 上のIDのスプレッドシートを開く。全部の読み書きはこれ経由に統一する */
function batonGetSpreadsheet() {
  return SpreadsheetApp.openById(BATON_SPREADSHEET_ID);
}

/**
 * シート右下に出るポップアップ通知。
 * このスクリプトはスプレッドシートに紐付いていない独立プロジェクトとして
 * 作った場合、呼べない（Cannot call SpreadsheetApp.showNotification()）
 * ことがある。その場合は諦めて実行ログにだけ残す（処理自体は続く・失敗しない）。
 */
function batonToast(message, title, seconds) {
  try {
    batonGetSpreadsheet().toast(message, title, seconds);
  } catch (err) {
    Logger.log('(通知ポップアップは出せませんでした) ' + title + ': ' + message);
  }
}

/** 通知メールの宛先（社長） */
var NOTIFY_TO = 'music.japan.llc@gmail.com';

/** 疎通確認用。ブラウザでURLを開くと OK と表示される */
function doGet(e) {
  if (e && e.parameter && typeof e.parameter.action === 'string' && e.parameter.action.indexOf('baton_') === 0) {
    return batonJsonOut(batonHandleGet(e.parameter));
  }
  return ContentService.createTextOutput('OK');
}

/** サイトからの送信を受け取る。baton_ で始まるaction以外は受け付けない */
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
    if (data && typeof data.action === 'string' && data.action.indexOf('baton_') === 0) {
      return batonJsonOut(batonHandlePost(data));
    }

    return ContentService.createTextOutput('UNKNOWN_ACTION');
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

/** 対象シート名。すでにこの名前でシートが存在する前提 */
var BATON_SHEET_NAME = 'BATON_REQUESTS';

/** 元々ある列（この順番・名前は変更しない） */
var BATON_BASE_HEADERS = [
  'request_id', '申請日時', '話したい人', '申請者', '会社名', 'メール',
  'コメント', '状態', '本人回答', '本人回答日時', '社長通知日時',
  '紹介済', '紹介日時', 'プロフィールURL'
];

/** このスクリプトが右側に追加する列 */
var BATON_EXTRA_HEADERS = [
  'profile_id', '役職', '目的', '備考', '添付資料',
  '認証トークンhash', '認証期限', '認証日時',
  '回答トークンhash', '回答期限', 'リマインド日時'
];

/**
 * プロフィール（掲載者）の設定。
 * recipientEmail は非公開情報。ここにしか置かない（サイト側のコードには含めない）。
 */
var BATON_PROFILES = {
  kabeya: {
    name: '壁谷 友生',
    company: '合同会社Music Japan',
    slug: 'kabeya',
    // 壁谷さん本人のプロフィールのため、暫定で社長通知先と同じアドレスにしてある
    recipientEmail: NOTIFY_TO,
    active: true
  },
  unveil: {
    name: '古谷 祐麻',
    company: '株式会社unveil',
    slug: 'unveil',
    // 暫定: 古谷様本人にはまだ見せていないため、社内テスト用にOwner自身の
    // アドレスに設定している。本人に見せる際は、ここを古谷様ご本人の
    // 受信用メールアドレスに差し替えること（このファイルはサイトのビルドには
    // 含まれず、Apps Script側に手動で貼り付けて使うため、ここを直接書き換えて
    // 「デプロイを管理」→新バージョンで反映する）。
    recipientEmail: 'tomoki.xxx.1009@gmail.com',
    active: true
  }
};

/** 本番のURL。カスタムドメインを取得したらここを差し替える */
var BATON_SITE_URL = 'https://baton.music-japan.com/';

/** 添付資料の保存先フォルダ名 */
var BATON_DRIVE_FOLDER_NAME = 'Baton 添付資料';

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

/** BATON_REQUESTS シートを取得。無ければ元の14列で作り、足りない列は右に追加する */
function batonGetRequestsSheet() {
  var ss = batonGetSpreadsheet();
  var sheet = ss.getSheetByName(BATON_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BATON_SHEET_NAME);
    sheet.getRange(1, 1, 1, BATON_BASE_HEADERS.length).setValues([BATON_BASE_HEADERS]);
    sheet.getRange(1, 1, 1, BATON_BASE_HEADERS.length).setFontWeight('bold').setBackground('#F1F3F5');
    sheet.setFrozenRows(1);
  }
  batonEnsureExtraHeaders(sheet);
  return sheet;
}

/** 既存の列はそのまま。BATON_EXTRA_HEADERS のうち無いものだけ右端に追加する */
function batonEnsureExtraHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  BATON_EXTRA_HEADERS.forEach(function (h) {
    if (existing.indexOf(h) === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(h).setFontWeight('bold').setBackground('#F1F3F5');
      existing.push(h);
    }
  });
}

/**
 * 初回セットアップ。BATON_REQUESTS シートを確認し、無ければ作り、
 * 足りない列があれば右側に追加する（既存の列・データには触れない）。
 * このファイルには、これ以外の「シートを作る」関数は存在しない。
 */
function setupBatonSheets() {
  batonGetRequestsSheet();
  batonToast('BATON_REQUESTS シートを確認・用意しました', 'Baton', 5);
}

/** 現在のヘッダー行から { 列名: 列番号(1始まり) } を作る */
function batonHeaderIndex(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var map = {};
  headers.forEach(function (h, i) {
    if (h) map[String(h)] = i + 1;
  });
  return map;
}

/** シートの全データ行を、列名をキーにしたオブジェクトの配列で返す（_row は実シート行番号） */
function batonReadRequestRows() {
  var sheet = batonGetRequestsSheet();
  var idx = batonHeaderIndex(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var names = Object.keys(idx);
  return values.map(function (row, i) {
    var obj = { _row: i + 2 };
    names.forEach(function (h) { obj[h] = row[idx[h] - 1]; });
    return obj;
  });
}

function batonFindRequestRow(headerName, value) {
  var rows = batonReadRequestRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][headerName] && String(rows[i][headerName]) === String(value)) return rows[i];
  }
  return null;
}

/** obj のキーは列名。無い列は無視する（想定外の書き込み事故を防ぐ） */
function batonAppendRequestRow(obj) {
  var sheet = batonGetRequestsSheet();
  var idx = batonHeaderIndex(sheet);
  var lastCol = sheet.getLastColumn();
  var row = new Array(lastCol).fill('');
  Object.keys(obj).forEach(function (k) {
    if (idx[k]) row[idx[k] - 1] = obj[k];
  });
  sheet.appendRow(row);
}

function batonSetRequestCell(rowIndex, headerName, value) {
  var sheet = batonGetRequestsSheet();
  var idx = batonHeaderIndex(sheet);
  if (!idx[headerName]) return;
  sheet.getRange(rowIndex, idx[headerName]).setValue(value);
}

function batonGetProfile(profileId) {
  var p = BATON_PROFILES[profileId];
  if (!p || !p.active) return null;
  return p;
}

function batonProfileUrl(profileId) {
  var p = BATON_PROFILES[profileId];
  var slug = (p && p.slug) || profileId;
  return (BATON_SITE_URL.replace(/\/$/, '') + '/profile/' + slug + '/');
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

/** 添付資料の保存先フォルダ。無ければ作る */
function batonGetAttachmentFolder() {
  var it = DriveApp.getFoldersByName(BATON_DRIVE_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(BATON_DRIVE_FOLDER_NAME);
}

/**
 * 添付ファイル（base64）をGoogleドライブに保存し、閲覧リンクのURLを返す。
 * 1件失敗しても他の添付は続ける（申請自体は失敗させない）。
 */
function batonSaveAttachments(attachments) {
  if (!attachments || !attachments.length) return [];
  var folder = null;
  var urls = [];

  for (var i = 0; i < attachments.length && i < 3; i++) {
    var a = attachments[i];
    if (!a || !a.data) continue;
    try {
      if (!folder) folder = batonGetAttachmentFolder();
      var bytes = Utilities.base64Decode(a.data);
      var blob = Utilities.newBlob(bytes, a.mimeType || 'application/octet-stream', a.name || ('attachment' + (i + 1)));
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urls.push((a.name || file.getName()) + ': ' + file.getUrl());
    } catch (err) {
      urls.push((a.name || 'ファイル' + (i + 1)) + ': 保存に失敗しました');
    }
  }
  return urls;
}

// ── 申請の作成（① CTA → ② Talk Request） ──────────────────────

/**
 * 申請者へ送る受付メール。
 * verifyToken を渡すと「メール認証をお願いします」の案内・リンク付きになる。
 * null なら（認証済みスキップの場合）、認証の案内なしで「受け付けました」だけになる。
 */
function batonSendApplicantMail(email, name, profile, profileId, verifyToken) {
  var lines = [
    name + ' 様',
    '',
    '名前：' + profile.name + '様',
    '会社名：' + profile.company,
    '紹介プロフィール：' + batonProfileUrl(profileId),
    '',
    '「紹介申請」を受け付けました。'
  ];

  if (verifyToken) {
    lines.push('以下のリンクから、メールアドレスの確認をお願いします（24時間以内）。');
    lines.push('');
    lines.push(batonUrl('verify', verifyToken));
  }

  lines.push('');
  lines.push('双方の確認が取れ次第、お繋ぎさせていただきます。');
  lines.push('引き続きよろしくお願いいたします。');
  lines.push('');
  lines.push('合同会社Music Japan');
  lines.push('壁谷 友生');

  MailApp.sendEmail({
    to: email,
    subject: verifyToken ? '【Baton】メールアドレスのご確認' : '【Baton】申請を受け付けました',
    body: lines.join('\n')
  });
}

function batonSubmitTalk(data) {
  // ハニーポット。埋まっていたらボット扱いにして、何もせず成功したふりをする
  if (data.hp) return { ok: true };

  var profileId = String(data.profileId || '').trim();
  var applicant = data.applicant || {};
  var name = String(applicant.name || '').trim();
  var company = String(applicant.company || '').trim();
  var title = String(applicant.title || '').trim();
  var email = String(applicant.email || '').trim();
  var purposes = (data.purposes && data.purposes.length) ? data.purposes : [];
  var comment = String(data.comment || '').trim();
  var note = String(data.note || '').trim();

  if (!name || !company || !email || !purposes.length || !comment) {
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
  var pendingStates = ['未認証', '承認待ち', '承認'];
  var existing = batonReadRequestRows().some(function (r) {
    return String(r['話したい人']) === profile.name &&
      String(r['メール']).toLowerCase() === email.toLowerCase() &&
      pendingStates.indexOf(String(r['状態'])) !== -1;
  });
  if (existing) {
    return { ok: false, error: 'duplicate', message: 'このプロフィールには、すでに申請済みです。' };
  }

  var requestId = batonNewId('req');
  var attachmentUrls = batonSaveAttachments(data.attachments);

  // このメールアドレスで、過去に1度でもメール認証を完了したことがあるか
  // （相手の承認・辞退・期限切れ、どの結果でも「認証日時」が入っていれば
  //   本人確認は済んでいるとみなし、2回目以降は認証メールを省略する）
  var alreadyVerified = batonReadRequestRows().some(function (r) {
    return String(r['メール']).toLowerCase() === email.toLowerCase() && r['認証日時'];
  });

  if (alreadyVerified) {
    batonAppendRequestRow({
      request_id: requestId,
      '申請日時': new Date(),
      '話したい人': profile.name,
      '申請者': name,
      '会社名': company,
      'メール': email,
      'コメント': comment,
      '状態': '未認証',
      '紹介済': false,
      'プロフィールURL': batonProfileUrl(profileId),
      'profile_id': profileId,
      '役職': title,
      '目的': purposes.join('、'),
      '備考': note,
      '添付資料': attachmentUrls.join('\n')
    });

    var newRow = batonFindRequestRow('request_id', requestId);
    batonActivateRequest(newRow, profile);
    batonSendApplicantMail(email, name, profile, profileId, null);
    return { ok: true };
  }

  var token = batonRandomToken();
  batonAppendRequestRow({
    request_id: requestId,
    '申請日時': new Date(),
    '話したい人': profile.name,
    '申請者': name,
    '会社名': company,
    'メール': email,
    'コメント': comment,
    '状態': '未認証',
    '紹介済': false,
    'プロフィールURL': batonProfileUrl(profileId),
    'profile_id': profileId,
    '役職': title,
    '目的': purposes.join('、'),
    '備考': note,
    '添付資料': attachmentUrls.join('\n'),
    '認証トークンhash': batonHashToken(token),
    '認証期限': new Date(Date.now() + BATON_VERIFY_TTL_MS)
  });

  batonSendApplicantMail(email, name, profile, profileId, token);
  return { ok: true };
}

// ── ③ Email Verify ──────────────────────────────────────────

function batonCheckVerify(token) {
  if (!token) return { ok: true, state: 'invalid' };
  var row = batonFindRequestRow('認証トークンhash', batonHashToken(token));
  if (!row) return { ok: true, state: 'invalid' };
  if (row['状態'] === '期限切れ') return { ok: true, state: 'expired' };
  if (row['状態'] !== '未認証') return { ok: true, state: 'used' };

  var expiresAt = row['認証期限'] ? new Date(row['認証期限']) : null;
  if (expiresAt && new Date() > expiresAt) return { ok: true, state: 'expired' };

  var profile = batonGetProfile(row['profile_id']);
  return { ok: true, state: 'ready', profileName: profile ? profile.name + '（' + profile.company + '）' : String(row['話したい人']) };
}

/**
 * 状態を「承認待ち」に進め、掲載者(本人)へ承認/辞退の依頼メールを送り、
 * 管理者にも通知する。メール認証直後、または後述の「認証スキップ」の
 * どちらから呼ばれても、この先の処理は完全に共通。
 */
function batonActivateRequest(row, profile) {
  var respondExpiresAt = new Date(Date.now() + BATON_RESPOND_TTL_MS);
  var respondToken = batonRandomToken();

  batonSetRequestCell(row._row, '状態', '承認待ち');
  batonSetRequestCell(row._row, '認証日時', new Date());
  batonSetRequestCell(row._row, '回答トークンhash', batonHashToken(respondToken));
  batonSetRequestCell(row._row, '回答期限', respondExpiresAt);
  batonSetRequestCell(row._row, '社長通知日時', new Date());

  batonSendRecipientMail(row, profile, respondToken, false);
  batonSendAdminMail(
    '【Baton】新規申請',
    batonRequestSummaryLines(row, profile).concat(['', '本人・社長の双方に、承認/辞退の依頼メールを送っています。'])
  );
}

function batonConfirmVerify(token) {
  if (!token) return { ok: false, error: 'invalid' };
  var row = batonFindRequestRow('認証トークンhash', batonHashToken(token));
  if (!row) return { ok: false, error: 'invalid' };
  if (row['状態'] === '期限切れ') return { ok: false, error: 'expired' };
  if (row['状態'] !== '未認証') return { ok: false, error: 'used' };

  var expiresAt = row['認証期限'] ? new Date(row['認証期限']) : null;
  if (expiresAt && new Date() > expiresAt) return { ok: false, error: 'expired' };

  var profile = batonGetProfile(row['profile_id']);
  if (!profile) return { ok: false, error: 'invalid' };

  batonActivateRequest(row, profile);
  return { ok: true };
}

// ── ④ Recipient（本人の承認/辞退） ────────────────────────────

function batonCheckRespond(token) {
  if (!token) return { ok: true, state: 'invalid' };
  var row = batonFindRequestRow('回答トークンhash', batonHashToken(token));
  if (!row) return { ok: true, state: 'invalid' };
  if (row['状態'] === '期限切れ') return { ok: true, state: 'expired' };
  if (row['状態'] !== '承認待ち') return { ok: true, state: 'used' };

  var expiresAt = row['回答期限'] ? new Date(row['回答期限']) : null;
  if (expiresAt && new Date() > expiresAt) return { ok: true, state: 'expired' };

  var profile = batonGetProfile(row['profile_id']);
  return {
    ok: true,
    state: 'ready',
    profileName: profile ? profile.name : String(row['話したい人']),
    request: {
      applicantName: row['申請者'],
      applicantCompany: row['会社名'],
      applicantTitle: row['役職'],
      purposes: row['目的'] ? String(row['目的']).split('、') : [],
      comment: row['コメント'],
      note: row['備考']
    }
  };
}

function batonRespondAction(token, decision) {
  if (decision !== 'approved' && decision !== 'declined') return { ok: false, error: 'invalid' };
  if (!token) return { ok: false, error: 'invalid' };

  var row = batonFindRequestRow('回答トークンhash', batonHashToken(token));
  if (!row) return { ok: false, error: 'invalid' };
  if (row['状態'] === '期限切れ') return { ok: false, error: 'expired' };
  if (row['状態'] !== '承認待ち') return { ok: false, error: 'used' };

  var expiresAt = row['回答期限'] ? new Date(row['回答期限']) : null;
  if (expiresAt && new Date() > expiresAt) return { ok: false, error: 'expired' };

  var profile = batonGetProfile(row['profile_id']);
  if (!profile) return { ok: false, error: 'invalid' };

  var statusLabel = decision === 'approved' ? '承認' : '辞退';
  batonSetRequestCell(row._row, '状態', statusLabel);
  batonSetRequestCell(row._row, '本人回答', statusLabel);
  batonSetRequestCell(row._row, '本人回答日時', new Date());
  batonSetRequestCell(row._row, '社長通知日時', new Date());

  // 申請の可否は、社長(NOTIFY_TO)にだけ通知する。申請者へは自動送信しない
  // （紹介するかどうか・どう伝えるかは、社長が個別に判断して連絡する）
  batonSendAdminMail(
    decision === 'approved' ? '【Baton】承認' : '【Baton】辞退',
    batonRequestSummaryLines(row, profile).concat([
      '',
      decision === 'approved'
        ? '本人が承認しました。紹介方法・タイミングはこちらでご判断ください（連絡先の自動共有はしていません）。'
        : '本人が辞退しました。この申請はここで終了です。'
    ])
  );

  return { ok: true };
}

// ── メール本文の共通部分 / 管理者通知 ───────────────────────────

function batonRequestSummaryLines(row, profile) {
  return [
    'プロフィール: ' + profile.name + '（' + profile.company + '）',
    '申請者     : ' + row['申請者'] + ' / ' + row['会社名'] + ' / ' + (row['役職'] || '(未記入)'),
    'メール     : ' + row['メール'],
    '目的       : ' + row['目的'],
    'コメント   : ' + row['コメント'],
    '補足       : ' + (row['備考'] || '(なし)'),
    '添付資料   : ' + (row['添付資料'] || '(なし)')
  ];
}

function batonSendAdminMail(subject, bodyLines) {
  MailApp.sendEmail({ to: NOTIFY_TO, subject: subject, body: bodyLines.join('\n') });
}

function batonSendRecipientMail(row, profile, token, isReminder) {
  var recipient = profile.recipientEmail;
  if (!recipient) return;

  var lines = [
    (isReminder ? '（リマインドです）' : '') + profile.name + ' 様',
    '',
    'あなたと話したいという方から、Batonを通じて申請が届いています。',
    ''
  ].concat(batonRequestSummaryLines(row, profile)).concat([
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
  var rows = batonReadRequestRows();

  rows.forEach(function (row) {
    if (row['状態'] === '未認証') {
      var verifyExpires = row['認証期限'] ? new Date(row['認証期限']) : null;
      if (verifyExpires && now > verifyExpires) {
        batonSetRequestCell(row._row, '状態', '期限切れ');
      }
      return;
    }

    if (row['状態'] !== '承認待ち') return;

    var respondExpires = row['回答期限'] ? new Date(row['回答期限']) : null;
    if (respondExpires && now > respondExpires) {
      batonSetRequestCell(row._row, '状態', '期限切れ');
      var profileForExpire = batonGetProfile(row['profile_id']);
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

    if (!row['リマインド日時'] && row['認証日時'] && now - new Date(row['認証日時']) >= BATON_REMIND_AFTER_MS) {
      var profile = batonGetProfile(row['profile_id']);
      if (!profile) return;

      var token = batonRandomToken();
      batonSetRequestCell(row._row, '回答トークンhash', batonHashToken(token));
      batonSetRequestCell(row._row, '回答期限', respondExpires || new Date(Date.now() + BATON_RESPOND_TTL_MS));
      batonSendRecipientMail(row, profile, token, true);
      batonSetRequestCell(row._row, 'リマインド日時', now);
    }
  });
}

/**
 * 動作確認用。kabeya プロフィールへテスト申請を1件作り、
 * 認証メールが届くところまで確認できる。届いたら、そのメールのリンクを
 * 実際に開いて手続きを進めてよい（テスト行は確認後に手で消してよい）。
 */
function testBatonFlow() {
  var result = batonSubmitTalk({
    profileId: 'kabeya',
    applicant: { name: 'テスト太郎', company: '【テスト】株式会社サンプル', title: '代表取締役', email: 'test@example.com' },
    purposes: ['情報交換'],
    comment: 'これは動作確認用のテスト送信です。',
    note: '',
    attachments: [],
    hp: ''
  });

  Logger.log('結果: ' + JSON.stringify(result));
  if (result.ok) {
    batonToast(
      'BATON_REQUESTS に1件入りました。test@example.com 宛の認証メールを確認してください', 'テスト成功', 8);
  } else {
    batonToast('失敗: ' + JSON.stringify(result), 'テスト', 8);
  }
}

/**
 * unveilプロフィール専用の動作確認用。
 *
 * 現在 BATON_PROFILES.unveil.recipientEmail は、古谷様にまだ見せていない
 * 社内テスト段階のため、Owner自身のアドレスに暫定設定してある
 * （active: true）。この状態で実行すると、BATON_REQUESTS に1件入り、
 * test@example.com 宛の認証メールが飛ぶところまで確認できる。そのメールの
 * リンクを開いて認証を完了すると、今度は recipientEmail（現在はOwner自身の
 * アドレス）宛に承認/辞退の依頼メールが飛ぶところまで確認できる。
 *
 * 古谷様に実際に見せる段階になったら、recipientEmail を古谷様ご本人の
 * 受信用メールアドレスに差し替えること。差し替え後にもう一度これを実行し、
 * 本番で最初の申請者を待たせる前に、必ず一度自分で通しておくこと。
 */
function testBatonFlowUnveil() {
  var result = batonSubmitTalk({
    profileId: 'unveil',
    applicant: { name: 'テスト太郎', company: '【テスト】株式会社サンプル', title: '代表取締役', email: 'test@example.com' },
    purposes: ['協業'],
    comment: 'これは動作確認用のテスト送信です。',
    note: '',
    attachments: [],
    hp: ''
  });

  Logger.log('結果: ' + JSON.stringify(result));
  if (result.ok) {
    batonToast(
      'BATON_REQUESTS に1件入りました。test@example.com 宛の認証メールを確認してください', 'テスト成功', 8);
  } else {
    batonToast('失敗: ' + JSON.stringify(result), 'テスト', 8);
  }
}
