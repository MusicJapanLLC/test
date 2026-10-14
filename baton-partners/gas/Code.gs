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
 *      → 企業設定に未登録の企業IDで届いた相談も、記録と社長への通知はする（企業通知は「未登録」。登録後も過去の分は送らない）
 *   4. 月初に、前月の件数を各企業と社長へ送る（sendMonthlySummary をトリガー登録）
 *   5. 社長がステータスを「紹介済み」にした相談だけ、その企業との共有管理表（案件のタブ）へ1行足す
 *      → 紹介日・紹介企業・氏名・進捗「日程調整中」・受付番号を書く。双方の了承後なので、ここで初めて社名と氏名が先方に見える
 *      → 共有管理表がない企業（PARTNERS に sheetId がない）は何もしない。足した行は「共有表」列に記録し、二度足さない
 *      → 1時間おきの retryPartnerNotices の最後に実行する（すぐ反映したいときはメニューから）
 *
 * 設置手順
 *   1. 記録用のスプレッドシートを作り、［拡張機能］→［Apps Script］にこのファイルを貼る
 *   2. ［プロジェクトの設定］→［スクリプト プロパティ］に次の2つを登録する
 *        OWNER_EMAIL = 社長のメールアドレス
 *        PARTNERS    = {"evorg":{"name":"株式会社エボルグ","emails":["担当者@evorg.co.jp"],"notify":true,"sheetId":"共有管理表のID（任意）"}}
 *      （企業のメールアドレスはリポジトリに置かない。ここにだけ書く）
 *      企業の設定は、ドライブのスプレッドシート「Baton Partners｜企業設定」に1社1行で書いてもよい（こちらが優先）
 *        列：企業ID / 企業名 / 通知先メール（カンマ区切り） / 通知（TRUE・FALSE） / 共有管理表ID / 共有管理表のタブ / メモ
 *        名前で自動で探す。別の名前にしたときは、スクリプトプロパティ PARTNERS_SHEET_ID にそのIDを入れる
 *        同じ企業IDが PARTNERS にもあるときは、企業設定の行を使う。書き換えは5分以内に反映される
 *      どちらも、スプレッドシートのメニュー［Baton Partners］→［企業を追加・更新］から足せる（企業設定があればそちらへ書く）
 *      任意：FILES_FOLDER_ID = 添付資料を置くドライブのフォルダID（未設定なら初回に自動で作る）
 *   3. setupSheets() を1回実行して、シートと見出しを作る（ドライブの権限もここで許可する）
 *   4. ［デプロイ］→［新しいデプロイ］→ 種類「ウェブアプリ」
 *        実行ユーザー：自分 / アクセスできるユーザー：全員
 *      表示された URL を、サイトの環境変数 VITE_GAS_ENDPOINT に設定する
 *   5. ［トリガー］で sendMonthlySummary を「月ベースのタイマー / 1日 / 午前9〜10時」に登録する
 *   6. ［トリガー］で retryPartnerNotices を「時間ベースのタイマー / 1時間おき」に登録する
 *
 * コードを貼り替えたとき（すでに設置済みの場合）
 *   ・setupSheets() をもう一度実行する（見出しに「共有表」列が増える。共有管理表を開く権限もここで許可する）
 *   ・［デプロイ］→［デプロイを管理］→ 鉛筆 →［バージョン：新バージョン］→［デプロイ］。URL は変わらない
 */

const SHEET_NAME = '相談';
const HEADERS = [
  '受付日時', '受付番号', '企業ID', '企業名', '流入',
  '会社名', 'お名前', 'メールアドレス', '役職',
  '回答', 'ひとこと', 'ポートフォリオURL', '資料', 'ページ', '企業通知',
  'ステータス', '商談化', 'メモ', '共有表',
];
const MAX_LEN = 2000;
// 添付の上限（サイト側の client/submit.ts と揃える）
const FILE_MAX_TOTAL = 30 * 1024 * 1024;
const FILE_MAX_COUNT = 5;
const FILE_EXT = /\.(pdf|pptx?|key|docx?|xlsx?|csv|png|jpe?g|gif|webp|zip)$/i;
const FILES_FOLDER_NAME = 'Baton Partners｜相談の添付資料';
// 企業との共有管理表：見出しの行（「紹介日」がある行）を、上から何行目まで探すか
const SHARED_HEAD_SCAN = 12;
// 企業設定のスプレッドシート（ドライブで名前から探す）と、その見出し
const REGISTRY_NAME = 'Baton Partners｜企業設定';
const REGISTRY_HEADERS = ['企業ID', '企業名', '通知先メール', '通知', '共有管理表ID', '共有管理表のタブ', 'メモ'];
const REGISTRY_CACHE_SEC = 300;

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
    let partner = partners[data.partnerId];
    if (!partner) {
      // 企業設定に未登録の企業でも、相談は捨てない（サイトは no-cors で送るため、ここで断っても画面には「送信完了」と出てしまう）。
      // 記録して社長へは全文を送り、企業への通知だけ「未登録」にする
      if (!/^[a-z0-9-]{2,40}$/.test(String(data.partnerId || ''))) return json_({ ok: false, error: 'unknown partner' });
      partner = { name: `${data.partnerId}（企業設定に未登録）`, emails: [], notify: false, unregistered: true };
    }

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
        '未確認', false, '', '',
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
  if (partner.unregistered) return '未登録';
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
  // 「紹介済み」にした相談を、企業との共有管理表へ（失敗しても通知の再送は止めない）
  try {
    syncSharedSheets();
  } catch (err) {
    console.error(err);
  }
}

/**
 * ステータスが「紹介済み」で、まだ共有管理表に足していない相談を、企業ごとの共有管理表へ1行ずつ足す。
 * 共有管理表は、見出しに「紹介日」「紹介企業」「氏名」「商談日」「進捗／結果」「備考」がある表（列の順番は問わない）。
 * 書くもの：紹介日＝反映した日、紹介企業＝会社名、氏名＝お名前＋様、進捗＝日程調整中、備考＝受付番号。商談日は空欄（社長か先方が入れる）。
 * 回答内容・メールアドレス・資料は書かない。
 */
function syncSharedSheets() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  const partners = getPartners_();
  const values = sheet.getDataRange().getValues();
  const c = function (name) { return HEADERS.indexOf(name); };
  const opened = {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      if (r[c('ステータス')] !== '紹介済み' || String(r[c('共有表')] || '') !== '') continue;
      const partner = partners[r[c('企業ID')]];
      if (!partner || !partner.sheetId) continue;
      let state;
      try {
        const target = opened[partner.sheetId] || (opened[partner.sheetId] = sharedTable_(partner));
        state = appendShared_(target, String(r[c('受付番号')]), String(r[c('会社名')]), String(r[c('お名前')]));
      } catch (err) {
        console.error(err);
        state = `失敗：${String(err && err.message || err).slice(0, 80)}`;
      }
      sheet.getRange(i + 1, c('共有表') + 1).setValue(state);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 任意：［トリガー］→「スプレッドシートから / 編集時」で onStatusEdit を登録すると、
 * ステータスを「紹介済み」にした直後に共有管理表へ反映する（登録しなくても1時間以内に反映される）
 */
function onStatusEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== SHEET_NAME) return;
  if (e.range.getColumn() !== HEADERS.indexOf('ステータス') + 1 || e.value !== '紹介済み') return;
  syncSharedSheets();
}

// ── スプレッドシートのメニュー：企業の登録（PARTNERS を手で書かなくてよいように） ──

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Baton Partners')
    .addItem('企業を追加・更新', 'addOrUpdatePartner')
    .addItem('登録済みの企業を見る', 'showPartners')
    .addSeparator()
    .addItem('紹介済みを共有管理表へ反映', 'syncSharedSheets')
    .addToUi();
}

/**
 * 企業IDから順に聞いて、PARTNERS に足す（同じIDなら上書き）。空欄のまま OK を押した項目は、登録済みの値をそのまま使う。
 * 共有管理表の URL を入れると、開けるか・見出しがあるかをその場で確かめる。
 */
function addOrUpdatePartner() {
  const ui = SpreadsheetApp.getUi();
  const ask = function (title, hint) {
    const res = ui.prompt(title, hint, ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) throw new Error('cancel');
    return res.getResponseText().trim();
  };
  try {
    const id = ask('企業ID', 'サイトのURLの企業ID（例：dp-partners）');
    if (!/^[a-z0-9-]+$/.test(id)) return ui.alert('企業IDは半角の英小文字・数字・ハイフンだけです。');
    const partners = getPartners_();
    const now = partners[id] || {};
    const keep = function (v, old) { return v === '' ? old : v; };
    const name = keep(ask('企業名', `正式な社名（いま：${now.name || '未登録'}）`), now.name);
    if (!name) return ui.alert('企業名が空です。');
    const mails = keep(ask('通知先のメールアドレス', `カンマ区切りで複数可（いま：${(now.emails || []).join(', ') || '未登録'}）`), (now.emails || []).join(','));
    const emails = String(mails || '').split(/[,、\s]+/).filter(Boolean);
    const bad = emails.filter(function (m) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m); });
    if (bad.length) return ui.alert(`メールアドレスの形が正しくありません：${bad.join(', ')}`);
    const notify = ui.alert('通知', `${name} へ「新しい相談が1件」と月初の件数を送りますか？`, ui.ButtonSet.YES_NO) === ui.Button.YES;
    const url = ask('共有管理表（任意）', `「紹介済み」の相談を足す共有スプレッドシートのURL。ないときは空欄、外すときは「なし」（いま：${now.sheetId ? '登録済み' : '未登録'}）`);
    const sheetId = url === 'なし' ? '' : url === '' ? now.sheetId || '' : (url.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || url;
    const entry = { name: name, emails: emails, notify: notify };
    if (sheetId) {
      entry.sheetId = sheetId;
      const t = sharedTable_(entry); // 開けない・見出しがないときは、ここで止まって理由を出す
      entry.sheetTab = t.sheet.getName();
    }
    const reg = registrySheet_();
    if (reg) {
      writeRegistry_(reg, id, entry);
    } else {
      const own = propPartners_();
      own[id] = entry;
      PropertiesService.getScriptProperties().setProperty('PARTNERS', JSON.stringify(own));
    }
    CacheService.getScriptCache().remove('registry');
    ui.alert('登録しました', `${describePartner_(id, entry)}\n保存先：${reg ? REGISTRY_NAME : 'スクリプトプロパティ PARTNERS'}`, ui.ButtonSet.OK);
  } catch (err) {
    if (String(err && err.message) === 'cancel') return;
    ui.alert(`登録できませんでした：${String(err && err.message || err)}`);
  }
}

function showPartners() {
  const partners = getPartners_();
  const ids = Object.keys(partners);
  SpreadsheetApp.getUi().alert('登録済みの企業', ids.length ? ids.map(function (id) { return describePartner_(id, partners[id]); }).join('\n\n') : 'まだありません。', SpreadsheetApp.getUi().ButtonSet.OK);
}

function describePartner_(id, p) {
  return [
    `${id}｜${p.name}${p.from ? `（${p.from}）` : ''}`,
    `通知：${p.notify === false ? '止めている' : '送る'}（${(p.emails || []).join(', ') || '宛先なし'}）`,
    `共有管理表：${p.sheetId ? `あり（${p.sheetTab || '自動で探す'}）` : 'なし'}`,
  ].join('\n');
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

/** 企業の共有管理表を開き、「紹介日」の見出しがあるタブと列の位置を返す */
function sharedTable_(partner) {
  const ss = SpreadsheetApp.openById(partner.sheetId);
  const tabs = partner.sheetTab ? [ss.getSheetByName(partner.sheetTab)].filter(Boolean) : ss.getSheets();
  for (let t = 0; t < tabs.length; t++) {
    const sh = tabs[t];
    const rows = Math.min(SHARED_HEAD_SCAN, sh.getLastRow());
    if (rows < 1) continue;
    const head = sh.getRange(1, 1, rows, sh.getLastColumn()).getValues();
    for (let r = 0; r < head.length; r++) {
      const cols = head[r].map(function (v) { return String(v).trim(); });
      if (cols.indexOf('紹介日') === -1 || cols.indexOf('紹介企業') === -1) continue;
      const at = function (names) {
        for (let k = 0; k < names.length; k++) if (cols.indexOf(names[k]) !== -1) return cols.indexOf(names[k]);
        return -1;
      };
      return {
        sheet: sh,
        headRow: r + 1,
        width: cols.length,
        col: { date: at(['紹介日']), company: at(['紹介企業']), name: at(['氏名', 'お名前']), status: at(['進捗／結果', '進捗/結果', '進捗']), note: at(['備考']) },
      };
    }
  }
  throw new Error(`共有管理表に「紹介日」「紹介企業」の見出しが見つかりません（${ss.getName()}）`);
}

/** 共有管理表の最後の行の下へ1行足す。備考に同じ受付番号があれば足さない */
function appendShared_(t, receiptId, company, person) {
  const sh = t.sheet;
  const last = sh.getLastRow();
  if (t.col.note !== -1 && last > t.headRow) {
    const notes = sh.getRange(t.headRow + 1, t.col.note + 1, last - t.headRow, 1).getValues();
    if (notes.some(function (r) { return String(r[0]).indexOf(receiptId) !== -1; })) return '反映済み（すでにあり）';
  }
  const row = new Array(t.width).fill('');
  const today = new Date();
  row[t.col.date] = today;
  row[t.col.company] = clean_(company);
  if (t.col.name !== -1) row[t.col.name] = clean_(/様$/.test(person) ? person : `${person}様`);
  if (t.col.status !== -1) row[t.col.status] = '日程調整中';
  if (t.col.note !== -1) row[t.col.note] = `Baton Partners 経由（受付番号 ${receiptId}）`;
  const at = Math.max(last, t.headRow) + 1;
  sh.getRange(at, 1, 1, t.width).setValues([row]);
  sh.getRange(at, t.col.date + 1).setNumberFormat('yyyy/m/d');
  return `反映済み ${Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy/MM/dd')}`;
}

/** 企業の設定：スクリプトプロパティ PARTNERS に、企業設定のスプレッドシートの行を重ねる（同じIDは企業設定が優先） */
function getPartners_() {
  const partners = propPartners_();
  Object.keys(partners).forEach(function (id) { partners[id].from = 'スクリプトプロパティ'; });
  const reg = readRegistry_();
  Object.keys(reg).forEach(function (id) { partners[id] = reg[id]; });
  return partners;
}

function propPartners_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PARTNERS') || '{}';
  return JSON.parse(raw);
}

/** 企業設定のスプレッドシート。PARTNERS_SHEET_ID があればそれ、なければドライブで名前から探す。ないときは null */
function registrySheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('PARTNERS_SHEET_ID');
  let ss = null;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    const files = DriveApp.getFilesByName(REGISTRY_NAME);
    while (files.hasNext()) {
      const f = files.next();
      if (f.getMimeType() === MimeType.GOOGLE_SHEETS && !f.isTrashed()) {
        ss = SpreadsheetApp.openById(f.getId());
        break;
      }
    }
  }
  return ss ? ss.getSheets()[0] : null;
}

/** 企業設定の行を読む（5分キャッシュ）。読めないときは空のまま進め、PARTNERS だけで動く */
function readRegistry_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('registry');
  if (hit) return JSON.parse(hit);
  const out = {};
  try {
    const sh = registrySheet_();
    if (sh && sh.getLastRow() > 1) {
      const values = sh.getDataRange().getValues();
      const head = values[0].map(function (v) { return String(v).trim(); });
      const c = function (name) { return head.indexOf(name); };
      values.slice(1).forEach(function (r) {
        const id = String(r[c('企業ID')] || '').trim();
        if (!/^[a-z0-9-]+$/.test(id)) return;
        const flag = String(r[c('通知')]).trim().toUpperCase();
        const entry = {
          name: String(r[c('企業名')] || id).trim(),
          emails: String(r[c('通知先メール')] || '').split(/[,、\s]+/).filter(Boolean),
          notify: !(flag === 'FALSE' || flag === 'いいえ' || flag === '止める' || r[c('通知')] === false),
          from: REGISTRY_NAME,
        };
        const sheetId = c('共有管理表ID') === -1 ? '' : String(r[c('共有管理表ID')] || '').trim();
        if (sheetId) entry.sheetId = (sheetId.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || sheetId;
        const tab = c('共有管理表のタブ') === -1 ? '' : String(r[c('共有管理表のタブ')] || '').trim();
        if (tab) entry.sheetTab = tab;
        out[id] = entry;
      });
    }
  } catch (err) {
    console.error(err);
  }
  cache.put('registry', JSON.stringify(out), REGISTRY_CACHE_SEC);
  return out;
}

/** 企業設定に1行書く（同じ企業IDの行があれば上書き、なければ最後に足す） */
function writeRegistry_(sh, id, entry) {
  const values = sh.getDataRange().getValues();
  let head = values[0].map(function (v) { return String(v).trim(); });
  if (head.indexOf('企業ID') === -1) {
    sh.getRange(1, 1, 1, REGISTRY_HEADERS.length).setValues([REGISTRY_HEADERS]).setFontWeight('bold');
    head = REGISTRY_HEADERS.slice();
  }
  const c = function (name) { return head.indexOf(name); };
  const row = head.map(function () { return ''; });
  let at = sh.getLastRow() + 1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][c('企業ID')]).trim() === id) {
      at = i + 1;
      values[i].forEach(function (v, k) { row[k] = v; });
      break;
    }
  }
  row[c('企業ID')] = id;
  row[c('企業名')] = entry.name;
  row[c('通知先メール')] = (entry.emails || []).join(', ');
  row[c('通知')] = entry.notify !== false;
  if (c('共有管理表ID') !== -1) row[c('共有管理表ID')] = entry.sheetId || '';
  if (c('共有管理表のタブ') !== -1) row[c('共有管理表のタブ')] = entry.sheetTab || '';
  sh.getRange(at, 1, 1, row.length).setValues([row]);
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
