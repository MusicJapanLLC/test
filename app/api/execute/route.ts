import { NextRequest,NextResponse } from 'next/server';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({})); if(!body.url||!Array.isArray(body.changes))return NextResponse.json({error:'invalid_request'},{status:400});
 return NextResponse.json({status:'NOT APPLIED',message:'このURLには書き込みアダプタがまだ接続されていません。Git/Vercel/CMSアダプタが実変更と再検証を確認した場合だけSUCCESSになります。'});
}
