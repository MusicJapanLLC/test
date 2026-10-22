// Baton Partners — deterministic, consent-gated meeting transcript evidence engine
// No AI model, external APIs, hidden recording, or customer-message sending.
import {createHash} from "node:crypto";
const providers=new Set(["zoom","google_meet","teams","manual"]);
const idPattern=/^[A-Za-z0-9_.:-]{5,110}$/;
const datePattern=/(?:Z|[+-]\d{2}:\d{2})$/;
export const limits=Object.freeze({maxTurns:800,maxTurnText:1800,maxBodyBytes:512000});
function hash(s){return createHash("sha256").update(s).digest("hex")}
function utc(v) {
  if(typeof v!=="string"||!datePattern.test(v)||v.length>55) throw new Error("TIMESTAMP_TIMEZONE_REQUIRED");
  const n=Date.parse(v);if(!Number.isFinite(n))throw new Error("TIMESTAMP_INVALID");
  const date=/^(\d{4})-(\d{2})-(\d{2})T/.exec(v);
  if(!date)throw new Error("TIMESTAMP_INVALID");
  const year=Number(date[1]),month=Number(date[2]),day=Number(date[3]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const maxDay=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  if(day<1||day>maxDay)throw new Error("TIMESTAMP_INVALID");
  return new Date(n).toISOString();
}
function safeId(v,kind){if(typeof v!=="string"||!idPattern.test(v))throw new Error(kind+"_INVALID");return v;}
export function normalizeTranscript(input) {
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("ARTIFACT_REQUIRED");
  if(!providers.has(input.provider))throw new Error("PROVIDER_UNSUPPORTED");
  const workspace=safeId(input.workspace_id,"WORKSPACE_ID");
  const meeting=safeId(input.meeting_id,"MEETING_ID");
  const c=input.consent;
  if(!c||c.authorized!==true||c.participants_notified!==true)throw new Error("MEETING_CONSENT_REQUIRED");
  if(!Array.isArray(input.turns)||input.turns.length<1||input.turns.length>limits.maxTurns)throw new Error("TRANSCRIPT_LIMIT");
  const unique=new Set();
  const turns=input.turns.map((item)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("INVALID_TURN");
    const source_event_id=safeId(item.source_event_id,"SOURCE_EVENT_ID");
    if(unique.has(source_event_id))throw new Error("DUPLICATE_EVENT_ID");
    unique.add(source_event_id);
    if(typeof item.speaker_ref!=="string"||item.speaker_ref.length<1||item.speaker_ref.length>80)throw new Error("SPEAKER_REF_REQUIRED");
    if(typeof item.text!=="string"||!item.text.trim()||item.text.length>limits.maxTurnText)throw new Error("INVALID_TEXT");
    const start=utc(item.start);const end=utc(item.end);
    const elapsed=Date.parse(end)-Date.parse(start);
    if(elapsed<0||elapsed>1800000)throw new Error("INVALID_INTERVAL");
    return {
      turn_id:"turn-"+hash([input.provider,meeting,source_event_id].join("|")).slice(0,20),
      source_event_id,speaker_ref:item.speaker_ref,start,end,text:item.text.trim()
    };
  }).sort((a,b)=>a.start.localeCompare(b.start)||a.source_event_id.localeCompare(b.source_event_id));
  const source_sha256=hash(JSON.stringify({provider:input.provider,workspace,meeting,turns}));
  const commitments=turns.filter(t=>/^\s*(?:I will\b|I'll\b|私が.{0,20}(?:します|やります)|僕が.{0,20}(?:します|やります))/i.test(t.text))
    .map(t=>({owner_ref:t.speaker_ref,due_date:null,evidence_turn_ids:[t.turn_id],source_quote:t.text.slice(0,240),status:"candidate"}));
  const dueUndecided=turns.some(t=>/\bdue date (?:is |remains )?(?:undecided|unknown|not decided)\b|期限.{0,10}未定/i.test(t.text));
  return {
    schema:"baton.meeting.draft/1.0.0",
    provider:input.provider,workspace_id:workspace,meeting_id:meeting,source_sha256,
    evidence:turns,
    draft:{
      status:"review_required",approved:false,
      action_candidates:commitments,decisions:[],
      due_date_status:dueUndecided?"explicitly_undecided":"not_established",
      note:"Draft candidates only; no automatically confirmed assignments, dates, decisions or introductions"
    },
    provenance:{recording:"not_performed",speaker_diarization:"not_performed",
      speaker_refs_from_source:true,model_inference:"not_performed",external_transfer:"not_performed"}
  };
}
export class InMemoryMeetings {
  #rows=new Map();
  importArtifact(payload) {
    const doc=normalizeTranscript(payload);
    const key=doc.workspace_id+"|"+doc.meeting_id;
    const prior=this.#rows.get(key);
    if(prior){
      if(prior.source_sha256!==doc.source_sha256)return {status:"CONFLICT",code:409};
      return {status:"ALREADY_EXISTS",doc:prior,code:200};
    }
    this.#rows.set(key,doc);
    return {status:"DRAFT_CREATED",doc,code:201};
  }
  find(workspaceId,meetingId) {
    const k=safeId(workspaceId,"WORKSPACE_ID")+"|"+safeId(meetingId,"MEETING_ID");
    return this.#rows.get(k)||null;
  }
  count(){return this.#rows.size}
}
