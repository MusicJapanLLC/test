import * as dns from 'node:dns/promises';
import * as tls from 'node:tls';
import { isIP } from 'node:net';
import { candidateActions } from './contracts.js';

const UA='MADLAB-DeepGuard-v2/2.1';
const MAX_BODY=700000;
const MAX_PAGE=280000;
const MAX_PAGES=5;
const BAD_PATH=/(logout|log-out|signout|sign-out|delete|remove|destroy|unsubscribe|purchase|checkout|payment)/i;
const W={critical:30,high:18,medium:8,low:3,info:.5};
const C={high:1,medium:.72,low:.45};

function isPrivateV4(ip){
  const p=ip.split('.').map(Number);
  if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
  const[a,b,c]=p;
  return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19))||(a===192&&b===0&&c===2)||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113);
}
function isPublicIp(ip){
  const k=isIP(ip);
  if(k===4)return !isPrivateV4(ip);
  if(k===6){const x=ip.toLowerCase();return !(x==='::'||x==='::1'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe8')||x.startsWith('fe9')||x.startsWith('fea')||x.startsWith('feb')||x.startsWith('ff')||x.startsWith('2001:db8:'));}
  return false;
}
async function validatePublic(raw){
  let u;
  try{u=new URL(raw)}catch{throw new Error('invalid_url')}
  if(!['http:','https:'].includes(u.protocol))throw new Error('http_https_only');
  if(u.username||u.password)throw new Error('userinfo_not_allowed');
  if(u.port&&!['80','443'].includes(u.port))throw new Error('non_web_port_not_allowed');
  const host=u.hostname.toLowerCase().replace(/\.$/,'');
  if(!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))throw new Error('private_target_blocked');
  if(isIP(host)){if(!isPublicIp(host))throw new Error('private_target_blocked');return{url:u,addresses:[host]};}
  const rows=await dns.lookup(host,{all:true,verbatim:true});
  if(!rows.length)throw new Error('dns_no_public_address');
  const addresses=[...new Set(rows.map(r=>r.address))];
  if(addresses.some(x=>!isPublicIp(x)))throw new Error('private_target_blocked');
  return{url:u,addresses};
}
async function readBody(res,max){
  if(!res.body)return'';
  const reader=res.body.getReader(),decoder=new TextDecoder();
  let out='',bytes=0;
  while(bytes<max){
    const r=await reader.read();
    if(r.done)break;
    const chunk=r.value.slice(0,max-bytes);
    bytes+=chunk.byteLength;
    out+=decoder.decode(chunk,{stream:true});
    if(bytes>=max){await reader.cancel();break;}
  }
  out+=decoder.decode();
  return out;
}
function headerMap(h){
  const keys=['content-type','content-security-policy','content-security-policy-report-only','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','access-control-allow-origin','access-control-allow-credentials','access-control-allow-methods','server','x-powered-by','cache-control','set-cookie','location','allow'];
  const out={};
  for(const k of keys){const v=h.get(k);if(v)out[k]=v.slice(0,4000);}
  return out;
}
async function request(raw,{method='GET',headers={},max=MAX_PAGE}={}){
  let current=(await validatePublic(raw)).url.toString();
  const redirects=[];
  for(let i=0;i<6;i++){
    await validatePublic(current);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let res;
    try{res=await fetch(current,{method,redirect:'manual',headers:{'User-Agent':UA,'Accept':'text/html,application/json,text/plain;q=.9,*/*;q=.2',...headers},signal:controller.signal});}
    finally{clearTimeout(timer);}
    if(method==='GET'&&[301,302,303,307,308].includes(res.status)){
      const loc=res.headers.get('location');
      if(!loc)break;
      current=(await validatePublic(new URL(loc,current).toString())).url.toString();
      redirects.push(current);
      continue;
    }
    return{finalUrl:current,status:res.status,headers:headerMap(res.headers),text:method==='GET'?await readBody(res,max):'',redirects};
  }
  throw new Error('too_many_redirects');
}
function add(out,f){
  if(!out.some(x=>x.id===f.id&&x.evidence===f.evidence))out.push({...f,action_candidates:candidateActions(f.id)});
}
function splitCookies(raw){return String(raw||'').split(/,(?=[^;,]+=)/).map(x=>x.trim()).filter(Boolean);}
function links(html,base){
  const origin=new URL(base).origin,seen=new Set(),out=[];
  for(const m of html.matchAll(/\bhref\s*=\s*["']([^"'#]+)["']/gi)){
    try{
      const u=new URL(m[1],base);
      if(u.origin!==origin||u.search||BAD_PATH.test(u.pathname)||/\.(?:zip|gz|pdf|jpg|jpeg|png|gif|svg|mp4|mp3|woff2?|ttf|css|js)$/i.test(u.pathname))continue;
      u.hash='';
      if(u.toString()!==base&&!seen.has(u.toString())){seen.add(u.toString());out.push(u.toString());}
    }catch{}
    if(out.length>=MAX_PAGES)break;
  }
  return out;
}
function scriptUrls(html,base){
  const out=[];
  for(const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)){
    try{const s=new URL(m[1],base).toString();if(!out.includes(s))out.push(s);}catch{}
  }
  return out.slice(0,12);
}
function analyzeHeaders(page,out,isRoot){
  const h=page.headers,html=page.text,u=new URL(page.finalUrl),https=u.protocol==='https:',csp=h['content-security-policy']||'',ro=h['content-security-policy-report-only']||'';
  if(https&&!h['strict-transport-security'])add(out,{id:'hsts-missing',severity:'medium',confidence:'high',title:'HSTSが未設定',category:'Transport',detail:'HTTPS応答にHSTSがありません。',evidence:'Strict-Transport-Security: missing',why:'最初のHTTP到達時の耐性が弱くなります。',fix:'HTTPS運用確認後にHSTSを導入してください。'});
  if(h['strict-transport-security']){const ma=Number(h['strict-transport-security'].match(/max-age\s*=\s*(\d+)/i)?.[1]||0);if(ma>0&&ma<15552000)add(out,{id:'hsts-max-age-weak',severity:'low',confidence:'high',title:'HSTS max-ageが短い',category:'Transport',detail:'HSTSはありますが180日未満です。',evidence:h['strict-transport-security'],why:'HSTS保護が短期間で失効します。',fix:'運用確認後にmax-ageを延長してください。'});}
  if(!csp)add(out,{id:'csp-missing',severity:'medium',confidence:'high',title:'CSPが未設定',category:'Browser Defense',detail:'Content-Security-Policyがありません。',evidence:'Content-Security-Policy: missing',why:'XSSや外部resource事故時の抑止層が減ります。',fix:'Report-OnlyからCSPを段階導入してください。'});
  if(ro&&!csp)add(out,{id:'csp-report-only-only',severity:'info',confidence:'high',title:'CSPはReport-Onlyのみ',category:'Browser Defense',detail:'違反観測はできますがblockはしません。',evidence:ro.slice(0,500),why:'観測と強制を区別する必要があります。',fix:'reportを確認後enforceへ移行してください。'});
  if(csp){
    if(/'unsafe-eval'/i.test(csp))add(out,{id:'csp-unsafe-eval',severity:'medium',confidence:'high',title:'CSPでunsafe-evalを許可',category:'Browser Defense',detail:'文字列由来code実行をCSPが許容しています。',evidence:csp.slice(0,500),why:'注入時の防御余地を狭めます。',fix:'unsafe-eval依存を削減してください。'});
    if(/'unsafe-inline'/i.test(csp)&&!/nonce-|sha256-|sha384-|sha512-/i.test(csp))add(out,{id:'csp-unsafe-inline',severity:'medium',confidence:'medium',title:'CSP inline制約が弱い',category:'Browser Defense',detail:'unsafe-inlineがありnonce/hashを確認できません。',evidence:csp.slice(0,500),why:'inline注入を抑止しにくくなります。',fix:'nonce/hashへ移行してください。'});
    if(!/(?:^|;)\s*object-src\s+/i.test(csp))add(out,{id:'csp-object-src-missing',severity:'low',confidence:'high',title:'CSPにobject-srcがない',category:'Browser Defense',detail:'object-srcの明示制約がありません。',evidence:csp.slice(0,500),why:'plugin系contentの制約がdefault-srcへ依存します。',fix:"object-src 'none' を検討してください。"});
    if(!/(?:^|;)\s*base-uri\s+/i.test(csp))add(out,{id:'csp-base-uri-missing',severity:'low',confidence:'high',title:'CSPにbase-uriがない',category:'Browser Defense',detail:'base要素の制約を確認できません。',evidence:csp.slice(0,500),why:'HTML注入時の相対URL解決先操作を抑止できます。',fix:"base-uri 'self' または 'none' を検討してください。"});
    if(/(?:script-src|default-src)[^;]*\*/i.test(csp))add(out,{id:'csp-script-wildcard',severity:'medium',confidence:'high',title:'CSP script許可範囲が広い',category:'Browser Defense',detail:'script-src/default-srcでwildcardを確認しました。',evidence:csp.slice(0,500),why:'script読み込み元の制約が弱くなります。',fix:'必要originへ限定してください。'});
  }
  if(!h['x-frame-options']&&!/frame-ancestors/i.test(csp))add(out,{id:'frame-protection-missing',severity:'medium',confidence:'high',title:'Clickjacking防御を確認できない',category:'Browser Defense',detail:'X-Frame-Optionsもframe-ancestorsもありません。',evidence:'frame protection: missing',why:'第三者frameからUI誘導される余地があります。',fix:'CSP frame-ancestorsを設定してください。'});
  if((h['x-content-type-options']||'').toLowerCase()!=='nosniff')add(out,{id:'nosniff-missing',severity:'low',confidence:'high',title:'nosniffが未設定',category:'Browser Defense',detail:'X-Content-Type-Options: nosniffがありません。',evidence:'X-Content-Type-Options: missing',why:'Content-Type誤設定時の推測riskを増やします。',fix:'nosniffを設定してください。'});
  const ref=h['referrer-policy']||'';
  if(!ref)add(out,{id:'referrer-policy-missing',severity:'low',confidence:'high',title:'Referrer-Policyが未設定',category:'Privacy / Browser',detail:'参照元送出方針がありません。',evidence:'Referrer-Policy: missing',why:'外部遷移時のURL露出を増やす可能性があります。',fix:'strict-origin-when-cross-origin等を設定してください。'});
  else if(/^unsafe-url$/i.test(ref.trim()))add(out,{id:'referrer-policy-unsafe',severity:'low',confidence:'high',title:'Referrer-Policyがunsafe-url',category:'Privacy / Browser',detail:'完全URLを送りやすい設定です。',evidence:`Referrer-Policy: ${ref}`,why:'URLに機微情報があると漏えい範囲が広がります。',fix:'より制限的なpolicyへ変更してください。'});
  if(isRoot&&!h['permissions-policy'])add(out,{id:'permissions-policy-missing',severity:'info',confidence:'high',title:'Permissions-Policyが未設定',category:'Browser Hardening',detail:'browser機能制御が未設定です。',evidence:'Permissions-Policy: missing',why:'不要機能を閉じる追加防御層を持てます。',fix:'不要機能を明示的に無効化してください。'});
  if(h.server||h['x-powered-by'])add(out,{id:`tech-disclosure-${u.hostname}`,severity:'info',confidence:'high',title:'Server技術情報を公開',category:'Information Exposure',detail:'Server/X-Powered-Byが見えます。',evidence:[h.server&&`Server=${h.server}`,h['x-powered-by']&&`X-Powered-By=${h['x-powered-by']}`].filter(Boolean).join(' / '),why:'攻撃面推測材料になります。',fix:'不要な識別情報を削減してください。'});
  for(const cookie of splitCookies(h['set-cookie'])){
    const name=(cookie.split('=')[0]||'cookie').trim(),session=/session|sess|auth|token|jwt|sid/i.test(name);
    if(https&&!/;\s*secure\b/i.test(cookie))add(out,{id:`cookie-secure-${name}`,severity:session?'medium':'low',confidence:'high',title:`Cookie ${name} にSecureなし`,category:'Session',detail:'HTTPS responseのCookieにSecureがありません。',evidence:cookie.slice(0,500),why:'平文経路へ送出される余地があります。',fix:'Secureを付与してください。'});
    if(session&&!/;\s*httponly\b/i.test(cookie))add(out,{id:`cookie-httponly-${name}`,severity:'medium',confidence:'high',title:`${name} にHttpOnlyなし`,category:'Session',detail:'session系CookieにHttpOnlyがありません。',evidence:cookie.slice(0,500),why:'XSS時のsession窃取影響を広げます。',fix:'不要ならHttpOnlyを付与してください。'});
    if(!/;\s*samesite=/i.test(cookie))add(out,{id:`cookie-samesite-${name}`,severity:'low',confidence:'medium',title:`${name} にSameSiteなし`,category:'Session',detail:'SameSite属性を確認できません。',evidence:cookie.slice(0,500),why:'cross-site送信方針が曖昧です。',fix:'用途に応じSameSiteを設定してください。'});
    if(name.startsWith('__Host-')&&(!/;\s*secure\b/i.test(cookie)||!/;\s*path=\//i.test(cookie)||/;\s*domain=/i.test(cookie)))add(out,{id:`cookie-host-prefix-invalid-${name}`,severity:'medium',confidence:'high',title:`${name} の__Host-要件不備`,category:'Session',detail:'__Host- prefix要件を満たしていません。',evidence:cookie.slice(0,500),why:'Cookie scope保証が失われます。',fix:'Secure / Path=/ / Domainなしを満たしてください。'});
  }
  if(https){
    const active=[...html.matchAll(/<(?:script|iframe|link)\b[^>]*(?:src|href)\s*=\s*["']http:\/\/[^"']+/gi)];
    if(active.length)add(out,{id:'mixed-active-content',severity:'high',confidence:'high',title:'HTTPS内にHTTP実行resource',category:'Transport / Browser',detail:`HTTPのscript/iframe/styleを${active.length}件検出しました。`,evidence:active[0][0].slice(0,400),why:'中間者改ざんがcode実行へ影響し得ます。',fix:'HTTPSへ統一してください。'});
  }
  const forms=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].slice(0,20);
  for(const m of forms){
    const form=m[0],password=/type\s*=\s*["']?password/i.test(form),method=(form.match(/\bmethod\s*=\s*["']([^"']+)/i)?.[1]||'get').toLowerCase();
    if(password&&!https)add(out,{id:'password-over-http',severity:'critical',confidence:'high',title:'Password formがHTTP上に存在',category:'Authentication',detail:'password入力がHTTPSで保護されていません。',evidence:page.finalUrl,why:'認証情報の盗聴riskがあります。',fix:'HTTPS限定にしてください。'});
    if(password&&method==='get')add(out,{id:'password-form-get',severity:'high',confidence:'high',title:'Password formがGET送信',category:'Authentication',detail:'passwordをGETで送信するformです。',evidence:form.slice(0,500),why:'URL・履歴・logへ残るriskがあります。',fix:'POSTへ変更してください。'});
    if(password&&!/\b(no-store|private)\b/i.test(h['cache-control']||''))add(out,{id:'auth-page-cache-control-weak',severity:'low',confidence:'medium',title:'認証formのcache制御が弱い',category:'Authentication / Cache',detail:'password入力responseでno-store/privateを確認できません。',evidence:`Cache-Control: ${h['cache-control']||'missing'}`,why:'機微responseのcache方針が不明瞭です。',fix:'要件に応じprivate/no-storeを設定してください。'});
  }
}
function analyzeThirdPartyScripts(root,out){
  const origin=new URL(root.finalUrl).origin;
  for(const m of root.text.matchAll(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>/gi)){
    try{const u=new URL(m[2],root.finalUrl),attrs=m[1]+m[3];if(u.origin!==origin&&!/\bintegrity\s*=/i.test(attrs))add(out,{id:`third-party-sri-${u.hostname}`,severity:'low',confidence:'medium',title:'外部scriptにSRIなし',category:'Supply Chain',detail:'第三者scriptにintegrityを確認できません。',evidence:u.toString().slice(0,500),why:'固定assetならhash照合ができません。',fix:'SRIを検討してください。'});}catch{}
  }
}
async function analyzeSameOriginAssets(root,out){
  const origin=new URL(root.finalUrl).origin;
  for(const url of scriptUrls(root.text,root.finalUrl).filter(x=>new URL(x).origin===origin).slice(0,3)){
    try{const p=await request(url,{max:250000});if(/sourceMappingURL\s*=/.test(p.text))add(out,{id:`sourcemap-hint-${new URL(url).pathname}`,severity:'info',confidence:'medium',title:'公開JSにsource map参照',category:'Information Exposure',detail:'sourceMappingURLを確認しました。',evidence:url,why:'source理解を容易にする場合があります。',fix:'本番source map公開方針を確認してください。'});const old=url.match(/(?:jquery[-.]|jquery\/)([12]\.[0-9.]+)/i);if(old)add(out,{id:`old-jquery-${old[1]}`,severity:'medium',confidence:'low',title:'古いjQuery系version名の疑い',category:'Dependency Heuristic',detail:'URL名から古いversionの可能性があります。',evidence:url,why:'既知脆弱性を抱える可能性があります。',fix:'実versionを確認し更新してください。'});}catch{}
  }
}
async function analyzeMetadata(root,out,entrypoints){
  for(const path of ['/.well-known/security.txt','/robots.txt','/sitemap.xml']){
    try{
      const p=await request(new URL(path,root.finalUrl).toString(),{max:120000});entrypoints.push({type:'metadata',url:p.finalUrl,status:p.status});
      if(path==='/.well-known/security.txt'){
        if(p.status===404)add(out,{id:'security-txt-missing',severity:'low',confidence:'high',title:'security.txtがない',category:'Security Metadata',detail:'標準報告窓口が404です。',evidence:'HTTP 404',why:'報告者が正規窓口へ到達しにくくなります。',fix:'RFC 9116形式で公開してください。'});
        if(p.status>=200&&p.status<300){if(!/^Contact:\s*\S+/im.test(p.text))add(out,{id:'security-txt-contact-missing',severity:'low',confidence:'high',title:'security.txtにContactがない',category:'Security Metadata',detail:'Contact行を確認できません。',evidence:p.text.slice(0,500),why:'報告窓口が不明確です。',fix:'Contactを追加してください。'});const ex=p.text.match(/^Expires:\s*(.+)$/im)?.[1]?.trim();if(!ex)add(out,{id:'security-txt-expires-missing',severity:'info',confidence:'high',title:'security.txtにExpiresがない',category:'Security Metadata',detail:'有効期限がありません。',evidence:p.text.slice(0,500),why:'古い情報が残る可能性があります。',fix:'Expiresを設定してください。'});else if(Number.isFinite(Date.parse(ex))&&Date.parse(ex)<Date.now())add(out,{id:'security-txt-expired',severity:'medium',confidence:'high',title:'security.txtが期限切れ',category:'Security Metadata',detail:'Expiresが過去です。',evidence:`Expires: ${ex}`,why:'情報鮮度を保証できません。',fix:'Expiresを更新してください。'});}
      }
      if(path==='/robots.txt'&&p.status>=200&&p.status<300){const hits=[...p.text.matchAll(/^\s*(?:Disallow|Allow):\s*([^\s#]*(?:admin|internal|debug|backup)[^\s#]*)/gim)].map(x=>x[1]).slice(0,5);if(hits.length)add(out,{id:'robots-sensitive-hints',severity:'low',confidence:'medium',title:'robots.txtに内部系path hint',category:'Information Exposure',detail:'admin/internal/debug/backup系path名があります。追加accessはしていません。',evidence:hits.join(', '),why:'管理面推測材料になります。',fix:'不要な内部path名掲載を見直してください。'});}
    }catch{}
  }
}
async function analyzeCors(url,out){
  for(const origin of ['https://madlab.invalid','null']){
    try{const p=await request(url,{headers:{Origin:origin},max:50000}),a=p.headers['access-control-allow-origin']||'',c=(p.headers['access-control-allow-credentials']||'').toLowerCase();if(origin==='https://madlab.invalid'&&a===origin&&c==='true')add(out,{id:'cors-reflect-credentials',severity:'high',confidence:'high',title:'Origin反射 + credentials',category:'CORS',detail:'test Originが反射されcredentials=trueです。',evidence:`ACAO=${a}; ACAC=${c}`,why:'認証APIにも同設定なら機密responseを第三者originから読める可能性があります。',fix:'厳密なallowlistへ変更してください。'});if(origin==='null'&&a==='null'&&c==='true')add(out,{id:'cors-null-origin-credentials',severity:'high',confidence:'high',title:'null Origin + credentials',category:'CORS',detail:'Origin:nullをcredential付きで許可しています。',evidence:`ACAO=${a}; ACAC=${c}`,why:'sandbox/file系文脈から読める設計になり得ます。',fix:'nullを信頼originにしないでください。'});if(a==='*')add(out,{id:'cors-wildcard',severity:'low',confidence:'high',title:'CORS wildcard',category:'CORS',detail:'ACAO:*を確認しました。',evidence:'Access-Control-Allow-Origin: *',why:'機密resourceに流用すると境界が弱くなります。',fix:'必要originだけ許可してください。'});}catch{}
  }
}
async function analyzeMethods(url,out){
  try{const p=await request(url,{method:'OPTIONS'}),allow=`${p.headers.allow||''},${p.headers['access-control-allow-methods']||''}`;if(/\bTRACE\b/i.test(allow))add(out,{id:'trace-method-advertised',severity:'medium',confidence:'medium',title:'TRACE methodが広告されている',category:'HTTP Methods',detail:'OPTIONS系応答でTRACEが見えます。TRACE自体は実行していません。',evidence:`Allow=${allow}`,why:'不要な情報反射面を増やす場合があります。',fix:'不要ならTRACEを無効化してください。'});if(/\b(PUT|PATCH|DELETE)\b/i.test(allow))add(out,{id:'http-methods-write-advertised',severity:'info',confidence:'medium',title:'書き込み系methodが広告されている',category:'HTTP Methods',detail:'PUT/PATCH/DELETEのいずれかが見えます。未認証利用可能とは断定しません。',evidence:`Allow=${allow}`,why:'API境界棚卸し材料です。',fix:'不要methodを閉じ必要methodへ認証認可を強制してください。'});}catch{}
}
async function analyzeDns(domain,out){
  try{const txt=await dns.resolveTxt(domain);if(!txt.map(x=>x.join('')).some(x=>/^v=spf1\b/i.test(x)))throw new Error();}catch{add(out,{id:'dns-spf-missing',severity:'low',confidence:'medium',title:'SPFを確認できない',category:'DNS / Email',detail:'SPF TXTを確認できません。',evidence:`domain=${domain}`,why:'送信元偽装耐性評価で弱点になります。',fix:'SPFを確認・設定してください。'});}
  try{const txt=await dns.resolveTxt(`_dmarc.${domain}`);if(!txt.map(x=>x.join('')).some(x=>/^v=DMARC1\b/i.test(x)))throw new Error();}catch{add(out,{id:'dns-dmarc-missing',severity:'low',confidence:'medium',title:'DMARCを確認できない',category:'DNS / Email',detail:'_dmarc TXTを確認できません。',evidence:`_dmarc.${domain}`,why:'なりすましmailの検知・隔離方針が弱くなります。',fix:'DMARCを段階導入してください。'});}
  try{await dns.resolveCaa(domain);}catch{add(out,{id:'dns-caa-missing',severity:'info',confidence:'medium',title:'CAAを確認できない',category:'DNS / TLS',detail:'CAA recordを確認できません。',evidence:`domain=${domain}`,why:'証明書発行governanceを強める余地があります。',fix:'利用CAが決まっていればCAAを設定してください。'});}
}
async function analyzeTls(url,out){
  const u=new URL(url);if(u.protocol!=='https:'||u.port)return;
  const v=await validatePublic(u.toString()),ip=v.addresses[0],host=u.hostname;
  const data=await new Promise(resolve=>{let done=false;const finish=x=>{if(done)return;done=true;resolve(x);};const s=tls.connect({host:ip,port:443,servername:host,rejectUnauthorized:true},()=>{const cert=s.getPeerCertificate();finish({protocol:s.getProtocol()||'',authorized:s.authorized,error:String(s.authorizationError||''),validTo:String(cert.valid_to||'')});s.end();});s.setTimeout(5500,()=>{s.destroy();finish(null);});s.on('error',()=>finish(null));});
  if(!data)return;
  if(!data.authorized)add(out,{id:'tls-certificate-untrusted',severity:'high',confidence:'high',title:'TLS証明書の信頼検証に問題',category:'TLS',detail:'certificate検証errorを観測しました。',evidence:`authorized=false; error=${data.error||'unknown'}`,why:'利用者側で警告・接続失敗につながります。',fix:'certificate chain/SAN/issuerを確認してください。'});
  const expiry=Date.parse(data.validTo),days=Number.isFinite(expiry)?Math.floor((expiry-Date.now())/86400000):9999;
  if(days<0)add(out,{id:'tls-cert-expired',severity:'critical',confidence:'high',title:'TLS証明書が期限切れ',category:'TLS',detail:'valid_toが過去です。',evidence:`valid_to=${data.validTo}`,why:'HTTPS接続が失敗します。',fix:'証明書を更新してください。'});
  else if(days<=30)add(out,{id:'tls-cert-expiring-soon',severity:'medium',confidence:'high',title:'TLS証明書期限が近い',category:'TLS',detail:`期限まで約${days}日です。`,evidence:`valid_to=${data.validTo}`,why:'更新失敗で停止へつながります。',fix:'自動更新・監視を確認してください。'});
  if(/^TLSv1(?:\.1)?$/i.test(data.protocol))add(out,{id:'tls-protocol-legacy',severity:'high',confidence:'high',title:'古いTLS protocol',category:'TLS',detail:`Negotiated: ${data.protocol}`,evidence:`protocol=${data.protocol}`,why:'TLS 1.0/1.1は非推奨です。',fix:'TLS 1.2以上へ限定してください。'});
}

export async function scan(raw){
  const started=Date.now(),findings=[],entrypoints=[],stages=[];
  let normalized=String(raw||'').trim();if(!/^https?:\/\//i.test(normalized))normalized='https://'+normalized;
  const v=await validatePublic(normalized);
  async function stage(name,fn){const t=Date.now();await fn();stages.push({name,duration_ms:Date.now()-t});}
  let root;
  await stage('1. Target boundary + baseline',async()=>{root=await request(v.url.toString(),{max:MAX_BODY});entrypoints.push({type:'root',url:root.finalUrl,status:root.status});});
  await stage('2. HTTPS enforcement',async()=>{const u=new URL(root.finalUrl);if(u.protocol==='https:'&&!u.port){try{const p=await request(`http://${u.hostname}/`,{max:20000});if(new URL(p.finalUrl).protocol!=='https:')add(findings,{id:'http-not-upgraded',severity:'high',confidence:'high',title:'HTTPがHTTPSへ強制移行しない',category:'Transport',detail:'HTTP入口がHTTPSへ移行しません。',evidence:`final=${p.finalUrl}`,why:'平文通信へ到達できます。',fix:'HTTPSへ恒久redirectしてください。'});}catch{}}});
  await stage('3. Browser / session defenses',async()=>{analyzeHeaders(root,findings,true);});
  await stage('4. CORS differential',async()=>{await analyzeCors(root.finalUrl,findings);});
  await stage('5. Bounded same-origin crawl',async()=>{for(const url of links(root.text,root.finalUrl)){try{const p=await request(url);entrypoints.push({type:'page',url:p.finalUrl,status:p.status});analyzeHeaders(p,findings,false);}catch{}}});
  await stage('6. Public security metadata',async()=>{await analyzeMetadata(root,findings,entrypoints);});
  await stage('7. Front-end dependency signals',async()=>{analyzeThirdPartyScripts(root,findings);await analyzeSameOriginAssets(root,findings);});
  await stage('8. HTTP method posture',async()=>{await analyzeMethods(root.finalUrl,findings);});
  await stage('9. DNS / mail posture',async()=>{await analyzeDns(new URL(root.finalUrl).hostname,findings);});
  await stage('10. TLS certificate / protocol',async()=>{await analyzeTls(root.finalUrl,findings);});
  const order=['critical','high','medium','low','info'];findings.sort((a,b)=>order.indexOf(a.severity)-order.indexOf(b.severity));
  const score=Math.min(100,Math.round(findings.reduce((n,f)=>n+W[f.severity]*C[f.confidence],0))),grade=score<10?'A':score<25?'B':score<50?'C':score<75?'D':'F';
  return{schema:'madlab-deepguard-standalone/v2',target:root.finalUrl,grade,risk_score:score,http_status:root.status,duration_ms:Date.now()-started,summary:{findings:findings.length,critical:findings.filter(x=>x.severity==='critical').length,high:findings.filter(x=>x.severity==='high').length,medium:findings.filter(x=>x.severity==='medium').length,actionable:findings.filter(x=>x.action_candidates.length).length,entrypoints:entrypoints.length},stages,findings,entrypoints,limits:['public HTTP(S) only','GET / OPTIONS / DNS / TLS handshake only','no credentials or login bypass','no exploit payloads','no form submission','no hidden-path brute force','no secret-file probing','state changes only through explicit owner action contract']};
}
