import {copyFileSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

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
      html=html.replaceAll('No account or app analytics.','No account. Public page views use Google Analytics 4; progress and recordings are not sent. Privacy: https://music-japan.com/privacy/.');
      writeFileSync(path,html);count++;
    }
  }
  walk(output);
  console.log(`Production GA4 added to ${count} public pages, including all learning apps`);
  return count;
}
