export type Change={id:string;title:string;reason:string;action:string;impact:'HIGH'|'MEDIUM'|'LOW'};
export function fallbackChanges(html:string):Change[]{
 const out:Change[]=[];
 if(!/content-security-policy/i.test(html)) out.push({id:'csp',title:'CSPを追加',reason:'ブラウザ側の攻撃面を狭める',action:'ホスティング設定でContent-Security-Policyを追加・調整する',impact:'HIGH'});
 if(!/<meta[^>]+name=["']description/i.test(html)) out.push({id:'meta',title:'Meta descriptionを追加',reason:'検索結果の説明品質を上げる',action:'各主要ページに固有のmeta descriptionを追加する',impact:'MEDIUM'});
 if(!/aria-|alt=/i.test(html)) out.push({id:'a11y',title:'アクセシビリティ属性を補強',reason:'操作性と機械可読性を改善する',action:'画像alt、フォームlabel、必要なARIA属性を追加する',impact:'MEDIUM'});
 out.push({id:'headers',title:'セキュリティヘッダーを強化',reason:'一般的なブラウザ攻撃面を低減する',action:'HSTS、X-Content-Type-Options、Referrer-Policy、Permissions-Policyをホスティング層で確認・強化する',impact:'HIGH'});
 return out.slice(0,6);
}
