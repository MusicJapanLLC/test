function unique(xs){return[...new Set((xs||[]).filter(Boolean))];}
function safeId(x){return /^[a-z0-9_\-]{2,80}$/i.test(String(x||''))?String(x):'';}

export function buildBridgeKit(plan,{endpoint='/api/madlab/action'}={}){
  const recommended=unique([
    ...(plan?.execution_batch||[]),
    ...(plan?.bridge_gap||[]).map(x=>x.action_id)
  ].map(safeId).filter(Boolean)).slice(0,40);
  const manifest={
    schema:'madlab-safe-action/v2',
    enabled:true,
    owner_only:true,
    endpoint,
    protocol:'plan-apply-retest',
    actions:recommended.map(id=>({id,label:id,description:'Owner-approved bounded remediation action'}))
  };
  const request_example={
    schema:'madlab-safe-action-request/v2',
    mode:'apply',
    action_id:recommended[0]||'diagnostic_marker',
    target_origin:plan?.target||'https://your-owned-site.example',
    approval_code:'<OWNER_APPROVAL_CODE>',
    request_id:'<IDEMPOTENCY_KEY>',
    requested_by:'MADLAB DeepGuard v3'
  };
  const response_example={
    accepted:true,
    message:'bounded owner action applied',
    evidence:'human-readable change receipt',
    reversible:true
  };
  return {
    schema:'madlab-owner-bridge-kit/v2',
    target:plan?.target||'',
    install_priority:plan?.next_best_expansion||null,
    recommended_actions:recommended,
    manifest_path:'/.well-known/madlab-action.json',
    manifest,
    endpoint_contract:{
      method:'POST',
      same_origin_required:true,
      approval_code_required:true,
      arbitrary_payload_allowed:false,
      redirect_allowed:false,
      request_example,
      response_example
    },
    implementation_rules:[
      'Expose only actions the owner intentionally supports.',
      'Validate approval_code server-side; never place the real code in the manifest or browser bundle.',
      'Map every action_id to a fixed implementation. Do not execute arbitrary commands or arbitrary file paths from the request.',
      'Return a bounded evidence string and reversible flag.',
      'Keep the endpoint on the same HTTPS origin as the target.',
      'For DNS/TLS/provider operations, the target-side bridge should call the owner-controlled provider adapter; MADLAB does not bypass provider authorization.'
    ],
    minimal_node_express:`app.get('/.well-known/madlab-action.json',(req,res)=>res.json(MANIFEST));\napp.post('${endpoint}',async(req,res)=>{\n  const {action_id,approval_code}=req.body||{};\n  if(!checkOwnerCode(approval_code)) return res.status(403).json({accepted:false,message:'owner approval rejected'});\n  const handler=FIXED_ACTIONS[action_id];\n  if(!handler) return res.status(400).json({accepted:false,message:'action not supported'});\n  const result=await handler();\n  res.json({accepted:true,message:result.message,evidence:result.evidence,reversible:Boolean(result.reversible)});\n});`,
    limitations:[
      'This kit creates an authorized execution path; it does not prove ownership by itself.',
      'MADLAB will still execute only the actions advertised by the live target manifest.',
      'No authentication bypass, credential guessing, arbitrary command execution, or third-party mutation is included.'
    ]
  };
}
