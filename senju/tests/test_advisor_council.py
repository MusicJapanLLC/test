from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from senju.advisor_council import (
    DEFAULT_SOURCES,
    AdvisorCouncilError,
    SenjuAdvisorCouncil,
)


class FakeResult:
    def __init__(self, data: dict, *, status: int = 200, digest: str = "abc123"):
        self._data = data
        self.receipt = SimpleNamespace(
            provider_acknowledged=True,
            status=status,
            response_sha256=digest,
            contacted_at_utc="2026-08-30T15:30:00+00:00",
        )

    def json(self):
        return self._data


class FakeClient:
    def __init__(self, data: dict | None = None, error: Exception | None = None):
        self.data = data or {}
        self.error = error
        self.calls = []

    def contact_with_body(self, url, *, method="GET", body=None, headers=None):
        self.calls.append((url, method, body, headers))
        if self.error:
            raise self.error
        return FakeResult(self.data)


def _clients():
    return {
        "standment_personal_ai_core": FakeClient(
            {"answer": "Personal AI answer: implement module A and test it."}
        ),
        "ai_foundry_forge_v2": FakeClient(
            {
                "text": "FOUNDRY answer: add module B with regression tests.",
                "model": "openai/gpt-5.6-sol",
                "profile": "development-max",
            }
        ),
    }


def test_any_question_is_forwarded_without_topic_filter(tmp_path):
    clients = _clients()
    council = SenjuAdvisorCouncil(clients=clients, out_dir=tmp_path)

    question = "哲学でも営業でもPythonでも、今のSenju改善でも自由に答えて"
    answers = council.ask(question, context="current repo context")

    assert len(answers) == 2
    assert all(answer.ok for answer in answers)
    for client in clients.values():
        assert client.calls
        _, method, raw_body, headers = client.calls[0]
        assert method == "POST"
        assert headers["Content-Type"] == "application/json"
        payload_text = raw_body.decode("utf-8")
        assert question in payload_text
        assert "You may be asked any question" in payload_text


def test_provider_payload_contracts_are_correct(tmp_path):
    clients = _clients()
    council = SenjuAdvisorCouncil(clients=clients, out_dir=tmp_path)
    council.ask("How should Senju improve?")

    personal_payload = json.loads(
        clients["standment_personal_ai_core"].calls[0][2].decode("utf-8")
    )
    assert len(personal_payload["workspace"]) == 32
    assert personal_payload["message"]

    foundry_payload = json.loads(
        clients["ai_foundry_forge_v2"].calls[0][2].decode("utf-8")
    )
    assert foundry_payload["action"] == "chat"
    assert foundry_payload["messages"][0]["role"] == "user"


def test_one_provider_failure_does_not_block_other_answer(tmp_path):
    clients = _clients()
    clients["standment_personal_ai_core"] = FakeClient(error=RuntimeError("down"))
    council = SenjuAdvisorCouncil(clients=clients, out_dir=tmp_path)

    answers = council.ask("continue despite one provider failing")

    assert len(answers) == 2
    assert any(answer.ok for answer in answers)
    assert any(answer.error for answer in answers)


def test_all_provider_failures_raise(tmp_path):
    clients = {
        source.source_id: FakeClient(error=RuntimeError("down"))
        for source in DEFAULT_SOURCES
    }
    council = SenjuAdvisorCouncil(clients=clients, out_dir=tmp_path)

    with pytest.raises(AdvisorCouncilError):
        council.ask("anything")


def test_handoff_explicitly_allows_implementation_but_not_raw_execution(tmp_path):
    clients = _clients()
    council = SenjuAdvisorCouncil(clients=clients, out_dir=tmp_path)
    answers = council.ask("Propose a concrete repo improvement")

    bundle = council.build_handoff(
        "Propose a concrete repo improvement",
        answers,
        base_sha="deadbeef",
    )

    assert bundle["implementation_candidate"] is True
    assert bundle["recommended_next_agent"] == "Jules"
    assert bundle["rules"]["questions"] == "any_topic_allowed"
    assert bundle["rules"]["answers"] == "may_be_used_for_implementation"
    assert bundle["rules"]["direct_execution_of_answer_text"] is False
    assert bundle["rules"]["tests_required_for_code_changes"] is True


def test_run_cycle_persists_latest_bundle(tmp_path):
    council = SenjuAdvisorCouncil(clients=_clients(), out_dir=tmp_path)
    result = council.run_cycle(
        "Improve Senju",
        context="active development",
        base_sha="abc",
    )

    latest = tmp_path / "latest.json"
    assert latest.exists()
    data = json.loads(latest.read_text(encoding="utf-8"))
    assert data["schema"] == "senju-ai-advisor-handoff/v1"
    assert data["question"] == "Improve Senju"
    assert data["base_sha"] == "abc"
    assert result["artifact"]
