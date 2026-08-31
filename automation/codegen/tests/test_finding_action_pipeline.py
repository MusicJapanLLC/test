import json
import sys
from pathlib import Path

CODEGEN_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODEGEN_DIR))

from engine.finding_action_pipeline import run_finding_action_pipeline


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _seed_repo(root: Path) -> None:
    _write(
        root / "AUTHORIZED_TEST_TARGETS.json",
        {
            "targets": [
                {
                    "owner_authorization": "explicit",
                    "host": "owned.example.com",
                    "base_url": "https://owned.example.com",
                }
            ]
        },
    )
    _write(root / "senju/config/authorized-test-federation.json", {"domain_roots": []})
    _write(root / "automation/codegen/meta_state/discovery_policy.json", {"trusted_roots": []})


def test_finding_becomes_action_only_for_existing_explicit_authority(tmp_path: Path):
    repo = tmp_path / "repo"
    state = repo / "automation/codegen/meta_state"
    _seed_repo(repo)
    _write(
        state / "adversary_findings.json",
        {
            "findings": [
                {"case": "owned", "target_url": "https://owned.example.com/probe"},
                {"case": "outside", "target_url": "https://outside.example.net/probe"},
            ]
        },
    )

    result = run_finding_action_pipeline(state, repo_root=repo, execute=False)

    assert [item["host"] for item in result["planned_actions"]] == ["owned.example.com"]
    assert result["planned_actions"][0]["method"] == "HEAD"
    assert result["planned_actions"][0]["credential_scope"] == "none"
    assert result["planned_actions"][0]["effect"] == "read_only"
    assert any(item["host"] == "outside.example.net" for item in result["blocked"])


def test_invalid_or_non_https_finding_never_reaches_authority_review(tmp_path: Path):
    repo = tmp_path / "repo"
    state = repo / "automation/codegen/meta_state"
    _seed_repo(repo)
    _write(
        state / "adversary_findings.json",
        {
            "findings": [
                {"target_url": "http://owned.example.com/plain"},
                {"target_url": "https://user:pass@owned.example.com/secret"},
                {"target_url": "https://owned.example.com:444/odd"},
                {"detail": "no target"},
            ]
        },
    )

    result = run_finding_action_pipeline(state, repo_root=repo)
    assert result["candidate_count"] == 0
    assert result["planned_actions"] == []
    assert len(result["rejected_findings"]) == 4


class _Receipt:
    def to_dict(self):
        return {"status": 200, "method": "HEAD", "final_url": "https://owned.example.com/probe"}


class _FakeClient:
    def __init__(self, calls):
        self.calls = calls

    def contact(self, url: str, *, method: str = "GET"):
        self.calls.append((url, method))
        return _Receipt()


def test_execute_path_uses_head_without_credentials_or_write_methods(tmp_path: Path):
    repo = tmp_path / "repo"
    state = repo / "automation/codegen/meta_state"
    _seed_repo(repo)
    _write(
        state / "adversary_findings.json",
        {"findings": [{"target_url": "https://owned.example.com/probe"}]},
    )

    calls = []
    result = run_finding_action_pipeline(
        state,
        repo_root=repo,
        execute=True,
        contact_factory=lambda host: _FakeClient(calls),
    )

    assert calls == [("https://owned.example.com/probe", "HEAD")]
    assert result["executed_count"] == 1
    assert result["errors"] == []
