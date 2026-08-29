from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterable, Mapping

METRICS = (
    "willingness_to_pay", "urgency", "measurable_outcome", "delivery_feasibility",
    "recurring_potential", "differentiation", "proof_strength",
    "owner_effort_inverse", "safety_inverse",
)

@dataclass(frozen=True)
class Candidate:
    key: str
    title: str
    customer_problem: str
    buyer: str
    deliverable: str
    metrics: Mapping[str, float]
    evidence_strength: float
    artifact_count: int = 0
    counterevidence_present: bool = False

    def validate(self) -> None:
        required = {"key": self.key, "title": self.title, "customer_problem": self.customer_problem,
                    "buyer": self.buyer, "deliverable": self.deliverable}
        missing = [k for k, v in required.items() if not v.strip()]
        if missing:
            raise ValueError(f"missing required fields: {', '.join(missing)}")
        if not 0 <= self.evidence_strength <= 100:
            raise ValueError("evidence_strength must be 0..100")
        for metric in METRICS:
            value = self.metrics.get(metric)
            if value is None:
                raise ValueError(f"missing metric: {metric}")
            if not 0 <= float(value) <= 100:
                raise ValueError(f"metric {metric} must be 0..100")

def score_candidate(candidate: Candidate, weights: Mapping[str, float]) -> float:
    candidate.validate()
    missing = [m for m in METRICS if m not in weights]
    if missing:
        raise ValueError(f"missing weights: {', '.join(missing)}")
    total = sum(float(weights[m]) for m in METRICS)
    if abs(total - 1.0) > 1e-9:
        raise ValueError(f"weights must sum to 1.0, got {total}")
    return round(sum(float(candidate.metrics[m]) * float(weights[m]) for m in METRICS), 2)

def competition_rank(candidates: Iterable[Candidate], weights: Mapping[str, float]) -> list[dict]:
    ranked = []
    for candidate in candidates:
        score = score_candidate(candidate, weights)
        disqualified = not candidate.counterevidence_present
        ranked.append({"candidate": candidate, "score": 0.0 if disqualified else score,
                       "disqualified": disqualified,
                       "reason": "counterevidence_missing" if disqualified else None})
    ranked.sort(key=lambda row: (row["disqualified"], -row["score"], row["candidate"].key))
    for rank, row in enumerate(ranked, 1):
        row["rank"] = rank
    return ranked

def manager_review_ready(candidate: Candidate, min_evidence: float = 50) -> bool:
    candidate.validate()
    return candidate.evidence_strength >= min_evidence and candidate.counterevidence_present

def demo_ready(candidate: Candidate, buyer_value_score: float, *, min_evidence: float = 60, min_value: float = 60) -> bool:
    candidate.validate()
    return candidate.evidence_strength >= min_evidence and buyer_value_score >= min_value and candidate.artifact_count > 0 and candidate.counterevidence_present

def export_candidate(candidate: Candidate) -> dict:
    payload = asdict(candidate)
    payload["metrics"] = dict(candidate.metrics)
    return payload
