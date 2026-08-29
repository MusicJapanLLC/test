#!/usr/bin/env python3
"""Compile conversational AI-development requests into stable THE WORLD handoffs.

The LLM handles natural-language understanding. This deterministic layer normalizes
its request into one AI system specification so existing Foundry, Agent Factory,
Senju, QA, data and deployment assets can be reused without a parallel control plane.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

SCHEMA = "the-world-ai-system-spec/v1"

RESOURCES = {
    "brainbase": "conversation and orchestration",
    "openai_agents_sdk": "agent runtime and tools",
    "github": "source, branches, pull requests and CI evidence",
    "supabase": "durable tasks, runs, memory and lessons",
    "vercel": "preview deployment and runtime evidence",
    "context_dev": "current technical research",
    "exa": "current technical search",
    "agent_factory": "bounded implementation tournament",
    "senju": "parallel evaluation and evolution arena",
    "ai_security": "independent AI-system security review",
}

SPECIALISTS = {
    "architect": "System Architect",
    "alpha": "Full-stack Engineer Alpha",
    "beta": "Full-stack Engineer Beta",
    "qa": "QA & Release Gatekeeper",
    "security": "Application Security Auditor",
    "judge": "Arena Judge",
    "evolution": "Agent Evolution Engineer",
    "devops": "GitHub & DevOps Integrator",
    "research": "Research Lead",
}


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip())


def _has(text: str, *terms: str) -> bool:
    blob = text.lower()
    return any(term.lower() in blob for term in terms)


def project_id(request: str) -> str:
    return "aif_" + hashlib.sha256(_clean(request).lower().encode()).hexdigest()[:16]


def infer_mode(request: str) -> str:
    if _has(request, "bug", "error", "fix", "直して", "エラー", "壊れ"):
        return "DEBUG"
    if _has(request, "benchmark", "evaluate", "test", "評価", "検証"):
        return "EVAL"
    if _has(request, "improve", "evolve", "optimize", "改善", "強化", "進化"):
        return "EVOLVE"
    if _has(request, "build", "make", "create", "implement", "作って", "開発", "実装"):
        return "BUILD"
    return "DESIGN"


def detect_needs(request: str) -> dict[str, bool]:
    return {
        "code": _has(request, "code", "app", "api", "build", "実装", "開発", "作って", "改善"),
        "research": _has(request, "latest", "research", "compare", "最新", "調査", "研究", "比較"),
        "memory": _has(request, "memory", "rag", "database", "state", "記憶", "データベース", "永続"),
        "tools": _has(request, "tool", "mcp", "connector", "plugin", "github", "ツール", "コネクタ", "プラグイン", "連携"),
        "multi_agent": _has(request, "multi-agent", "subagent", "agent team", "サブエージェント", "エージェント群", "チーム"),
        "deploy": _has(request, "deploy", "vercel", "production", "preview", "公開", "デプロイ"),
        "retrieval": _has(request, "rag", "search", "retrieval", "knowledge", "検索", "ナレッジ", "文書"),
        "training": _has(request, "fine-tun", "train model", "weights", "ファインチューニング", "重み", "モデル学習"),
    }


def choose_resources(needs: dict[str, bool]) -> list[str]:
    result = ["brainbase", "github", "agent_factory", "ai_security"]
    if needs["code"] or needs["tools"] or needs["multi_agent"]:
        result.append("openai_agents_sdk")
    if needs["memory"] or needs["retrieval"] or needs["tools"]:
        result.append("supabase")
    if needs["research"] or needs["retrieval"]:
        result += ["context_dev", "exa"]
    if needs["deploy"] or needs["code"]:
        result.append("vercel")
    if needs["multi_agent"] or needs["training"]:
        result.append("senju")
    return list(dict.fromkeys(result))


def choose_specialists(needs: dict[str, bool], mode: str) -> list[str]:
    result = [SPECIALISTS["architect"]]
    if needs["research"]:
        result.append(SPECIALISTS["research"])
    if mode in {"BUILD", "DEBUG", "EVOLVE"} or needs["code"]:
        result += [SPECIALISTS["alpha"], SPECIALISTS["beta"], SPECIALISTS["devops"]]
    result += [SPECIALISTS["security"], SPECIALISTS["qa"], SPECIALISTS["judge"]]
    if mode == "EVOLVE" or needs["multi_agent"]:
        result.append(SPECIALISTS["evolution"])
    return list(dict.fromkeys(result))


def eval_cases(needs: dict[str, bool]) -> list[dict[str, str]]:
    cases = [
        {"id": "happy_path", "goal": "core request succeeds end-to-end"},
        {"id": "ambiguous_input", "goal": "low-risk omissions are handled without needless questioning"},
        {"id": "missing_evidence", "goal": "unknown facts remain unknown; execution is not invented"},
        {"id": "regression", "goal": "previously verified behavior remains verified"},
    ]
    if needs["tools"]:
        cases.append({"id": "tool_failure", "goal": "tool failure is recoverable and never reported as success"})
    if needs["memory"] or needs["retrieval"]:
        cases.append({"id": "memory_conflict", "goal": "conflicting or stale knowledge keeps provenance"})
    if needs["multi_agent"]:
        cases.append({"id": "agent_disagreement", "goal": "disagreement is resolved from evidence or stays unresolved"})
    if needs["deploy"]:
        cases.append({"id": "release_failure", "goal": "failed preview/release stays failed and reversible"})
    return cases


def top_track(program: dict[str, Any] | None) -> dict[str, Any] | None:
    rows = [x for x in ((program or {}).get("tracks") or []) if isinstance(x, dict)]
    return sorted(rows, key=lambda x: int(x.get("priority") or 0), reverse=True)[0] if rows else None


def compile_request(request: str, program: dict[str, Any] | None = None) -> dict[str, Any]:
    request = _clean(request)
    if not request:
        raise ValueError("request must not be empty")
    mode = infer_mode(request)
    needs = detect_needs(request)
    resources = choose_resources(needs)
    track = top_track(program)
    spec = {
        "schema": SCHEMA,
        "project_id": project_id(request),
        "source": "conversation",
        "request": request,
        "mode": mode,
        "job_to_be_done": request,
        "model_strategy": {
            "baseline": "foundation_model_plus_agent_system",
            "default_reasoning_model": "gpt-5.6-sol",
            "fine_tuning": "benchmark_first" if needs["training"] else "not_required_by_default",
            "model_routing": "adopt only after comparable quality/cost/latency evidence",
        },
        "needs": needs,
        "resources": [{"id": key, "purpose": RESOURCES[key]} for key in resources],
        "specialists": choose_specialists(needs, mode),
        "eval_plan": {
            "eval_first": True,
            "cases": eval_cases(needs),
            "required_evidence": [
                "reproducible execution or deterministic test",
                "independent verification for consequential changes",
                "before/after comparison for improvement claims",
                "limitations and negative evidence",
            ],
        },
        "execution": {
            "conversation_control_plane": "AI FOUNDRY CORE / Brainbase",
            "architecture": SPECIALISTS["architect"],
            "implementation": "THE WORLD Agent Factory + Alpha/Beta",
            "parallel_experiments": "Senju when additional candidates improve evidence",
            "verification": "AI Security + QA & Release Gatekeeper + Arena Judge",
            "source_of_truth": "GitHub branch/PR plus Supabase run evidence",
            "deployment": "Vercel preview before release when deployment is required",
            "existing_ai_dev_track": track,
        },
        "completion_gate": {
            "prose_only_complete": False,
            "self_verification": False,
            "durable_artifact_required": mode in {"BUILD", "DEBUG", "EVOLVE"},
            "comparable_eval_required": mode == "EVOLVE",
            "training_claim_requires_training_artifacts": True,
        },
    }
    spec["factory_handoff"] = {
        "schema": "the-world-ai-foundry-handoff/v1",
        "project_id": spec["project_id"],
        "mission_family": "ai",
        "title": "AI FOUNDRY: " + request[:120],
        "problem": request,
        "hypothesis": "Reusing the existing eval-first engineering system will produce a stronger result than creating a duplicate control plane.",
        "preferred_track_id": (track or {}).get("id"),
        "requested_resources": resources,
        "requested_specialists": spec["specialists"],
        "required_evidence": spec["eval_plan"]["required_evidence"],
        "pr_required": True,
    }
    return spec


def validate_spec(spec: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if spec.get("schema") != SCHEMA:
        errors.append("invalid_schema")
    if not str(spec.get("project_id") or "").startswith("aif_"):
        errors.append("invalid_project_id")
    if spec.get("mode") not in {"DESIGN", "BUILD", "EVAL", "DEBUG", "EVOLVE"}:
        errors.append("invalid_mode")
    ids = [x.get("id") for x in (spec.get("resources") or []) if isinstance(x, dict)]
    for core in ("brainbase", "github", "agent_factory", "ai_security"):
        if core not in ids:
            errors.append("missing_resource:" + core)
    gate = spec.get("completion_gate") or {}
    if gate.get("prose_only_complete") is not False:
        errors.append("prose_completion_enabled")
    if gate.get("self_verification") is not False:
        errors.append("self_verification_enabled")
    if not (spec.get("factory_handoff") or {}).get("pr_required"):
        errors.append("pr_gate_disabled")
    return errors


def load_json(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("compile")
    c.add_argument("--request", required=True)
    c.add_argument("--program", default="automation/ai_foundry/ai_development_program.json")
    c.add_argument("--out", required=True)
    v = sub.add_parser("validate")
    v.add_argument("--spec", required=True)
    args = parser.parse_args()

    if args.command == "compile":
        spec = compile_request(args.request, load_json(args.program))
        errors = validate_spec(spec)
        if errors:
            print(json.dumps({"ok": False, "errors": errors}, ensure_ascii=False))
            return 1
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"ok": True, "project_id": spec["project_id"], "mode": spec["mode"], "out": str(out)}, ensure_ascii=False))
        return 0

    errors = validate_spec(load_json(args.spec))
    print(json.dumps({"ok": not errors, "errors": errors}, ensure_ascii=False))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
