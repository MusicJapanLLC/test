import {createApp} from "./server.mjs";
function configure(){
  const text=process.env.BATON_MEETING_TENANT_KEYS_JSON||"";
  if(!text||text.length>10000)throw new Error("CONFIGURE_TENANT_KEYS_IN_PROCESS_ENVIRONMENT");
  const obj=JSON.parse(text);
  if(!obj||Array.isArray(obj)||typeof obj!=="object")throw new Error("INVALID_TENANT_MAP");
  return new Map(Object.entries(obj));
}
const app=createApp({tenantTokens:configure()});
const port=Number(process.env.PORT||"8788");
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("INVALID_LOCAL_PORT");
app.listen(port,"127.0.0.1",()=>console.log("BATON_MEETING_LOCAL_ONLY_READY"));
