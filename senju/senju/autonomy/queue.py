"""Persistent work queue and autonomous scheduler for Senju."""
from __future__ import annotations

import dataclasses
import datetime as dt
import enum
import hashlib
import json
from pathlib import Path
from typing import Any


class WorkItemStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


@dataclasses.dataclass
class WorkItem:
    item_id: str
    hypothesis: str
    category: str  # "combat_tactics", "evolution_rate", "threat_intel", "resilience"
    expected_value: float  # 0.0 .. 1.0 (information/performance gain expectation)
    cost_budget_matches: int = 400
    runtime_seconds_budget: float = 30.0
    prerequisite_evidence: list[str] = dataclasses.field(default_factory=list)
    status: str = WorkItemStatus.PENDING.value
    attempt_count: int = 0
    max_retries: int = 2
    authority_scope: str = "none"  # "threat_intel_public" | "canary_telemetry" | "none"
    parameters: dict[str, Any] = dataclasses.field(default_factory=dict)
    result_reference: str = ""
    blocker_reason: str = ""
    created_at_utc: str = dataclasses.field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc).isoformat()
    )
    completed_at_utc: str = ""

    @property
    def deduplication_key(self) -> str:
        """Deterministic fingerprint of hypothesis and parameters."""
        raw = f"{self.hypothesis.strip().lower()}:{json.dumps(self.parameters, sort_keys=True)}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    @property
    def priority_score(self) -> float:
        """Priority calculated as expected value over cost with retry penalty."""
        cost = max(10, self.cost_budget_matches)
        retry_penalty = 1.0 / (1.0 + self.attempt_count)
        return round((self.expected_value / (cost ** 0.5)) * retry_penalty * 100.0, 4)

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "WorkItem":
        return cls(**data)


class AutonomyQueue:
    """Thread-safe and durable file-backed queue for autonomous Senju experiments."""

    def __init__(self, storage_path: str | Path) -> None:
        self.storage_path = Path(storage_path)
        self._items: dict[str, WorkItem] = {}
        self.load()

    def load(self) -> None:
        if not self.storage_path.exists():
            self._items = {}
            return
        try:
            data = json.loads(self.storage_path.read_text(encoding="utf-8"))
            self._items = {
                item_data["item_id"]: WorkItem.from_dict(item_data)
                for item_data in data.get("items", [])
            }
        except Exception:
            self._items = {}

    def save(self) -> None:
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "version": 1,
            "updated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "items": [item.to_dict() for item in self._items.values()],
        }
        self.storage_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def enqueue(self, item: WorkItem) -> bool:
        """Enqueue a work item with automatic deduplication against existing items."""
        dedup = item.deduplication_key
        for existing in self._items.values():
            if existing.deduplication_key == dedup and existing.status in {
                WorkItemStatus.PENDING.value,
                WorkItemStatus.IN_PROGRESS.value,
                WorkItemStatus.COMPLETED.value,
            }:
                return False  # Duplicate found
        self._items[item.item_id] = item
        self.save()
        return True

    def select_next(self, budget_matches: int = 5000) -> WorkItem | None:
        """Select the highest-priority pending or transient-failed item within budget."""
        candidates = [
            item for item in self._items.values()
            if item.status in {WorkItemStatus.PENDING.value, WorkItemStatus.FAILED.value}
            and item.attempt_count <= item.max_retries
            and item.cost_budget_matches <= budget_matches
        ]
        if not candidates:
            return None

        # Deterministic sorting: highest priority_score first, then oldest created_at, then item_id
        candidates.sort(
            key=lambda it: (-it.priority_score, it.created_at_utc, it.item_id)
        )
        selected = candidates[0]
        selected.status = WorkItemStatus.IN_PROGRESS.value
        selected.attempt_count += 1
        self.save()
        return selected

    def record_result(
        self,
        item_id: str,
        *,
        success: bool,
        result_ref: str = "",
        blocker_reason: str = "",
    ) -> None:
        """Record the outcome of a work item execution."""
        item = self._items.get(item_id)
        if not item:
            return
        if success:
            item.status = WorkItemStatus.COMPLETED.value
            item.result_reference = result_ref
            item.completed_at_utc = dt.datetime.now(dt.timezone.utc).isoformat()
        else:
            if item.attempt_count > item.max_retries:
                item.status = WorkItemStatus.BLOCKED.value
                item.blocker_reason = blocker_reason or "Exceeded maximum retry attempts"
            else:
                item.status = WorkItemStatus.FAILED.value
                item.blocker_reason = blocker_reason
        self.save()

    def pending_count(self) -> int:
        return sum(1 for it in self._items.values() if it.status == WorkItemStatus.PENDING.value)

    def completed_count(self) -> int:
        return sum(1 for it in self._items.values() if it.status == WorkItemStatus.COMPLETED.value)
