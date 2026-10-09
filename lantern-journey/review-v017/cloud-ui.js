/* Opt-in cloud backup screen. Local play stays authoritative until the player chooses a record. */
(function(scope){'use strict';
  let config=null,client=null,session=null,cloud=null,hooks=null,user=null,remote=null;
  let busy=false,active=false,error='',email='',codeSent=false,mode='compare',review=null,pendingUpload=null,sdkLoading=null;
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,label,cls='',disabled=false)=>`<button data-act="${action}" class="${cls}" ${disabled||busy?'disabled':''}>${label}</button>`;
  const uuid=()=>scope.crypto.randomUUID();
  function configure(value){
    if(busy)return false;
    config=null;client=null;session=null;cloud=null;user=null;remote=null;pendingUpload=null;
    try{
      const u=new URL(value?.url);
      if(u.protocol==='https:'&&/\.supabase\.co$/.test(u.hostname)&&!u.username&&!u.password&&typeof value.publishableKey==='string'&&value.publishableKey.startsWith('sb_publishable_'))config={url:u.origin,publishableKey:value.publishableKey};
    }catch{}
    return !!config;
  }
  async function loadSDK(){
    if(scope.LanternSupabase?.createClient)return;
    if(!sdkLoading)sdkLoading=new Promise((resolve,reject)=>{
      const script=scope.document.createElement('script');script.src='supabase-client.js?v=15';script.async=true;
      script.onload=()=>scope.LanternSupabase?.createClient?resolve():reject(Error('クラウド保存を読み込めませんでした'));
      script.onerror=()=>{script.remove();reject(Error('クラウド保存を読み込めませんでした'));};
      scope.document.head.appendChild(script);
    }).catch(e=>{sdkLoading=null;throw e;});
    await sdkLoading;
  }
  async function connect(){
    if(client)return;
    await loadSDK();
    if(!scope.LanternSupabase?.createClient)throw Error('クラウド保存を読み込めませんでした');
    client=scope.LanternSupabase.createClient(config.url,config.publishableKey,{auth:{storageKey:'lantern-journey-supabase-auth-v1',autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
    session=scope.LanternCloudAuth.createSession(client.auth);
    cloud=scope.LanternCloudSave.createAdapter({...config,getAccessToken:session.getAccessToken,validate:scope.LanternRPG.validate,storage:scope.localStorage});
  }
  function stats(snapshot,label,extra=''){
    if(!snapshot)return `<article class="note"><h3>${label}</h3><p class="small">まだ記録がありません</p></article>`;
    let power='—';try{power=scope.LanternRPG.total(snapshot).toLocaleString('ja-JP');}catch{}
    const clear=Math.min(21,snapshot.next||0),heroes=snapshot.unlocked?.length||1;
    return `<article class="note"><h3>${label}</h3><div class="stats"><div><small>進行</small><strong>${clear}/21</strong></div><div><small>仲間</small><strong>${heroes}人</strong></div><div><small>戦力</small><strong>${power}</strong></div></div><p class="small">HARD ${snapshot.trials?.hard||0}/21 · EXPERT ${snapshot.trials?.expert||0}/21${extra?'<br>'+escape(extra):''}</p></article>`;
  }
  function remoteDate(){if(!remote?.updated_at)return '';const date=new Date(remote.updated_at);return Number.isNaN(date.valueOf())?'':new Intl.DateTimeFormat('ja-JP',{dateStyle:'short',timeStyle:'short'}).format(date);}
  function draw(force=false){
    if(!active||!hooks)return;
    if(!force&&!scope.document.querySelector('[data-lantern-cloud]')){active=false;return;}
    let body;
    if(!config)body='<p class="note">クラウド保存は準備中です</p><p class="small">この端末の冒険は引き続き自動保存されます<br>設定の「記録を書き出す」から手元に保管できます</p>';
    else if(!user)body=`<p class="small">冒険の記録を、別の端末へ<br>メールアドレスでログインして記録を保管できます</p><label style="display:block;margin:16px 0 12px">メールアドレス<input id="cloud-email" type="email" autocomplete="email" inputmode="email" maxlength="254" value="${escape(email)}" ${busy?'disabled':''} style="display:block;box-sizing:border-box;width:100%;font:inherit;font-size:16px;padding:12px;margin-top:8px;border-radius:10px;background:#102932;color:#eef1e5;border:1px solid #527078"></label>${button('cloud-send',codeSent?'コードを送り直す':'確認コードを送る','primary')}${codeSent?`<label style="display:block;margin:16px 0 12px">メールに届いた 6 桁のコード<input id="cloud-code" type="text" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" ${busy?'disabled':''} style="display:block;box-sizing:border-box;width:100%;font:inherit;font-size:20px;letter-spacing:.25em;padding:12px;margin-top:8px;border-radius:10px;background:#102932;color:#eef1e5;border:1px solid #527078"></label>${button('cloud-verify','ログインする','primary')}`:''}<p class="small">未登録のアドレスは新しいアカウントになります<br>メールはログイン確認に使用します</p>`;
    else if(mode==='upload-confirm'||mode==='restore-confirm'){
      const upload=mode==='upload-confirm';
      body=`<p class="eyebrow">記録を選んで続ける</p>${stats(upload?review.snapshot:remote.snapshot,upload?'この冒険をクラウドに保存':'この冒険を端末に復元')}<p class="note">${upload?'クラウドの記録を、この端末の冒険に更新します':'この端末の冒険を、上のクラウド記録に切り替えます'}<br>変更前の端末記録は退避します</p>${button(upload?'cloud-upload':'cloud-restore',upload?'この記録を保存する':'この記録で続ける','primary')}${button('cloud-cancel','比較に戻る')}`;
    }else{
      body=`<p class="small">ログイン済み · 使いたい記録を選んでください</p>${stats(hooks.getState(),'この端末')}${stats(remote?.snapshot,'クラウド',remote?'更新 '+remoteDate()+' ／ 記録 '+remote.revision:'')}<div class="stack">${pendingUpload?button('cloud-retry','中断した保存を再確認','primary'):button('cloud-upload-review',remote?'端末の記録をクラウドへ':'はじめてクラウドに保存','primary')}${remote?button('cloud-restore-review','クラウドの記録を端末へ'):''}${button('cloud-refresh','記録を更新して比較')}${button('cloud-signout','ログアウト')}</div><p class="small">自動で上書きはしません<br>購入情報は冒険の記録と別に管理されます</p>`;
    }
    hooks.showModal('クラウド保存',`<div data-lantern-cloud>${busy?'<p class="note" role="status">記録を確認しています…</p>':''}${error?`<p class="note" role="alert">${escape(error)}</p>`:''}${body}</div>`,'settings',!busy);
  }
  async function refresh(){
    const verified=await session.getUser();
    if(user?.id!==verified?.id){remote=null;review=null;pendingUpload=null;mode='compare';}
    user=verified;
    remote=user?await cloud.load():null;
  }
  async function sameAccount(){
    const verified=await session.getUser();
    if(!verified||verified.id!==user?.id){user=verified;remote=null;review=null;pendingUpload=null;mode='compare';throw Object.assign(Error('ログイン状態が変わりました 記録を更新してください'),{code:'account_changed'});}
  }
  async function run(work){
    if(busy)return;
    busy=true;error='';draw();
    try{await work();}
    catch(e){error=e?.code||e?.message==='クラウド保存を読み込めませんでした'?e.message:'操作を完了できませんでした 端末の記録は保持されています';if(['conflict','account_changed'].includes(e?.code)){mode='compare';review=null;pendingUpload=null;try{await refresh();}catch{}}}
    finally{busy=false;draw();}
  }
  async function open(options){
    if(busy)return false;
    hooks=options;active=true;error='';mode='compare';review=null;
    if(!hooks.save())error='端末に保存できません 記録を書き出して保管してください';
    draw(true);
    if(config)await run(async()=>{await connect();await refresh();});
    return true;
  }
  function captureReview(kind){
    if(!hooks.save())throw Object.assign(Error('端末の記録を保存できません'),{code:'local_write_failed'});
    const snapshot=hooks.getState();review={snapshot,raw:JSON.stringify(snapshot),revision:remote?.revision||0};mode=kind;
  }
  function deviceId(){
    const key='lantern-journey-cloud-device-v15';let id=scope.localStorage.getItem(key);
    if(!/^[0-9a-f-]{36}$/i.test(id||'')){id=uuid();scope.localStorage.setItem(key,id);}return id;
  }
  async function upload(retry=false){
    await sameAccount();
    if(!retry){
      if(!review||JSON.stringify(hooks.getState())!==review.raw)throw Object.assign(Error('端末の冒険が進みました もう一度比較してください'),{code:'conflict'});
      pendingUpload={rawSave:review.raw,expectedRevision:review.revision,requestId:uuid(),deviceId:deviceId()};
    }
    if(!pendingUpload)return;
    await cloud.upload(pendingUpload);pendingUpload=null;review=null;mode='compare';remote=await cloud.load();hooks.toast('冒険をクラウドに保存しました');
  }
  async function handle(action,target){
    if(!action?.startsWith('cloud-'))return false;
    if(busy||!active||!config||!session)return true;
    if(action==='cloud-send'){
      email=scope.document.getElementById('cloud-email')?.value.trim()||'';
      await run(async()=>{await session.requestCode(email);codeSent=true;hooks.toast('メールの確認コードを入力してください');});
    }else if(action==='cloud-verify'){
      email=scope.document.getElementById('cloud-email')?.value.trim()||'';const code=scope.document.getElementById('cloud-code')?.value||'';
      await run(async()=>{const verified=await session.verifyCode(email,code);if(!verified)throw Object.assign(Error('ログインを確認できません'),{code:'otp_failed'});user=verified;codeSent=false;await refresh();});
    }else if(action==='cloud-refresh')await run(refresh);
    else if(action==='cloud-signout')await run(async()=>{await session.signOut();user=null;remote=null;review=null;pendingUpload=null;email='';codeSent=false;mode='compare';});
    else if(action==='cloud-upload-review')await run(async()=>{await sameAccount();captureReview('upload-confirm');});
    else if(action==='cloud-restore-review'&&remote)await run(async()=>{await sameAccount();captureReview('restore-confirm');});
    else if(action==='cloud-cancel'){mode='compare';review=null;draw();}
    else if(action==='cloud-upload')await run(()=>upload(false));
    else if(action==='cloud-retry')await run(()=>upload(true));
    else if(action==='cloud-restore')await run(async()=>{
      await sameAccount();
      if(!review||JSON.stringify(hooks.getState())!==review.raw)throw Object.assign(Error('端末の冒険が進みました もう一度比較してください'),{code:'conflict'});
      const result=await cloud.restore({confirmedRevision:review.revision,backupId:uuid()});
      // Required synchronous swap: pagehide/autosave must now see the restored state.
      hooks.setState(result.snapshot);
      hooks.save();review=null;pendingUpload=null;mode='compare';active=false;
      hooks.closeModal();hooks.toast('クラウドの冒険を復元しました');
    });
    return true;
  }
  function dismiss(){if(busy)return false;active=false;return true;}
  scope.LanternCloudUI=Object.freeze({configure,open,handle,dismiss,configured:()=>!!config});
})(typeof window!=='undefined'?window:globalThis);
