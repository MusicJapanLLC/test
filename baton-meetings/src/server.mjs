import {createServer} from "node:http";
import {timingSafeEqual} from "node:crypto";
import {InMemoryMeetings,limits} from "./engine.mjs";
function json(res,status,payload){
  const b=JSON.stringify(payload);
  res.writeHead(status,{"content-type":"application/json; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff"});
  res.end(b);
}
function matchBearer(actual,expected){
  if(typeof actual!=="string"||!actual.startsWith("Bearer "))return false;
  const x=Buffer.from(actual.slice(7));const y=Buffer.from(expected);
  return x.length===y.length&&timingSafeEqual(x,y);
}
export function createApp({tenantTokens,db=new InMemoryMeetings()}={}){
  if(!(tenantTokens instanceof Map)||tenantTokens.size<1||tenantTokens.size>20)
    throw new Error("TENANT_AUTH_CONFIGURATION_REQUIRED");
  for(const [tenant,token] of tenantTokens){
    if(!/^[A-Za-z0-9_.:-]{5,110}$/.test(tenant)||typeof token!=="string"||token.length<32)
      throw new Error("INVALID_TENANT_CREDENTIAL_CONFIGURATION");
  }
  return createServer(async(req,res)=>{
    const tenant=[...tenantTokens].find(([,token])=>matchBearer(req.headers.authorization,token))?.[0];
    if(!tenant)return json(res,401,{error:"AUTH_REQUIRED"});
    const url=new URL(req.url||"/","http://localhost");
    if(url.search) return json(res,400,{error:"QUERY_UNSUPPORTED"});
    if(req.method==="POST"&&url.pathname==="/api/meetings/import-transcript"){
      let total=0;const chunks=[];
      try{
        for await(const chunk of req){
          total+=chunk.length;
          if(total>limits.maxBodyBytes)return json(res,413,{error:"INPUT_TOO_LARGE"});
          chunks.push(chunk);
        }
        const input=JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if(input.workspace_id!==tenant)return json(res,403,{error:"WORKSPACE_FORBIDDEN"});
        const r=db.importArtifact(input);
        return json(res,r.code, r.doc?{status:r.status,meeting:r.doc}:{status:r.status});
      }catch(e){return json(res,422,{error:"UNPROCESSABLE_ARTIFACT",reason:e instanceof Error?e.message:"INVALID_INPUT"})}
    }
    const m=/^\/api\/meetings\/([A-Za-z0-9_.:-]{5,110})$/.exec(url.pathname);
    if(req.method==="GET"&&m){
      const record=db.find(tenant,m[1]);
      return record?json(res,200,{status:"FOUND",meeting:record}):json(res,404,{error:"NOT_FOUND"});
    }
    return json(res,404,{error:"UNKNOWN_ENDPOINT"});
  });
}
