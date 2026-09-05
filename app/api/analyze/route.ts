import { NextRequest,NextResponse } from 'next/server';
import { orchestrate } from '../../lib/orchestrator';
function valid(v:string){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u:null}catch{return null}}
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({})); const target=valid(String(body.url||''));
 if(!target)return NextResponse.json({error:'invalid_url'},{status:400});
 try{const r=await fetch(target.toString(),{redirect:'follow',headers:{'User-Agent':'Authorized-Site-Change-Terminal/0.1'},cache:'no-store'});if(!r.ok)return NextResponse.json({error:'target_unreadable'},{status:502});const html=(await r.text()).slice(0,200000);const title=(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]||target.hostname).trim();const result=await orchestrate(html);return NextResponse.json({target:target.toString(),title,...result});}catch{return NextResponse.json({error:'analysis_failed'},{status:502})}
}
