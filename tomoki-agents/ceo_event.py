#!/usr/bin/env python3
"""Convert a TOMOKI report into a small public-safe CEO event."""
from __future__ import annotations
import argparse, json
from pathlib import Path

def compact(text: str, limit: int = 700) -> str:
    lines=[line.strip() for line in text.splitlines() if line.strip()]
    return " / ".join(lines[:8])[:limit]

def classify(agent: str, status: str, body: str) -> tuple[str, bool]:
    a=agent.upper(); s=status.lower(); b=body.lower()
    if any(x in s for x in ("failure","error","blocked")): return "BLOCKED", True
    if a=="SKEPTIC":
        if "bad" in b: return "BLOCKED", True
        if "watch" in b or "まだ信用していない" in body: return "BUILDING", True
        return "VERIFIED", False
    if a=="HOUND":
        material="まだ終わってない" in body or "長く放置" in body or "今回また出た" in body
        return ("BUILDING" if material else "VERIFIED"), material
    if a=="FORGE":
        if "merged" in s: return "VERIFIED", True
        if any(x in s for x in ("revert","reject")): return "EXPERIMENT", True
        if any(x in s for x in ("pr-created","validated-patch","branch-only")): return "BUILDING", True
        return "EXPERIMENT", False
    return "BUILDING", True

def main() -> int:
    p=argparse.ArgumentParser(); p.add_argument("--agent",required=True); p.add_argument("--file",required=True); p.add_argument("--status",default="unknown"); p.add_argument("--out",required=True); args=p.parse_args()
    path=Path(args.file); body=path.read_text(encoding="utf-8",errors="replace") if path.exists() else "report missing"
    state,notify=classify(args.agent,args.status,body)
    event={"schema":"ai-factory-ceo-event/v1","project":f"TOMOKI / {args.agent.upper()}","state":state,"summary":compact(body),"audit_result":args.status,"counts":{},"priorities":{},"owner_action":"NONE","business_effect":"AI社員の成果・失敗・放置を独立監査し、未検証の成功報告や再発をCEO層へ上げる。","next_improvement":"監査結果を次のTOMOKI runとFORGE実験へ引き継ぎ、同じ失敗を繰り返さない。","notify_ceo":notify,"privacy":"public-safe summary only; no secrets/customer payloads"}
    out=Path(args.out); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(event,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"CEO event written: {out} notify={str(notify).lower()} state={state}"); return 0
if __name__=="__main__": raise SystemExit(main())
