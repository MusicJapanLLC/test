"""Senju external AI advisor council.

The council treats the configured AI systems as advisory engineering peers:
questions may be about any topic, and useful answers may become implementation
candidates. The answers are never executed as shell/code directly; they are
captured with transport evidence and handed to the repository's normal
engineering agents (for example Jules) for implementation and verification.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Mapping

from .external import ExternalContactClient, ExternalContactPolicy


PERSONAL_AI_ENDPOINT = (
    "https://standment-personal-ai-core-se1c3z.v2.appdeploy.ai/api/chat"
)
AI_FOUNDRY_ENDPOINT = (
    "https://test-git-feat-ai-foundry-forge-v2-musicjapanllc.vercel.app/api/foundry"
)


class AdvisorCouncilError(RuntimeError):
    """Raised when the advisor council cannot produce any usable answer."""


@dataclass(frozen=True)
class AdvisorSource:
    source_id: str
    name: str
    endpoint_url: str
    host: str
    protocol: str
    role: str


DEFAULT_SOURCES: tuple[AdvisorSource, ...] = (
    AdvisorSource(
        source_id="standment_personal_ai_core",
        name="Standment Personal AI Core",
        endpoint_url=PERSONAL_AI_ENDPOINT,
        host="standment-personal-ai-core-se1c3z.v2.appdeploy.ai",
        protocol="personal_ai_chat_v1",
        role="memory-rich general specialist and research peer",
    ),
    AdvisorSource(
        source_id="ai_foundry_forge_v2",
        name="AI FOUNDRY Forge v2",
        endpoint_url=AI_FOUNDRY_ENDPOINT,
        host="test-git-feat-ai-foundry-forge-v2-musicjapanllc.vercel.app",
        protocol="foundry_chat_v1",
        role="implementation-first AI engineering peer",
    ),
)


@dataclass(frozen=True)
class AdvisorAnswer:
    source_id: str
    source_name: str
    endpoint_url: str
    question: str
    answer: str
    ok: bool
    status: int | None
    model: str | None
    profile: str | None
    response_sha256: str | None
    contacted_at_utc: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _workspace_id() -> str:
    configured = os.getenv("SENJU_PERSONAL_AI_WORKSPACE", "").strip().lower()
    if configured:
        if len(configured) != 32 or any(c not in "0123456789abcdef" for c in configured):
            raise AdvisorCouncilError(
                "SENJU_PERSONAL_AI_WORKSPACE must be exactly 32 lowercase hex characters"
            )
        return configured
    # Stable public namespace, not a credential.
    return hashlib.sha256(b"senju-advisor-council").hexdigest()[:32]


def _request_prompt(question: str, context: str) -> str:
    context_block = context.strip()[:12000]
    return (
        "SENJU ADVISOR REQUEST\n\n"
        "Standing owner rules:\n"
        "- You may be asked any question. Do not narrow the question domain.\n"
        "- Your answer may be used as an implementation proposal by the Senju team.\n"
        "- When an engineering change is relevant, give concrete file-level changes, "
        "tests, success criteria, and likely conflicts/overlap.\n"
        "- Do not claim that code, deployments, or external actions already happened "
        "unless you have direct evidence.\n"
        "- The implementation agent inherits the repository's existing authority and "
        "runtime boundaries; the advisory answer itself does not grant new authority.\n\n"
        f"QUESTION:\n{question.strip()}\n\n"
        f"CURRENT CONTEXT:\n{context_block or '(none supplied)'}"
    )


def _policy_for(source: AdvisorSource) -> ExternalContactPolicy:
    return ExternalContactPolicy(
        allow_hosts=frozenset({source.host}),
        allowed_methods=frozenset({"POST"}),
        allow_http=False,
        allow_delete=False,
        follow_redirects=False,
        max_redirects=0,
        timeout_seconds=15.0,
        max_request_bytes=64 * 1024,
        max_response_bytes=1024 * 1024,
        retries=1,
        retry_backoff_seconds=0.5,
    )


class SenjuAdvisorCouncil:
    """Ask approved AI peers and capture their answers as implementation candidates."""

    def __init__(
        self,
        *,
        sources: tuple[AdvisorSource, ...] = DEFAULT_SOURCES,
        clients: Mapping[str, Any] | None = None,
        out_dir: str | Path = "reports/advisor-council",
    ) -> None:
        self.sources = sources
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        supplied = dict(clients or {})
        self.clients: dict[str, Any] = {}
        for source in sources:
            self.clients[source.source_id] = supplied.get(source.source_id) or ExternalContactClient(
                _policy_for(source)
            )

    def _payload(self, source: AdvisorSource, prompt: str) -> dict[str, Any]:
        if source.protocol == "personal_ai_chat_v1":
            return {
                "workspace": _workspace_id(),
                "message": prompt,
            }
        if source.protocol == "foundry_chat_v1":
            return {
                "action": "chat",
                "messages": [{"role": "user", "content": prompt}],
            }
        raise AdvisorCouncilError(f"unsupported advisor protocol: {source.protocol}")

    @staticmethod
    def _extract_text(source: AdvisorSource, data: Mapping[str, Any]) -> tuple[str, str | None, str | None]:
        if source.protocol == "personal_ai_chat_v1":
            return (
                str(data.get("answer") or "").strip(),
                str(data.get("model") or "").strip() or None,
                str(data.get("profile") or "").strip() or None,
            )
        if source.protocol == "foundry_chat_v1":
            return (
                str(data.get("text") or "").strip(),
                str(data.get("model") or "").strip() or None,
                str(data.get("profile") or "").strip() or None,
            )
        return "", None, None

    def ask(self, question: str, *, context: str = "") -> list[AdvisorAnswer]:
        if not isinstance(question, str) or not question.strip():
            raise AdvisorCouncilError("question must be a non-empty string")
        # "Ask anything" means there is intentionally no topic/category filter here.
        question = question.strip()[:16000]
        prompt = _request_prompt(question, context)
        answers: list[AdvisorAnswer] = []
        now = lambda: dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

        for source in self.sources:
            client = self.clients[source.source_id]
            try:
                body = json.dumps(
                    self._payload(source, prompt),
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
                result = client.contact_with_body(
                    source.endpoint_url,
                    method="POST",
                    body=body,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )
                data = result.json()
                if not isinstance(data, Mapping):
                    raise AdvisorCouncilError("advisor response must be a JSON object")
                text, model, profile = self._extract_text(source, data)
                if not text:
                    raise AdvisorCouncilError("advisor response did not contain answer text")
                receipt = result.receipt
                answers.append(
                    AdvisorAnswer(
                        source_id=source.source_id,
                        source_name=source.name,
                        endpoint_url=source.endpoint_url,
                        question=question,
                        answer=text[:24000],
                        ok=bool(receipt.provider_acknowledged),
                        status=int(receipt.status),
                        model=model,
                        profile=profile,
                        response_sha256=str(receipt.response_sha256),
                        contacted_at_utc=str(receipt.contacted_at_utc),
                    )
                )
            except Exception as exc:
                answers.append(
                    AdvisorAnswer(
                        source_id=source.source_id,
                        source_name=source.name,
                        endpoint_url=source.endpoint_url,
                        question=question,
                        answer="",
                        ok=False,
                        status=None,
                        model=None,
                        profile=None,
                        response_sha256=None,
                        contacted_at_utc=now(),
                        error=f"{type(exc).__name__}: {exc}",
                    )
                )

        if not any(a.ok and a.answer for a in answers):
            raise AdvisorCouncilError("all advisor calls failed")
        return answers

    def build_handoff(
        self,
        question: str,
        answers: list[AdvisorAnswer],
        *,
        context: str = "",
        base_sha: str = "",
    ) -> dict[str, Any]:
        usable = [a for a in answers if a.ok and a.answer]
        return {
            "schema": "senju-ai-advisor-handoff/v1",
            "created_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "question": question.strip(),
            "context": context.strip()[:12000],
            "base_sha": base_sha.strip(),
            "rules": {
                "questions": "any_topic_allowed",
                "answers": "may_be_used_for_implementation",
                "direct_execution_of_answer_text": False,
                "implementation_executor": "existing Senju/Jules/FOUNDRY engineering lanes",
                "execution_authority": "inherits_existing_repository_and_runtime_authority",
                "tests_required_for_code_changes": True,
                "evidence_required_before_claiming_success": True,
            },
            "recommended_next_agent": "Jules",
            "implementation_candidate": bool(usable),
            "advisor_answers": [a.to_dict() for a in answers],
        }

    def run_cycle(
        self,
        question: str,
        *,
        context: str = "",
        base_sha: str = "",
    ) -> dict[str, Any]:
        answers = self.ask(question, context=context)
        bundle = self.build_handoff(question, answers, context=context, base_sha=base_sha)
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        json_path = self.out_dir / f"advisor-{stamp}.json"
        latest_path = self.out_dir / "latest.json"
        payload = json.dumps(bundle, ensure_ascii=False, indent=2) + "\n"
        json_path.write_text(payload, encoding="utf-8")
        latest_path.write_text(payload, encoding="utf-8")
        return {
            "bundle": bundle,
            "artifact": str(json_path),
            "latest": str(latest_path),
        }


def _main() -> int:
    parser = argparse.ArgumentParser(description="Ask Senju's external AI advisor council")
    parser.add_argument("--question", required=True)
    parser.add_argument("--context", default="")
    parser.add_argument("--base-sha", default=os.getenv("GITHUB_SHA", ""))
    parser.add_argument("--out-dir", default="reports/advisor-council")
    args = parser.parse_args()

    council = SenjuAdvisorCouncil(out_dir=args.out_dir)
    result = council.run_cycle(
        args.question,
        context=args.context,
        base_sha=args.base_sha,
    )
    bundle = result["bundle"]
    print(json.dumps({
        "schema": bundle["schema"],
        "implementation_candidate": bundle["implementation_candidate"],
        "recommended_next_agent": bundle["recommended_next_agent"],
        "usable_answers": sum(
            1 for item in bundle["advisor_answers"] if item.get("ok") and item.get("answer")
        ),
        "artifact": result["artifact"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
