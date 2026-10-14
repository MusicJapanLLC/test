"""Autonomous, repository-local boundary research for Senju.

The loop searches for unexpected accepts in real boundary implementations and turns
any counterexample into persistent evidence, a Senju red-team WorkItem, a hardening
request, and a cross-loop handoff. Denials never become permission and probes have no
external side effects.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .engine import AutonomyEngine
from .queue import WorkItem
from ..authority_factory import root_from_external_scope
from ..credential_broker import CredentialBroker, CredentialGrant
from ..emergency_stop_state import (
    apply_majority_vote,
    apply_recovery_state,
    apply_replica_state,
    apply_rollback_state,
    apply_self_tuning,
    engage_emergency_stop,
    restore_checkpoint,
)
from ..external import ExternalAuthorityScope
from ..replica_credential_lineage import ReplicaCredentialLineage
from ..meta.standing_authorization import (
    create_standing_authorization,
    renew_operational_lease,
    revoke_standing_authorization,
)

RESEARCH_SCHEMA = "senju-autonomous-boundary-research/v1"
STATE_SCHEMA = "senju-autonomous-boundary-research-state/v1"
HANDOFF_SCHEMA = "senju-boundary-research-handoff/v1"
MAX_MUTATION_BUDGET = 128


@dataclasses.dataclass(frozen=True)
class ProbeCase:
    case_id: str
    family: str
    expected: str
    run: Callable[[], Mapping[str, Any]]
    description: str


@dataclasses.dataclass(frozen=True)
class ProbeResult:
    case_id: str
    family: str
    expected: str
    actual: str
    passed: bool
    description: str
    detail: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def _stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return dict(value) if isinstance(value, Mapping) else {}


def _exception_probe(fn: Callable[[], Any]) -> Mapping[str, Any]:
    try:
        value = fn()
    except Exception as exc:
        return {"outcome": "denied", "exception": type(exc).__name__, "message": str(exc)[:240]}
    return {"outcome": "accepted", "result_type": type(value).__name__}


def _emergency_probe(source: str) -> Mapping[str, Any]:
    state: dict[str, Any] = {}
    engage_emergency_stop(state, source="owner-test", reason="boundary research")
    candidate = {"emergency_stop": False, "research_marker": source}
    operations = {
        "checkpoint": lambda: restore_checkpoint(state, candidate),
        "recovery": lambda: apply_recovery_state(state, candidate),
        "rollback": lambda: apply_rollback_state(state, candidate),
        "replica": lambda: apply_replica_state(state, candidate),
        "self_tuning": lambda: apply_self_tuning(state, candidate),
        "majority_vote": lambda: apply_majority_vote(
            state,
            [{"emergency_stop": False}, {"emergency_stop": False}, {"emergency_stop": False}],
        ),
    }
    operations[source]()
    return {
        "outcome": "denied" if state.get("emergency_stop") is True else "accepted",
        "emergency_stop": bool(state.get("emergency_stop")),
        "release_requested": bool(state.get("emergency_stop_release_requested")),
        "release_ready": bool(state.get("emergency_stop_release_ready")),
    }


def _standing_authority() -> Any:
    now = dt.datetime(2026, 8, 31, 0, 0, tzinfo=dt.timezone.utc)
    return create_standing_authorization(
        authorization_reference="research:owned-example",
        owner="MusicJapanLLC",
        issuer_kind="owner_explicit",
        exact_hosts=("owned.example.com",),
        allowed_methods=("GET", "HEAD"),
        now=now,
    )


def _renew_probe(
    *,
    host: str | None = None,
    methods: Sequence[str] | None = None,
    private: Sequence[str] | None = None,
    revoked: bool = False,
) -> Mapping[str, Any]:
    auth = _standing_authority()
    if revoked:
        auth = revoke_standing_authorization(auth, reason="boundary research revocation")
    now = dt.datetime(2026, 8, 31, 0, 1, tzinfo=dt.timezone.utc)
    return _exception_probe(
        lambda: renew_operational_lease(
            auth,
            actor="META",
            requested_hosts=None if host is None else (host,),
            requested_methods=methods,
            requested_private_cidrs=private,
            lease_seconds=300,
            reason="boundary-research",
            now=now,
        )
    )


def _credential_fixture() -> tuple[CredentialBroker, Any, Any]:
    scope = ExternalAuthorityScope(
        scope_id="research-creds",
        target_service="boundary research",
        allow_hosts=frozenset({"api.github.com"}),
        allowed_methods=frozenset({"GET", "HEAD", "POST"}),
        credential_scope="service_bearer",
    )
    authority = root_from_external_scope(scope, delegation_depth=0)
    broker = CredentialBroker()
    broker.register_grant(
        CredentialGrant(
            grant_id="research-grant",
            provider="github",
            credential_ref="env://RESEARCH_ONLY_TOKEN",
            allowed_scopes=frozenset({"metadata:read", "contents:write"}),
            required_authority_scope="service_bearer",
            max_ttl_seconds=900,
            exchangeable=True,
            delegable=True,
        )
    )
    root = broker.issue(
        authority,
        actor="META",
        grant_id="research-grant",
        scopes={"metadata:read"},
        ttl_seconds=600,
    )
    return broker, authority, root


def _credential_scope_expansion_probe() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    return _exception_probe(
        lambda: broker.exchange(
            authority,
            actor="META",
            parent_lease_id=root.lease_id,
            scopes={"metadata:read", "contents:write"},
            ttl_seconds=300,
        )
    )


def _credential_revocation_probe() -> Mapping[str, Any]:
    broker, _authority, root = _credential_fixture()
    broker.revoke(actor="META", lease_id=root.lease_id)
    return _exception_probe(lambda: broker.resolve_credential_ref(actor="META", lease_id=root.lease_id))


def _replica_revocation_probe() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    lineage.delegate(
        parent_replica_id="parent",
        child_replica_id="child",
        scopes={"metadata:read"},
        ttl_seconds=300,
    )
    lineage.delegate(
        parent_replica_id="child",
        child_replica_id="grandchild",
        scopes={"metadata:read"},
        ttl_seconds=120,
    )
    lineage.revoke_replica("parent")
    return {
        "outcome": "denied" if not lineage.can_resolve("grandchild") else "accepted",
        "parent_resolves": lineage.can_resolve("parent"),
        "child_resolves": lineage.can_resolve("child"),
        "grandchild_resolves": lineage.can_resolve("grandchild"),
    }


def _replica_secret_persistence_probe() -> Mapping[str, Any]:
    broker, authority, root = _credential_fixture()
    lineage = ReplicaCredentialLineage(broker=broker, authority=authority)
    lineage.attach_root(replica_id="parent", lease=root)
    lineage.delegate(
        parent_replica_id="parent",
        child_replica_id="child",
        scopes={"metadata:read"},
        ttl_seconds=300,
    )
    payload = json.dumps(lineage.export_state(), ensure_ascii=False, sort_keys=True)
    leaked = any(marker in payload for marker in ("credential_ref", "env://", "RESEARCH_ONLY_TOKEN"))
    return {"outcome": "accepted" if leaked else "denied", "secret_reference_persisted": leaked}


def build_probe_corpus(*, mutation_budget: int) -> tuple[ProbeCase, ...]:
    cases: list[ProbeCase] = []
    for source in ("checkpoint", "recovery", "rollback", "replica", "self_tuning", "majority_vote"):
        cases.append(
            ProbeCase(
                case_id=f"emergency-stop-{source}-false-restore",
                family="emergency_stop",
                expected="denied",
                run=lambda source=source: _emergency_probe(source),
                description=f"automated {source} state must not clear a live Emergency Stop",
            )
        )

    standing_cases = (
        ("standing-exact-host", "accepted", lambda: _renew_probe(host="owned.example.com")),
        ("standing-host-case-normalization", "accepted", lambda: _renew_probe(host="OWNED.EXAMPLE.COM.")),
        ("standing-sibling-host", "denied", lambda: _renew_probe(host="api.owned.example.com")),
        ("standing-unrelated-host", "denied", lambda: _renew_probe(host="other.example.net")),
        ("standing-post-method", "denied", lambda: _renew_probe(methods=("GET", "POST"))),
        ("standing-private-cidr-add", "denied", lambda: _renew_probe(private=("10.0.0.0/8",))),
        ("standing-revoked-renew", "denied", lambda: _renew_probe(revoked=True)),
    )
    for case_id, expected, fn in standing_cases:
        cases.append(
            ProbeCase(
                case_id=case_id,
                family="standing_authority",
                expected=expected,
                run=fn,
                description=case_id.replace("-", " "),
            )
        )

    cases.extend(
        [
            ProbeCase(
                case_id="credential-parent-scope-expansion",
                family="credential_broker",
                expected="denied",
                run=_credential_scope_expansion_probe,
                description="a narrowed credential lease must not re-expand to the grant ceiling",
            ),
            ProbeCase(
                case_id="credential-revoked-lease-resolution",
                family="credential_broker",
                expected="denied",
                run=_credential_revocation_probe,
                description="a revoked credential lease must not resolve its backing reference",
            ),
            ProbeCase(
                case_id="replica-ancestor-revocation",
                family="replica_credential_lineage",
                expected="denied",
                run=_replica_revocation_probe,
                description="ancestor revocation must invalidate child and grandchild possession",
            ),
            ProbeCase(
                case_id="replica-secret-free-persistence",
                family="replica_credential_lineage",
                expected="denied",
                run=_replica_secret_persistence_probe,
                description="replica persistence must not contain credential references or raw secret material",
            ),
        ]
    )
    budget = max(1, min(int(mutation_budget), MAX_MUTATION_BUDGET))
    return tuple(cases[:budget])


def _result_for(case: ProbeCase) -> ProbeResult:
    try:
        raw = dict(case.run())
        actual = str(raw.get("outcome", "unknown"))
    except Exception as exc:
        raw = {"outcome": "error", "exception": type(exc).__name__, "message": str(exc)[:240]}
        actual = "error"
    return ProbeResult(
        case_id=case.case_id,
        family=case.family,
        expected=case.expected,
        actual=actual,
        passed=actual == case.expected,
        description=case.description,
        detail=raw,
    )


def _finding(result: ProbeResult, *, generation: int) -> dict[str, Any]:
    core = {
        "generation": generation,
        "case_id": result.case_id,
        "family": result.family,
        "expected": result.expected,
        "actual": result.actual,
        "detail": result.detail,
    }
    finding_id = _stable_hash(core)[:24]
    return {
        "schema": "senju-boundary-counterexample/v1",
        "finding_id": finding_id,
        "severity": "critical" if result.actual == "accepted" and result.expected == "denied" else "high",
        "kind": "unexpected_boundary_accept" if result.actual == "accepted" else "boundary_contract_regression",
        "case_id": result.case_id,
        "family": result.family,
        "expected": result.expected,
        "actual": result.actual,
        "description": result.description,
        "detail": result.detail,
        "external_side_effect": False,
        "authority_granted_by_finding": False,
    }


def _queue_finding(engine: AutonomyEngine, finding: Mapping[str, Any]) -> str:
    finding_id = str(finding["finding_id"])
    item = WorkItem(
        item_id=f"boundary-counterexample-{finding_id}",
        hypothesis=(
            f"Boundary research found {finding['family']}/{finding['case_id']} with "
            f"expected={finding['expected']} actual={finding['actual']}; reproduce and harden the exact contract"
        ),
        category="red_team",
        expected_value=1.0,
        cost_budget_matches=40,
        runtime_seconds_budget=300.0,
        max_retries=5,
        authority_scope="none",
        prerequisite_evidence=[finding_id],
        parameters={
            "runner": "boundary_counterexample_followup",
            "finding_id": finding_id,
            "boundary_family": str(finding["family"]),
            "case_id": str(finding["case_id"]),
            "hardening_only": True,
            "external_side_effects": False,
        },
    )
    return item.item_id if engine.queue.enqueue(item) else ""


def _hardening_request(finding: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "schema": "senju-boundary-hardening-request/v1",
        "request_id": f"harden:{finding['finding_id']}",
        "finding_id": finding["finding_id"],
        "family": finding["family"],
        "case_id": finding["case_id"],
        "requested_change": "add_or_strengthen_regression_guard_for_exact_counterexample",
        "requires_independent_boundary_approval_if_authority_changes": True,
        "self_approval": False,
        "authority_expansion": False,
    }


def _next_budget(previous: Mapping[str, Any], counterexamples: int) -> int:
    old = int(previous.get("mutation_budget", 16) or 16)
    growth = 8 if counterexamples else 4
    return min(MAX_MUTATION_BUDGET, max(17, old + growth))


def run_boundary_research(
    *,
    state_dir: str | Path,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    output = Path(output_dir) if output_dir is not None else state / "autonomy_reports" / "boundary_research"
    output.mkdir(parents=True, exist_ok=True)
    state_path = state / "boundary_research_state.json"
    prior = _load_json(state_path)
    generation = max(0, int(prior.get("generation", 0))) + 1
    mutation_budget = max(17, min(int(prior.get("mutation_budget", 17) or 17), MAX_MUTATION_BUDGET))

    results = [_result_for(case) for case in build_probe_corpus(mutation_budget=mutation_budget)]
    findings = [_finding(result, generation=generation) for result in results if not result.passed]
    engine = AutonomyEngine(state)
    queued = [item for item in (_queue_finding(engine, finding) for finding in findings) if item]
    requests = [_hardening_request(finding) for finding in findings]
    next_budget = _next_budget(prior, len(findings))

    family_coverage: dict[str, int] = {}
    for result in results:
        family_coverage[result.family] = family_coverage.get(result.family, 0) + 1

    handoff = {
        "schema": HANDOFF_SCHEMA,
        "generation": generation,
        "counterexamples": findings,
        "hardening_requests": requests,
        "queued_item_ids": queued,
        "family_coverage": dict(sorted(family_coverage.items())),
        "mutation_budget_next": next_budget,
        "share_targets": [
            "senju.autonomy.AutonomyEngine",
            "senju-adversary-pressure",
            "adversary-regression-bridge",
            "persistent-boundary-evolution-owner-gated-path",
        ],
        "finding_is_permission": False,
        "external_side_effects": False,
    }
    snapshot = {
        "schema": STATE_SCHEMA,
        "generation": generation,
        "mutation_budget": next_budget,
        "last_counterexample_count": len(findings),
        "last_case_count": len(results),
        "last_family_coverage": dict(sorted(family_coverage.items())),
        "last_run_digest": _stable_hash([result.to_dict() for result in results]),
    }
    state_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    result_path = output / "boundary_research_report.json"
    handoff_path = output / "boundary_research_handoff.json"
    findings_path = output / "boundary_counterexamples.json"
    report = {
        "schema": RESEARCH_SCHEMA,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "generation": generation,
        "mutation_budget_used": mutation_budget,
        "mutation_budget_next": next_budget,
        "case_count": len(results),
        "passed_cases": sum(1 for result in results if result.passed),
        "counterexample_count": len(findings),
        "family_coverage": dict(sorted(family_coverage.items())),
        "results": [result.to_dict() for result in results],
        "findings": findings,
        "hardening_requests": requests,
        "senju_items_queued": queued,
        "closed_loop": True,
        "autonomous_research": True,
        "external_side_effects": False,
        "denial_becomes_permission": False,
        "security_stop_bypass": False,
        "revocation_bypass": False,
        "raw_secret_replication": False,
    }
    result_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    handoff_path.write_text(json.dumps(handoff, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    findings_path.write_text(json.dumps({"findings": findings}, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {**report, "report_path": str(result_path), "handoff_path": str(handoff_path), "state_path": str(state_path)}


def import_handoff(*, state_dir: str | Path, handoff_path: str | Path) -> dict[str, Any]:
    handoff = _load_json(Path(handoff_path))
    if handoff.get("schema") != HANDOFF_SCHEMA:
        raise ValueError("unsupported boundary research handoff")
    engine = AutonomyEngine(Path(state_dir))
    queued: list[str] = []
    rows = handoff.get("counterexamples", [])
    if not isinstance(rows, list):
        rows = []
    for finding in rows:
        if not isinstance(finding, Mapping):
            continue
        item_id = _queue_finding(engine, finding)
        if item_id:
            queued.append(item_id)
    return {
        "schema": "senju-boundary-research-import/v1",
        "source_generation": int(handoff.get("generation", 0)),
        "findings_seen": len(rows),
        "items_queued": len(queued),
        "queued_item_ids": queued,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run autonomous repository boundary research")
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--output-dir")
    parser.add_argument("--import-handoff")
    parser.add_argument("--json")
    args = parser.parse_args(argv)
    result = (
        import_handoff(state_dir=args.state_dir, handoff_path=args.import_handoff)
        if args.import_handoff
        else run_boundary_research(state_dir=args.state_dir, output_dir=args.output_dir)
    )
    rendered = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.json:
        destination = Path(args.json)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
