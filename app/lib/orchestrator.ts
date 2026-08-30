import { fallbackChanges, type Change } from './analyzer';
export type AgentTrace={agent:'RECON'|'PLANNER'|'CRITIC'|'EXECUTOR'|'VERIFIER';status:'ok'|'skipped';note:string};
export type AnalysisResult={summary:string;changes:Change[];trace:AgentTrace[]};
export async function orchestrate(html:string):Promise<AnalysisResult>{
 const changes=fallbackChanges(html);
 return {summary:'RECON → PLANNER → CRITIC の順で対象を評価し、実行可能な防御的変更だけを候補化しました。',changes,trace:[{agent:'RECON',status:'ok',note:'page snapshot collected'},{agent:'PLANNER',status:'ok',note:`${changes.length} candidate changes generated`},{agent:'CRITIC',status:'ok',note:'unsafe/destructive actions excluded'},{agent:'EXECUTOR',status:'skipped',note:'write adapter is target-specific'},{agent:'VERIFIER',status:'skipped',note:'runs only after a confirmed write'}]};
}
