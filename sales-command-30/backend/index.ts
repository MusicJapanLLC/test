import { router, json, error, db } from '@appdeploy/sdk';

type Inquiry={company:string;name:string;email:string;note?:string};
const clean=(v:unknown,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
export const handler=router({
 'GET /api/_healthcheck':[async()=>json({message:'Success'})],
 'POST /api/inquiries':[async({body})=>{const b=(body||{}) as Inquiry;const company=clean(b.company,120),name=clean(b.name,80),email=clean(b.email,180),note=clean(b.note,1500);if(!company||!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return error('invalid_input',400);const [id]=await db.add('inquiries',[{company,name,email,note,createdAt:new Date().toISOString(),source:'sales-command-30-lp'}]);if(!id)return error('save_failed',500);return json({ok:true,id},201)}]
});