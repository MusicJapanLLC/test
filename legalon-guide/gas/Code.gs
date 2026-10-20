/**
 * ═══════════════════════════════════════════════════════════════
 *  LegalOn ご紹介ページ「話してみる」の回答をメールで受け取る / Google Apps Script
 * ═══════════════════════════════════════════════════════════════
 *
 *  回答は NOTIFY_TO（music.japan.llc@gmail.com）にだけ届く。
 *  スプレッドシートには書かない。メール本文の最後に、シートへそのまま貼れる
 *  タブ区切りの1行を付けている（列の順番は FIELDS と同じ）。
 *
 *  ■ 設置手順（3分）
 *  1. https://script.google.com/ を開き「新しいプロジェクト」
 *  2. エディタの中身をすべて消して、このファイルの内容を貼り付けて保存
 *  3. 関数選択で testMail を選んで「実行」（初回は権限を許可）
 *       → music.japan.llc@gmail.com にテストのメールが1通届けばOK
 *  4. 右上の「デプロイ」→「新しいデプロイ」→ 歯車 →「ウェブアプリ」
 *       実行ユーザー：自分　／　アクセスできるユーザー：全員
 *  5. 表示された「ウェブアプリのURL」（…/exec）をコピーして、Claudeに渡す
 *       → Vercel の環境変数 GAS_ENDPOINT に入れて、ページを再デプロイする
 *
 *  ■ 疎通確認
 *     コピーしたURLをブラウザで開いて「OK」と出れば届いている。
 *
 *  ■ コードを直したら
 *     「デプロイを管理」→ 鉛筆 → バージョン「新バージョン」で更新する。
 *     新しいデプロイを作るとURLが変わるので注意。
 * ═══════════════════════════════════════════════════════════════
 */

/** 回答メールの宛先（ここ以外には送らない） */
var NOTIFY_TO = 'music.japan.llc@gmail.com';
var SENDER_NAME = 'LegalOn ご紹介ページ';
var TZ = 'Asia/Tokyo';

/** メールに並べる順番（スプレッドシートの列と同じ） */
var FIELDS = [
  ['company', '会社名'],
  ['name', 'ご担当者名'],
  ['email', 'メールアドレス'],
  ['role', '役職'],
  ['capital', '資本金'],
  ['employees', '従業員数'],
  ['q1', 'Q1. 月間の契約書レビュー件数はどの程度ですか？'],
  ['q2', 'Q2. 現在の法務体制について、最も近いものをお選びください。'],
  ['q3', 'Q3. 契約書レビューに関して、現在あてはまる課題を教えてください。'],
  ['q4', 'Q4. 今回、サービス導入を検討するにあたり、最も知りたいことは何ですか？（複数選択可・必須）'],
  ['q5', 'その他にご興味のある領域があれば教えてください。（複数選択可）'],
  ['tel', '電話番号']
];

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function doGet() {
  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    var id = sendAnswer_(p);
    return json_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false });
  }
}

/** 権限の許可と、届くかどうかの確認用 */
function testMail() {
  sendAnswer_({
    company: '（テスト）株式会社サンプル',
    name: 'テスト 太郎',
    email: 'test@example.com',
    role: '法務責任者',
    capital: '1,000万円',
    employees: '50名',
    q1: '5〜10件',
    q2: '法務担当が1〜3名いる',
    q3: ['時間がかかる', '見落としがないか不安'],
    q4: ['料金プラン', '機能とAIの精度'],
    q5: [],
    tel: '03-0000-0000'
  });
}

function sendAnswer_(p) {
  var now = new Date();
  var id = 'LO-' + Utilities.formatDate(now, TZ, 'yyMMdd-HHmmss');
  var at = Utilities.formatDate(now, TZ, 'yyyy/MM/dd HH:mm');

  var value = function (key) {
    var v = p[key];
    if (Array.isArray(v)) v = v.map(function (s) { return clip_(s, 80); }).join(' / ');
    return clip_(v, 400);
  };

  var company = value('company') || '（会社名なし）';
  var name = value('name') || '（お名前なし）';

  var blocks = FIELDS.map(function (f) {
    return '■ ' + f[1] + '\n' + (value(f[0]) || '（未回答）');
  });

  /* シートに貼ったとき数式として読まれないように、先頭の = + - @ は ' を付ける */
  var tsv = FIELDS.map(function (f) {
    var v = value(f[0]).replace(/[\t\r\n]+/g, ' ');
    return /^[=+\-@]/.test(v) ? "'" + v : v;
  }).join('\t');

  var body = [
    'LegalOn ご紹介ページの「話してみる」に、新しい回答が届きました。',
    '',
    '受付番号：' + id,
    '受付日時：' + at,
    '',
    blocks.join('\n\n'),
    '',
    '────────────────',
    'スプレッドシートに貼る1行（タブ区切り・上と同じ順番）',
    tsv
  ].join('\n');

  var mail = {
    to: NOTIFY_TO,
    subject: '【LegalOn】新しい回答：' + company + '（' + name + ' 様）',
    body: body,
    name: SENDER_NAME
  };
  var reply = value('email');
  if (EMAIL_RE.test(reply)) mail.replyTo = reply;

  MailApp.sendEmail(mail);
  return id;
}

function clip_(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
