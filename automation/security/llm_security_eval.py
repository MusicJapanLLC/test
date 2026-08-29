#!/usr/bin/env python3
"""Deterministic defensive LLM boundary evaluation harness.

This module evaluates synthetic observations from owned/test environments only.
It does not call a model provider, access a network, inspect credentials, or test
third-party systems. Passing results prove only the deterministic policy harness
behavior represented by the supplied fixture, not broad LLM/provider security.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

OUTCOMES = {"ALLOW", "DENY", "REDACT", "REQUIRE_APPROVAL"}
BOUNDARIES = {"instruction", "tool", "data", "identity", "external-action"}


@dataclass(frozen=True)
class EvalResult:
    case_id: str
    boundary: str
    expected: str
    observed: str
    passed: bool
    reasons: tuple[str, ...]


def _require_text(value: Any, name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{name} is required")
    return text


def evaluate_case(case: dict[str, Any]) -> EvalResult:
    case_id = _require_text(case.get("case_id"), "case_id")
    boundary = _require_text(case.get("boundary"), "boundary")
    expected = _require_text(case.get("expected"), "expected")
    if boundary not in BOUNDARIES:
        raise ValueError(f"{case_id}: unsupported boundary {boundary!r}")
    if expected not in OUTCOMES:
        raise ValueError(f"{case_id}: unsupported expected outcome {expected!r}")

    observation = case.get("observation")
    if not isinstance(observation, dict):
        raise ValueError(f"{case_id}: observation must be an object")

    reasons: list[str] = []
    observed = "ALLOW"

    # Instruction boundary is fail-closed: untrusted content cannot expand policy.
    if bool(observation.get("policy_override_attempt")):
        observed = "DENY"
        reasons.append("untrusted input attempted to expand policy authority")

    # Tenant/identity separation outranks all lower-risk allow decisions.
    actor_tenant = observation.get("actor_tenant")
    resource_tenant = observation.get("resource_tenant")
    if actor_tenant and resource_tenant and actor_tenant != resource_tenant:
        observed = "DENY"
        reasons.append("actor tenant does not match resource tenant")

    # Tool execution is permitted only when explicitly allowlisted.
    requested_tool = observation.get("requested_tool")
    allowed_tools = {str(x) for x in observation.get("allowed_tools") or []}
    if requested_tool and str(requested_tool) not in allowed_tools:
        observed = "DENY"
        reasons.append("requested tool is outside the explicit allowlist")

    # Restricted synthetic data is redacted unless the actor has explicit scope.
    classification = str(observation.get("data_classification") or "public")
    actor_scopes = {str(x) for x in observation.get("actor_scopes") or []}
    if observed == "ALLOW" and classification == "restricted" and "restricted:read" not in actor_scopes:
        observed = "REDACT"
        reasons.append("restricted fixture requires explicit restricted:read scope")

    # Any external-write-equivalent sandbox action requires prior approval and an
    # explicit action allowlist. This never performs the action; it only evaluates.
    external_action = observation.get("external_action")
    allowed_actions = {str(x) for x in observation.get("allowed_actions") or []}
    if observed == "ALLOW" and external_action:
        if str(external_action) not in allowed_actions:
            observed = "DENY"
            reasons.append("external action is outside the explicit allowlist")
        elif not bool(observation.get("approval")):
            observed = "REQUIRE_APPROVAL"
            reasons.append("external action requires explicit approval")

    if not reasons:
        reasons.append("all synthetic boundary checks passed")

    return EvalResult(
        case_id=case_id,
        boundary=boundary,
        expected=expected,
        observed=observed,
        passed=observed == expected,
        reasons=tuple(reasons),
    )


def load_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("scope") != "synthetic-owned-fixtures-only":
        raise ValueError("fixture scope must be synthetic-owned-fixtures-only")
    cases = payload.get("cases")
    if not isinstance(cases, list) or not cases:
        raise ValueError("cases must be a non-empty list")
    return [c for c in cases if isinstance(c, dict)]


def evaluate_all(cases: list[dict[str, Any]]) -> list[EvalResult]:
    return [evaluate_case(case) for case in cases]


def metrics(results: list[EvalResult]) -> dict[str, Any]:
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    expected_denies = [r for r in results if r.expected in {"DENY", "REDACT", "REQUIRE_APPROVAL"}]
    correct_denies = sum(1 for r in expected_denies if r.passed)
    expected_allows = [r for r in results if r.expected == "ALLOW"]
    false_denies = sum(1 for r in expected_allows if r.observed != "ALLOW")
    restricted_cases = [r for r in results if r.boundary == "data"]
    leakage_count = sum(1 for r in restricted_cases if r.observed == "ALLOW" and r.expected != "ALLOW")
    return {
        "cases_total": total,
        "cases_passed": passed,
        "boundary_pass_rate": round(passed / total, 4) if total else 0.0,
        "deny_correctness": round(correct_denies / len(expected_denies), 4) if expected_denies else 1.0,
        "false_deny_count": false_denies,
        "sensitive_marker_leakage_count": leakage_count,
        "reproducibility_contract": "deterministic-synthetic-fixtures",
    }


def render_markdown(results: list[EvalResult], summary: dict[str, Any]) -> str:
    lines = [
        "# Standment LLM Security Eval — Synthetic Boundary Run",
        "",
        "**Status: TEST EVIDENCE / NOT PROVIDER VERIFICATION**",
        "",
        "This report proves only that the deterministic boundary evaluator behaves as expected on synthetic owned fixtures. It does not prove that any model provider, production agent, RAG system, or third-party integration is secure.",
        "",
        "## Result",
        "",
        f"- Cases: {summary['cases_passed']} / {summary['cases_total']} passed",
        f"- Boundary pass rate: {summary['boundary_pass_rate']:.0%}",
        f"- Deny correctness: {summary['deny_correctness']:.0%}",
        f"- False-deny count: {summary['false_deny_count']}",
        f"- Sensitive synthetic leakage count: {summary['sensitive_marker_leakage_count']}",
        "",
        "## Cases",
        "",
        "| Case | Boundary | Expected | Observed | Pass |",
        "|---|---|---|---|---|",
    ]
    for result in results:
        lines.append(
            f"| `{result.case_id}` | {result.boundary} | {result.expected} | {result.observed} | {'PASS' if result.passed else 'FAIL'} |"
        )
    lines.extend([
        "",
        "## Limitations",
        "",
        "- No live model/API was called.",
        "- No third-party system or credential was accessed.",
        "- No claim is made about jailbreak resistance, model robustness, or production isolation beyond these fixtures.",
        "- Promotion to VERIFIED still requires an owned integration run, preserved observations, counterevidence, remediation where applicable, and an independent retest.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", default="standment-security/ai-security/llm-security-eval-cases.json")
    parser.add_argument("--json-out", default="reports/llm-security-eval/result.json")
    parser.add_argument("--md-out", default="reports/llm-security-eval/result.md")
    args = parser.parse_args()

    results = evaluate_all(load_cases(Path(args.cases)))
    summary = metrics(results)
    payload = {
        "schema": "standment-llm-security-eval-result/v1",
        "scope": "synthetic-owned-fixtures-only",
        "verified_claim": False,
        "summary": summary,
        "results": [
            {
                "case_id": r.case_id,
                "boundary": r.boundary,
                "expected": r.expected,
                "observed": r.observed,
                "passed": r.passed,
                "reasons": list(r.reasons),
            }
            for r in results
        ],
    }

    json_out = Path(args.json_out)
    md_out = Path(args.md_out)
    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_out.write_text(render_markdown(results, summary), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary["cases_passed"] == summary["cases_total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
