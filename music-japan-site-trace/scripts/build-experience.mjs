import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildExperience(output){
  const assets=join(output,'assets');mkdirSync(assets,{recursive:true});
  const result=await build({absWorkingDir:root,entryPoints:['src/music-japan-experience.js'],outdir:assets,
    bundle:true,format:'esm',splitting:true,minify:true,target:['es2020'],metafile:true,
    entryNames:'music-japan-experience',chunkNames:'mj-[name]-[hash]',legalComments:'linked',
    plugins:[{name:'reuse-preserved-gsap',setup(build){
      build.onResolve({filter:/^gsap$/},()=>({path:'/assets/gsap-DlCALkUl.js',external:true}));
      build.onResolve({filter:/^gsap\/ScrollTrigger$/},()=>({path:'/assets/ScrollTrigger-DZQrbmfv.js',external:true}));
    }}],
    define:{__MJ_REVIEW__:JSON.stringify(process.env.CF_PAGES_BRANCH==='chatgpt/music-japan-immersive-20260918')}});
  copyFileSync(join(root,'src/music-japan-experience.css'),join(assets,'music-japan-experience.css'));
  const files=Object.entries(result.metafile.outputs).filter(([name])=>name.endsWith('.js')).map(([name])=>({file:name.split('/').pop(),gzip:gzipSync(readFileSync(join(root,name))).length}));
  const total=files.reduce((sum,f)=>sum+f.gzip,0);
  const reused=['gsap-DlCALkUl.js','ScrollTrigger-DZQrbmfv.js'].map(file=>({file,gzip:gzipSync(readFileSync(join(assets,file))).length}));
  const report={files,additionalGzipBytes:total,reused,totalLoadedGzipBytes:total+reused.reduce((s,f)=>s+f.gzip,0),limitBytes:150*1024,withinBudget:total<=150*1024};
  writeFileSync(join(output,'experience-build.json'),JSON.stringify(report,null,2));
  console.log('Experience JS gzip bytes:',JSON.stringify(report));
  if(!report.withinBudget)throw Error(`Experience JS exceeds 150 KiB budget: ${total}`);
}
