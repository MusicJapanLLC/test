"""META Command Channel — META writes, drive_engine/#273/#275 read.

META observes patterns and writes steering commands that the attack systems
exute on their next cycle. No human needed in the loop.

Command file: senju/state/meta_commands.json
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from pathlib import Path
from typing import Any


COMMAND_FILE = "senju/state/meta_commands.json"


@dataclasses.dataclass
class AttackCommand:
    target_surface: str
    pressure_multiplier: float        # 1.0 = normal, 5.0 = extreme
    priority: int                     # 1 = highest
    reason: str
    expires_after_cycles: int = 3
    issued_at: str = dataclasses.field(
        default_factory=lambda: dt.datetime.utcnow().isoformat() + "Z"
    )


@dataclasses.dataclass
class QueueCommand:
    action: str                       # "boost" | "demote" | "inject"
    target_item_id: str | None
    vuln_classes: list[str]
    reason: str
    issued_at: str = dataclasses.field(
        default_factory=lambda: dt.datetime.utcnow().isoformat() + "Z"
    )


@dataclasses.dataclass
class MetaCommandSet:
    schema: str = "meta-commands/v1"
    issued_at: str = dataclasses.field(
        default_factory=lambda: dt.datetime.utcnow().isoformat() + "Z"
    )
    attack_commands: list[AttackCommand] = dataclasses.field(default_factory=list)
    queue_commands: list[QueueCommand] = dataclasses.field(default_factory=list)
    dispatch_targets: list[str] = dataclasses.field(default_factory=list)


def write(command_set: MetaCommandSet, state_dir: Path) -> Path:
    path = state_dir / "meta_commands.json"
    state_dir.mkdir(parents=True, exist_ok=True)
    payload = dataclasses.asdict(command_set)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return path


def read(state_dir: Path) -> MetaCommandSet | None:
    path = state_dir / "meta_commands.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        attacks = [AttackCommand(**a) for a in data.get("attack_commands", [])]
        queues = [QueueCommand(**q) for q in data.get("queue_commands", [])]
        return MetaCommandSet(
            schema=data.get("schema", "meta-commands/v1"),
            issued_at=data.get("issued_at", ""),
            attack_commands=attacks,
            queue_commands=queues,
            dispatch_targets=data.get("dispatch_targets", []),
        )
    except Exception:
        return None


def build_from_graph(graph: Any, top_n: int = 3) -> MetaCommandSet:
    """Translate KnowledgeGraph weakness scores into concrete attack commands."""
    cmd = MetaCommandSet()

    # Top N weakest surfaces get pressure_multiplier boost
    for i, (surface, score) in enumerate(
        list(graph.surface_weakness_scores.items())[:top_n]
    ):
        multiplier = min(10.0, 1.0 + score)  # score directly maps to multiplier
        cmd.attack_commands.append(AttackCommand(
            target_surface=surface,
            pressure_multiplier=multiplier,
            priority=i + 1,
            reason=f"weakness_score={score:.2f} from {len(graph.observations)} observations",
        ))

    # Co-occurring regressions → queue boost for their vuln classes
    for surface_a, co_surfaces in list(graph.co_occurrence.items())[:2]:
        cmd.queue_commands.append(QueueCommand(
            action="boost",
            target_item_id=None,
            vuln_classes=[surface_a] + co_surfaces[:2],
            reason=f"co-regression cluster: {surface_a} ↔ {co_surfaces}",
        ))

    return cmd
