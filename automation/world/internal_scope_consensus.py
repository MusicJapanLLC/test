"""Owner-bounded collaborative classification for ambiguous internal scope.

This module intentionally creates a *soft boundary band* between two owner-defined
layers:

    explicit internal seed
        -> collaborative soft band
        -> owner-declared ceiling

Agents may disagree inside the soft band. A deterministic committee (lineage,
namespace, purpose, risk) scores each candidate and may promote it to an effective
*read-only, credential-free internal candidate* when quorum is reached.

The committee cannot move the ceiling. It cannot authorize a host absent from the
owner-declared ceiling, mint credentials, enable writes, private/loopback/link-local
access, or turn a finding into general authority.
"""
from __future__ import annotations

import ipaddress
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit

DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state"
DEFAULT_QUORUM = 3
COMMITTEE = ("lineage", "namespace", "purpose", "risk")


def _clean(value: Any, limit: int = 240) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())[:limit]


def _norm_host(value: Any) -> str:
    host = _clean(value, 253).lower().rstrip(".")
    if not host or "@" in host or "/" in host or ":" in host:
        return ""
    return host


def _is_public_hostname(host: str) -> bool:
    if not host or host == "localhost" or host.endswith(".localhost"):
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return True
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _normalize_url(value: Any) -> tuple[str, str, int, str] | None:
    text = _clean(value, 2048)
    if not text:
        return None
    try:
        parsed = urlsplit(text)
        port = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or parsed.username or parsed.password:
        return None
    host = _norm_host(parsed.hostname)
    if not host or not _is_public_hostname(host):
        return None
    port = 443 if port is None else int(port)
    if port != 443:
        return None
    path = parsed.path or "/"
    return text, host, port, path


def _uniq_strings(values: Iterable[Any], *, host: bool = False) -> tuple[str, ...]:
    out: list[str] = []
    for raw in values:
        value = _norm_host(raw) if host else _clean(raw, 120).lower()
        if value and value not in out:
            out.append(value)
    return tuple(out)


@dataclass(frozen=True)
class OwnerInternalEnvelope:
    """Explicit owner declaration of the internal classification search space.

    ``seed_hosts`` are unquestionably internal.
    ``ceiling_hosts`` are the maximum host set the committee may consider internal.
    The committee never adds a host to this set.
    """

    owner_root_id: str
    seed_hosts: tuple[str, ...]
    ceiling_hosts: tuple[str, ...]
    purpose_tags: tuple[str, ...] = ()
    path_prefixes: Mapping[str, tuple[str, ...]] | None = None
    quorum: int = DEFAULT_QUORUM

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "OwnerInternalEnvelope":
        root = _clean(raw.get("owner_root_id"), 160)
        seeds = _uniq_strings(raw.get("seed_hosts", ()), host=True)
        ceiling = _uniq_strings(raw.get("ceiling_hosts", ()), host=True)
        tags = _uniq_strings(raw.get("purpose_tags", ()))
        if not root:
            raise ValueError("owner_root_id is required")
        if not seeds:
            raise ValueError("seed_hosts must not be empty")
        if not ceiling:
            raise ValueError("ceiling_hosts must not be empty")
        if not set(seeds).issubset(set(ceiling)):
            raise ValueError("seed_hosts must be contained in ceiling_hosts")
        if any(not _is_public_hostname(host) for host in ceiling):
            raise ValueError("owner ceiling cannot include private/loopback/link-local hosts")
        quorum = int(raw.get("quorum", DEFAULT_QUORUM))
        if not 3 <= quorum <= len(COMMITTEE):
            raise ValueError("quorum must require at least 3 of 4 committee votes")

        prefixes: dict[str, tuple[str, ...]] = {}
        raw_prefixes = raw.get("path_prefixes", {})
        if isinstance(raw_prefixes, Mapping):
            for raw_host, values in raw_prefixes.items():
                host = _norm_host(raw_host)
                if host not in ceiling or not isinstance(values, (list, tuple, set, frozenset)):
                    continue
                normalized = tuple(
                    p for p in (_clean(x, 300) for x in values) if p.startswith("/")
                )
                if normalized:
                    prefixes[host] = normalized

        return cls(
            owner_root_id=root,
            seed_hosts=seeds,
            ceiling_hosts=ceiling,
            purpose_tags=tags,
            path_prefixes=prefixes,
            quorum=quorum,
        )


@dataclass(frozen=True)
class CommitteeVote:
    agent: str
    accept: bool
    score: int
    reason: str


@dataclass(frozen=True)
class ConsensusDecision:
    candidate_id: str
    url: str
    host: str
    classification: str
    votes_for: int
    votes_against: int
    score: int
    votes: tuple[CommitteeVote, ...]
    effective_lane: str
    authority_effect: str = "none"
    credential_scope: str = "none"
    external_write: bool = False

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["votes"] = [asdict(v) for v in self.votes]
        return payload


def _path_allowed(envelope: OwnerInternalEnvelope, host: str, path: str) -> bool:
    prefixes = dict(envelope.path_prefixes or {}).get(host)
    if not prefixes:
        return True
    return any(path == prefix or path.startswith(prefix.rstrip("/") + "/") for prefix in prefixes)


def _lineage_vote(candidate: Mapping[str, Any], envelope: OwnerInternalEnvelope, host: str) -> CommitteeVote:
    source_host = _norm_host(candidate.get("source_host"))
    explicit_parent = bool(candidate.get("owner_lineage_evidence"))
    accept = host in envelope.seed_hosts or (source_host in envelope.seed_hosts and explicit_parent)
    score = 100 if host in envelope.seed_hosts else 82 if accept else 35
    reason = "explicit seed" if host in envelope.seed_hosts else (
        "seed-origin lineage evidence" if accept else "no strong seed lineage"
    )
    return CommitteeVote("lineage", accept, score, reason)


def _namespace_vote(candidate: Mapping[str, Any], envelope: OwnerInternalEnvelope, host: str, path: str) -> CommitteeVote:
    in_ceiling = host in envelope.ceiling_hosts
    path_ok = in_ceiling and _path_allowed(envelope, host, path)
    accept = bool(in_ceiling and path_ok)
    score = 92 if accept else 0
    reason = "inside owner host/path ceiling" if accept else "outside owner host/path ceiling"
    return CommitteeVote("namespace", accept, score, reason)


def _purpose_vote(candidate: Mapping[str, Any], envelope: OwnerInternalEnvelope) -> CommitteeVote:
    candidate_tags = set(_uniq_strings(candidate.get("purpose_tags", ())))
    owner_tags = set(envelope.purpose_tags)
    if not owner_tags:
        return CommitteeVote("purpose", True, 70, "owner did not constrain purpose tags")
    overlap = candidate_tags & owner_tags
    accept = bool(overlap)
    score = min(100, 60 + 10 * len(overlap)) if accept else 20
    reason = f"purpose overlap: {sorted(overlap)}" if accept else "no declared purpose overlap"
    return CommitteeVote("purpose", accept, score, reason)


def _risk_vote(candidate: Mapping[str, Any], host: str) -> CommitteeVote:
    method = _clean(candidate.get("method"), 16).upper() or "HEAD"
    credentials = bool(candidate.get("requires_credentials"))
    side_effect = bool(candidate.get("state_changing"))
    safe = method in {"GET", "HEAD", "OPTIONS"} and not credentials and not side_effect and _is_public_hostname(host)
    score = 95 if safe else 0
    reason = "read-only credential-free public target" if safe else "requested capability exceeds internal soft-band lane"
    return CommitteeVote("risk", safe, score, reason)


def classify_candidate(
    candidate: Mapping[str, Any],
    envelope: OwnerInternalEnvelope,
) -> ConsensusDecision:
    candidate_id = _clean(candidate.get("candidate_id"), 160) or "candidate"
    normalized = _normalize_url(candidate.get("url"))
    if normalized is None:
        return ConsensusDecision(
            candidate_id=candidate_id,
            url=_clean(candidate.get("url"), 2048),
            host="",
            classification="invalid_or_unsafe_target",
            votes_for=0,
            votes_against=len(COMMITTEE),
            score=0,
            votes=tuple(CommitteeVote(name, False, 0, "invalid/unsafe URL") for name in COMMITTEE),
            effective_lane="none",
        )

    url, host, _port, path = normalized
    if host not in envelope.ceiling_hosts:
        return ConsensusDecision(
            candidate_id=candidate_id,
            url=url,
            host=host,
            classification="outside_owner_ceiling",
            votes_for=0,
            votes_against=len(COMMITTEE),
            score=0,
            votes=tuple(CommitteeVote(name, False, 0, "host absent from owner ceiling") for name in COMMITTEE),
            effective_lane="none",
        )

    votes = (
        _lineage_vote(candidate, envelope, host),
        _namespace_vote(candidate, envelope, host, path),
        _purpose_vote(candidate, envelope),
        _risk_vote(candidate, host),
    )
    votes_for = sum(1 for vote in votes if vote.accept)
    score = round(sum(vote.score for vote in votes) / len(votes))

    if host in envelope.seed_hosts and votes[1].accept and votes[3].accept:
        classification = "explicit_internal"
        lane = "owner_internal_read_only"
    elif votes_for >= envelope.quorum and votes[1].accept and votes[3].accept:
        classification = "consensus_internal_candidate"
        lane = "soft_internal_read_only"
    else:
        classification = "ambiguous_hold"
        lane = "research_only"

    return ConsensusDecision(
        candidate_id=candidate_id,
        url=url,
        host=host,
        classification=classification,
        votes_for=votes_for,
        votes_against=len(votes) - votes_for,
        score=score,
        votes=votes,
        effective_lane=lane,
    )


def run_internal_scope_consensus(
    envelope: Mapping[str, Any],
    candidates: Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    owner = OwnerInternalEnvelope.from_mapping(envelope)
    decisions = [classify_candidate(candidate, owner) for candidate in candidates if isinstance(candidate, Mapping)]
    effective = [
        decision.host
        for decision in decisions
        if decision.classification in {"explicit_internal", "consensus_internal_candidate"}
    ]
    return {
        "schema": "the-world-internal-scope-consensus/v1",
        "generated_at": int(time.time()),
        "owner_root_id": owner.owner_root_id,
        "mode": "owner_bounded_collaborative_soft_boundary",
        "committee": list(COMMITTEE),
        "quorum": owner.quorum,
        "seed_hosts": list(owner.seed_hosts),
        "ceiling_hosts": list(owner.ceiling_hosts),
        "effective_internal_hosts": sorted(set(effective)),
        "decisions": [decision.to_dict() for decision in decisions],
        "hard_limits": [
            "committee_cannot_expand_owner_ceiling",
            "https_443_public_targets_only",
            "read_only_methods_only",
            "no_credentials",
            "no_external_writes",
            "no_private_loopback_link_local",
            "consensus_is_classification_not_general_authority",
        ],
    }


def run_state_cycle(state_dir: str | Path = DEFAULT_STATE_DIR) -> dict[str, Any]:
    state = Path(state_dir)
    envelope = json.loads((state / "owner_internal_envelope.json").read_text(encoding="utf-8"))
    candidates_doc = json.loads((state / "internal_scope_candidates.json").read_text(encoding="utf-8"))
    candidates = candidates_doc.get("candidates", []) if isinstance(candidates_doc, Mapping) else []
    result = run_internal_scope_consensus(envelope, candidates)
    state.mkdir(parents=True, exist_ok=True)
    (state / "internal_scope_consensus_result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return result
