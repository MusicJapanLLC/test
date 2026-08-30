"""External AI advisor bridge for Senju's daily improvement loop.

Senju may ask the configured advisors broad engineering/research questions. Advice may
be promoted into a repository implementation request when the Foundry synthesis marks
it implementable. Actual code changes remain behind the existing test/repair/PR lane.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path
from typing import Any

PERSONAL_AI_UI = "https://standment-personal-ai-core-se1c3z.v2.appdeploy.ai/"
PERSONAL_AI_CHAT = f"{PERSONAL_AI_UI.rstrip('/')}/api/chat"
FOUNDRY_UI = "https://test-git-feat-ai-foundry-forge-v2-musicjapanllc.vercel.app/"
FOUNDRY_RUNTIME = "https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/ai-foundry-runtime"
WORKSPACE = hashlib.sha256(b"senju-ai-advisor-hub-v1").hexdigest()[:32]


def _post_json(url: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode(),
        method="POST",
        headers={"content-type": "application/json", "user-agent": "senju-advisor-hub/v1"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read().decode()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise RuntimeError("advisor returned a non-object JSON response")
    return data


def _summary_text(summary: dict[str, Any]) -> str:
    selected = summary.get("selected") if isinstance(summary.get("selected"), dict) else {}
    return json.dumps(
        {
            "accepted_strategy_change": summary.get("accepted_strategy_change"),
            "changes": summary.get("changes"),
            "score": selected.get("score"),
            "balance": selected.get("balance"),
            "learning_signal": selected.get("learning_signal"),
            "rating_gain": selected.get("rating_gain"),
            "safe": selected.get("safe"),
            "code_suggestions": summary.get("code_suggestions"),
        },
        ensure_ascii=False,
        indent=2,
    )


def personal_prompt(summary: dict[str, Any]) -> str:
    return f"""You are an always-available senior advisor to the Senju engineering team.
Senju may ask you about any topic that could improve its architecture, agent design,
research method, simulation quality, reliability, observability, UX, tests, developer
workflow, defensive security, performance, or maintainability. Be concrete and
implementation-oriented. Do not claim that code was changed unless a tool result proves it.

Current Senju daily evaluation:
{_summary_text(summary)}

Return the 1-3 highest-leverage improvements. For each, state: problem, proposed change,
files/components likely affected, acceptance tests, expected signal, and main risk. Prefer
small changes that can be tested and reviewed in a pull request."""


def ask_personal_ai(summary: dict[str, Any]) -> dict[str, Any]:
    data = _post_json(
        PERSONAL_AI_CHAT,
        {"workspace": WORKSPACE, "message": personal_prompt(summary)},
        timeout=120,
    )
    answer = str(data.get("answer") or "").strip()
    if not answer:
        raise RuntimeError("Personal AI Core returned no answer")
    return {
        "ok": True,
        "answer": answer[:20000],
        "run_id": str(data.get("runId") or ""),
        "session_id": str(data.get("sessionId") or ""),
    }


def _extract_json(text: str) -> dict[str, Any]:
    clean = text.strip()
    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.I)
    clean = re.sub(r"\s*```$", "", clean)
    start, end = clean.find("{"), clean.rfind("}")
    if start < 0 or end <= start:
        raise RuntimeError("Foundry response did not contain JSON")
    data = json.loads(clean[start : end + 1])
    if not isinstance(data, dict):
        raise RuntimeError("Foundry decision was not a JSON object")
    return data


def ask_foundry(summary: dict[str, Any], personal_answer: str) -> dict[str, Any]:
    system = """You are AI FOUNDRY acting as Senju's implementation gate. Synthesize the
current evaluation and another AI advisor's recommendations into one focused engineering
change. Return ONLY strict JSON with keys: implement (boolean), request (string), rationale
(string), priority (low|medium|high), tests (array of strings), risks (array of strings).
Set implement=true only when a concrete, testable repository improvement is justified.
The implementation request must stay within Senju's own repository/project code and
owner-controlled development resources. Do not widen third-party target scope, request
credentials, weaken authorization boundaries, or claim tests have already passed. Prefer
small PR-sized changes with measurable acceptance criteria."""
    user = (
        "CURRENT SENJU EVALUATION:\n"
        + _summary_text(summary)
        + "\n\nPERSONAL AI CORE ADVICE:\n"
        + (personal_answer or "(advisor unavailable; decide from the evaluation alone)")[:20000]
    )
    response = _post_json(
        FOUNDRY_RUNTIME,
        {"action": "runtime", "systemPrompt": system, "messages": [{"role": "user", "content": user}]},
        timeout=180,
    )
    decision = _extract_json(str(response.get("text") or ""))
    decision["implement"] = bool(decision.get("implement"))
    decision["request"] = str(decision.get("request") or "")[:12000]
    decision["rationale"] = str(decision.get("rationale") or "")[:4000]
    priority = str(decision.get("priority") or "medium").lower()
    decision["priority"] = priority if priority in {"low", "medium", "high"} else "medium"
    decision["tests"] = [str(x)[:500] for x in (decision.get("tests") or []) if isinstance(x, str)][:8]
    decision["risks"] = [str(x)[:500] for x in (decision.get("risks") or []) if isinstance(x, str)][:8]
    if decision["implement"] and not decision["request"].strip():
        decision["implement"] = False
        decision["rationale"] = "Foundry marked implementation but supplied no request."
    return decision


def foundry_payload(decision: dict[str, Any], run_id: str) -> dict[str, Any]:
    request = str(decision.get("request") or "").strip()
    guarded = (
        "Implement this Senju self-improvement as one focused, reviewable patch. "
        "Keep all code changes under senju/**. Do not modify .github/workflows, secrets, "
        "credentials, third-party target scope, or authorization policy. Add/update tests "
        "for the changed behavior and preserve unrelated behavior.\n\n"
        + request
    )
    return {"job": {"id": run_id, "request": {"request_text": guarded}}}


def run(summary_path: str, out_path: str, payload_path: str) -> dict[str, Any]:
    summary = json.loads(Path(summary_path).read_text(encoding="utf-8"))
    personal: dict[str, Any]
    try:
        personal = ask_personal_ai(summary)
    except Exception as exc:
        personal = {"ok": False, "answer": "", "error": f"{type(exc).__name__}: {exc}"[:2000]}

    try:
        decision = ask_foundry(summary, str(personal.get("answer") or ""))
        foundry_error = ""
    except Exception as exc:
        decision = {
            "implement": False,
            "request": "",
            "rationale": "Foundry synthesis unavailable; no automatic implementation promoted.",
            "priority": "low",
            "tests": [],
            "risks": [],
        }
        foundry_error = f"{type(exc).__name__}: {exc}"[:2000]

    run_id = "senju-advisor-" + hashlib.sha256(
        json.dumps(summary, sort_keys=True, default=str).encode()
    ).hexdigest()[:12]
    result = {
        "schema": "senju-ai-advisor-hub/v1",
        "sources": {
            "personal_ai_core": PERSONAL_AI_UI,
            "ai_foundry": FOUNDRY_UI,
        },
        "personal_ai": personal,
        "decision": decision,
        "foundry_error": foundry_error,
        "implementation_lane": "AI Foundry Repo Engineer -> sandbox tests/repair -> pull request",
        "run_id": run_id,
    }
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    payload = foundry_payload(decision, run_id) if decision.get("implement") else {"job": {}}
    target = Path(payload_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    p = argparse.ArgumentParser(description="Ask Senju's Personal AI Core + AI Foundry advisors")
    p.add_argument("--summary", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--payload-out", required=True)
    args = p.parse_args()
    result = run(args.summary, args.out, args.payload_out)
    print(json.dumps({"implement": result["decision"]["implement"], "priority": result["decision"]["priority"]}))


if __name__ == "__main__":
    main()
