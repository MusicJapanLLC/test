import {copyFileSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

function allowAnalytics(policy) {
  const directives=new Map(policy.split(';').map(x=>x.trim().split(/\s+/)).filter(([name])=>name).map(([name,...sources])=>[name,sources]));
  const google=['https://www.googletagmanager.com','https://*.google-analytics.com'];
  for(const [name,added] of [['script-src',["'self'",google[0]]],['connect-src',[...google,'https://analytics.google.com','https://www.google.com']],['img-src',google]]) {
    const old=directives.get(name)??directives.get('default-src')??[];
    directives.set(name,[...new Set([...old.filter(x=>x!=="'none'"),...added])]);
  }
  if(directives.has('script-src-elem'))directives.set('script-src-elem',[...new Set([...directives.get('script-src-elem').filter(x=>x!=="'none'"),"'self'",google[0]])]);
  return [...directives].map(([name,sources])=>[name,...sources].join(' ')).join('; ');
}

// Run after all app publishers: their verified source artifacts stay unchanged.
export function publishAnalytics(root=fileURLToPath(new URL('..',import.meta.url))) {
  const output=join(root,'deploy-dist');
  copyFileSync(join(root,'next/public/analytics.js'),join(output,'analytics.js'));
  let count=0;
  function walk(dir) {
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      const path=join(dir,entry.name);
      if(entry.isDirectory()) {walk(path);continue;}
      if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
      let html=readFileSync(path,'utf8');
      if(!/<\/head>/i.test(html)||/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html))continue;
      const rel=relative(output,path).replaceAll('\\','/');
      const router=/^(korean|wahran|english)\//.test(rel)?' data-ga4-router="learning"':'';
      const tag=`<script defer src="/analytics.js?v=20261020" data-ga4-id="G-S2P0JCW50M" data-ga4-host="music-japan.com"${router}></script>`;
      html=html.replace(/<script\b[^>]*src=["'][^"']*\/analytics\.js[^"']*["'][^>]*><\/script>\s*/gi,'');
      html=html.replace(/<\/head>/i,tag+'\n</head>');
      html=html.replace(/<meta\b(?=[^>]*http-equiv="Content-Security-Policy")[^>]*>/gi,meta=>meta.replace(/content="([^"]*)"/i,(_all,policy)=>`content="${allowAnalytics(policy)}"`));
      html=html.replaceAll('No account or app analytics.','No account. Public page views use Google Analytics 4; progress and recordings are not sent. Privacy: https://music-japan.com/privacy/.');
      html=html.replaceAll('The public hosting provider may add analytics independently of this offline app.','This public site uses Google Analytics 4 for page and screen views; progress and recordings are not sent. Privacy: https://music-japan.com/privacy/.');
      writeFileSync(path,html);count++;
    }
  }
  walk(output);
  console.log(`Production GA4 added to ${count} public pages, including all learning apps`);
  return count;
}
