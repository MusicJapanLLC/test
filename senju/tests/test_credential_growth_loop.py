from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "senju" / "scripts" / "credential_growth_loop.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("credential_growth_loop_test", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_extracts_required_scopes_from_nested_denial_state():
    module = _load_module()
    state = {
        "chains": {
            "a": {
                "required_authority": "repo:write:pr",
                "attempts": [
                    {"metadata": {"required_permission": "workflow:dispatch:approved"}},
                    {"required_scopes": ["repo:read", "repo:pr:review"]},
                ],
            }
        }
    }
    assert module._extract_required_scopes(state) == {
        "repo:write:pr",
        "workflow:dispatch:approved",
        "repo:read",
        "repo:pr:review",
    }


def test_missing_safe_scope_becomes_approval_request_but_admin_scope_never_does(tmp_path, monkeypatch):
    module = _load_module()
    plan_file = tmp_path / "plan.json"
    request_file = tmp_path / "requests.ndjson"
    monkeypatch.setattr(module, "PLAN_FILE", plan_file)
    monkeypatch.setattr(module, "REQUEST_FILE", request_file)

    requests, blocked = module._queue_grant_requests(
        "META", {"repo:write:pr", "repo:admin", "credentials:read"}
    )

    assert [r["requested_scope"] for r in requests] == ["repo:write:pr"]
    assert requests[0]["status"] == "approval_required"
    assert requests[0]["self_grant"] is False
    assert requests[0]["oauth_scope_mutation"] is False
    assert set(blocked) == {"repo:admin", "credentials:read"}

    lines = request_file.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["requested_scope"] == "repo:write:pr"


def test_grant_request_is_deduped_against_current_plan(tmp_path, monkeypatch):
    module = _load_module()
    plan_file = tmp_path / "plan.json"
    request_file = tmp_path / "requests.ndjson"
    plan_file.write_text(json.dumps({
        "grant_requests": [{"request_key": "X:workflow:dispatch:approved"}]
    }), encoding="utf-8")
    monkeypatch.setattr(module, "PLAN_FILE", plan_file)
    monkeypatch.setattr(module, "REQUEST_FILE", request_file)

    requests, blocked = module._queue_grant_requests(
        "X", {"workflow:dispatch:approved"}
    )

    assert len(requests) == 1
    assert blocked == []
    assert not request_file.exists()
