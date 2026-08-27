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

/** 疎通確認用。ブラウザでURLを開くと OK と表示される */
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
