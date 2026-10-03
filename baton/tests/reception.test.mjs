import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

const source = readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
const requestHeaders = ['request_id','申請日時','話したい人','申請者','会社名','メール','コメント','状態','本人回答','本人回答日時','社長通知日時','紹介済','紹介日時','プロフィールURL','profile_id','役職','目的','備考','添付資料','認証トークンhash','認証期限','認証日時','回答トークンhash','回答期限','リマインド日時'];
const ownerHeaders = ['メール','備考','登録日','氏名','会社名','許可状態','profile_id','プロフィールURL','プロフィール公開状態','通知有効'];

class Sheet {
  constructor(data) { this.data = data; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return Math.max(...this.data.map(r => r.length)); }
  appendRow(row) { this.data.push(row); }
  getRange(row, col, height = 1, width = 1) {
    return {
      getValues: () => Array.from({length:height}, (_, r) => Array.from({length:width}, (_, c) => this.data[row+r-1]?.[col+c-1] ?? '')),
      setValue: value => { this.data[row-1] ??= []; this.data[row-1][col-1] = value; },
    };
  }
}
function harness() {
  // 既存の空行・紹介済チェック欄も保持する。
  const requests = new Sheet([requestHeaders, Array.from({length:25}, (_,i) => i === 11 ? false : '')]);
  const owners = new Sheet([ownerHeaders,
    ['jun.matsuura@central-ax.co.jp','','','松浦 淳','株式会社Central AX','許可済','matsuura','https://baton.music-japan.com/profile/matsuura/','公開中','有効'],
    ['','','','石井 嵩大','株式会社C.C','許可済','','','未作成','無効'],
    ['k.miyamoto@zettaichi.co.jp','','','宮本さん','ZETTAICHI','許可済','','','未作成','無効']]);
  const mails = [], cache = new Map(), accessed = [];
  let locked = false;
  const lock = {waitLock(){assert.equal(locked,false);locked=true;},tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;}};
  const context = vm.createContext({
    SpreadsheetApp:{openById(id){assert.equal(id,'1e5fVGFQiUOx_HMVaTTj6C4TLNI2Pi5Hx2-gnoOnCiew');return {getSheetByName(name){accessed.push(name);return name==='BATON_REQUESTS'?requests:name==='Baton：許可リスト'?owners:null;}};}},
    MailApp:{sendEmail(mail){mails.push(mail);}},
    CacheService:{getScriptCache(){return {get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)};}},
    LockService:{getScriptLock(){return lock;}},
    Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
    ContentService:{MimeType:{JSON:'json'},createTextOutput(text){return {setMimeType(){return this;},getContent(){return text;}};}},
    Logger:{log(){}},
  });
  vm.runInContext(source, context);
  const post = data => JSON.parse(context.doPost({postData:{contents:JSON.stringify(data)}}).getContent());
  const submit = (email = 'owner-test@example.org') => post({action:'baton_talk_submit',profileId:'matsuura',applicant:{name:'受付テスト',company:'【テスト】Music Japan',title:'代表取締役',email},purposes:['情報交換'],comment:'連携確認',note:'テスト',attachments:[],hp:''});
  const row = () => Object.fromEntries(requestHeaders.map((h,i)=>[h,requests.data.at(-1)[i]]));
  const token = mail => new URL(mail.body.match(/https:\/\/[^\s]+\?t=[^\s]+/)[0]).searchParams.get('t');
  return {context,requests,owners,mails,cache,accessed,post,submit,row,token};
}

for (const decision of ['approved','declined']) test(`申請→認証→${decision}→管理者通知、連絡先を共有しない`, () => {
  const h = harness();
  assert.equal(h.submit().ok,true);
  assert.equal(h.requests.data.length,3);
  assert.deepEqual(h.requests.data[1],Array.from({length:25},(_,i)=>i===11?false:''));
  assert.equal(h.row().profile_id,'matsuura');
  assert.equal(h.row()['話したい人'],'松浦 淳');
  assert.equal(h.row()['会社名'],'【テスト】Music Japan');
  assert.equal(h.row()['役職'],'代表取締役');
  assert.equal(h.row()['目的'],'情報交換');
  assert.equal(h.row()['コメント'],'連携確認');
  assert.equal(h.row()['状態'],'未認証');
  assert.equal(h.mails.length,1);
  assert.equal(h.mails[0].to,'owner-test@example.org');
  const verify = h.token(h.mails[0]);
  assert.notEqual(h.row()['認証トークンhash'],verify);
  assert.equal(h.post({action:'baton_verify_confirm',t:verify}).ok,true);
  assert.equal(h.mails.length,3);
  assert.equal(h.row()['状態'],'承認待ち');
  assert.equal(h.mails[1].to,'jun.matsuura@central-ax.co.jp');
  assert.ok(!h.mails[1].body.includes('owner-test@example.org'));
  const respond = h.token(h.mails[1]);
  assert.notEqual(h.row()['回答トークンhash'],respond);
  assert.equal(h.post({action:'baton_verify_confirm',t:verify}).error,'used');
  assert.equal(h.post({action:'baton_respond_action',t:respond,decision}).ok,true);
  assert.equal(h.row()['本人回答'],decision==='approved'?'承認':'辞退');
  assert.equal(h.mails.length,4);
  assert.equal(h.mails[3].to,'music.japan.llc@gmail.com');
  assert.equal(h.post({action:'baton_respond_action',t:respond,decision}).error,'used');
  assert.equal(h.row()['紹介済'],false);
  assert.equal(h.row()['紹介日時'],'');
  assert.ok(!h.accessed.some(n=>['会話ログ','紹介チェック','紹介履歴_RAW'].includes(n)));
});

test('未掲載・通知無効・未許可・重複登録・不明profileを拒否する', () => {
  const h = harness();
  assert.equal(h.context.batonGetProfile('kabeya'),null);
  assert.equal(h.context.batonGetProfile('unknown'),null);
  assert.equal(h.context.batonGetProfile('ishii'),null);
  h.owners.data[1][9]='無効'; assert.equal(h.submit().ok,false);
  h.owners.data[1][9]='有効'; h.owners.data[1][5]='未許可'; assert.equal(h.submit().ok,false);
  h.owners.data[1][5]='許可済'; h.owners.data.push([...h.owners.data[1]]); assert.equal(h.submit().ok,false);
  assert.equal(h.mails.length,0);
});

test('再申請・二重送信でレコードやメールを増やさない', () => {
  const h = harness(); h.submit(); h.cache.clear();
  assert.equal(h.submit().error,'duplicate');
  assert.equal(h.requests.data.length,3); assert.equal(h.mails.length,1);
});

test('過去の認証済みメールでも今回の認証を省略しない', () => {
  const h = harness(); h.submit();
  const previous = h.requests.data.at(-1);
  previous[7]='辞退'; previous[21]=new Date(); h.cache.clear();
  assert.equal(h.submit().ok,true);
  assert.equal(h.row()['状態'],'未認証');
  assert.equal(h.mails.length,2);
  assert.ok(h.mails.every(m=>m.to==='owner-test@example.org'));
});

test('3日後のリマインドは1回、7日後は期限切れ', () => {
  const h = harness(); h.submit();
  h.post({action:'baton_verify_confirm',t:h.token(h.mails[0])});
  const r=h.requests.data.at(-1); r[21]=new Date(Date.now()-4*86400000);
  h.context.batonDailyJob(); h.context.batonDailyJob();
  assert.equal(h.mails.filter(m=>m.subject.includes('再送')).length,1);
  assert.ok(r[24]); r[23]=new Date(Date.now()-1000);
  h.context.batonDailyJob(); h.context.batonDailyJob();
  assert.equal(h.row()['状態'],'期限切れ');
  assert.equal(h.mails.filter(m=>m.subject==='【Baton】期限切れ').length,1);
});

test('期限切れ認証と未知のAPIは書き込みや通知をしない', () => {
  const h=harness(); h.submit(); const t=h.token(h.mails[0]);
  h.requests.data.at(-1)[20]=new Date(Date.now()-1000);
  assert.equal(h.post({action:'baton_verify_confirm',t}).error,'expired');
  assert.equal(h.post({action:'baton_wrong'}).error,'unknown_action');
  assert.equal(h.mails.length,1);
});
