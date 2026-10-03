from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


SCENARIOS = (
    "boundary-a",
    "boundary-b",
    "state-transition",
    "configuration",
    "dependency",
    "workflow",
    "data-flow",
    "recovery",
    "observability",
    "rate-control",
    "inventory",
    "adaptation",
)

SURFACE_RULES = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".json": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".tf": "terraform",
    ".md": "markdown",
}


@dataclass(frozen=True)
class Genome:
    genes: tuple[str, ...]
    generation: int = 0


@dataclass(frozen=True)
class Node:
    name: str
    links: tuple[str, ...]


class SurfaceInventory:
    def classify(self, paths: Iterable[str]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for raw in paths:
            surface = SURFACE_RULES.get(Path(raw).suffix.lower(), "other")
            counts[surface] = counts.get(surface, 0) + 1
        return dict(sorted(counts.items()))


class EvolutionLab:
    def __init__(self, population_size: int = 48, generations: int = 20, seed: int = 952954956957958) -> None:
        self.population_size = population_size
        self.generations = generations
        self.rng = random.Random(seed)

    def fitness(self, genome: Genome) -> float:
        diversity = len(set(genome.genes)) / len(SCENARIOS)
        compactness = 1.0 / (1 + max(0, len(genome.genes) - 5))
        transition_bonus = sum(g in {"state-transition", "recovery", "adaptation"} for g in genome.genes) / 3
        return round(diversity * 0.55 + compactness * 0.2 + transition_bonus * 0.25, 6)

    def initial_population(self) -> list[Genome]:
        population = []
        for _ in range(self.population_size):
            size = self.rng.randint(2, 6)
            population.append(Genome(tuple(sorted(self.rng.sample(SCENARIOS, size)))))
        return population

    def evolve(self) -> dict[str, object]:
        population = self.initial_population()
        history: list[dict[str, float | int]] = []
        for generation in range(1, self.generations + 1):
            ranked = sorted(population, key=self.fitness, reverse=True)
            history.append({
                "generation": generation,
                "best": self.fitness(ranked[0]),
                "average": round(sum(self.fitness(x) for x in ranked) / len(ranked), 6),
            })
            next_population = [Genome(x.genes, generation) for x in ranked[:8]]
            while len(next_population) < self.population_size:
                a, b = self.rng.sample(ranked[:24], 2)
                pool = sorted(set(a.genes) | set(b.genes))
                target = self.rng.randint(2, min(6, len(pool)))
                genes = set(self.rng.sample(pool, target))
                if self.rng.random() < 0.35:
                    available = [g for g in SCENARIOS if g not in genes]
                    if available and len(genes) < 6:
                        genes.add(self.rng.choice(available))
                next_population.append(Genome(tuple(sorted(genes)), generation))
            population = next_population
        best = max(population, key=self.fitness)
        return {"best": asdict(best), "fitness": self.fitness(best), "history": history}


class AdaptiveSignals:
    def summarize(self, events: Iterable[dict[str, object]]) -> dict[str, object]:
        totals = {"ok": 0, "blocked": 0, "error": 0, "other": 0}
        for event in events:
            state = str(event.get("state", "other"))
            if state in totals:
                totals[state] += 1
            else:
                totals["other"] += 1
        recommendations = []
        if totals["error"]:
            recommendations.append("improve recovery handling")
        if totals["blocked"]:
            recommendations.append("preserve successful boundary behavior in regression tests")
        if totals["ok"]:
            recommendations.append("record successful paths as baseline behavior")
        return {"totals": totals, "recommendations": recommendations}


class GraphPropagationModel:
    NODES = (
        Node("alpha", ("beta",)),
        Node("beta", ("gamma", "delta")),
        Node("gamma", ("epsilon",)),
        Node("delta", ("epsilon",)),
        Node("epsilon", ()),
    )

    def reachable(self, start: str) -> list[str]:
        graph = {node.name: node for node in self.NODES}
        if start not in graph:
            return []
        seen = {start}
        queue = [start]
        while queue:
            current = queue.pop(0)
            for nxt in graph[current].links:
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
        return sorted(seen)

    def summarize(self, start: str) -> dict[str, object]:
        reached = self.reachable(start)
        return {
            "start": start,
            "reachable": reached,
            "coverage": round(len(reached) / len(self.NODES), 3),
        }


class AdaptiveHomageOrchestrator:
    def run(self, paths: Iterable[str]) -> dict[str, object]:
        return {
            "schema": "adaptive-homage/v1",
            "external_io": False,
            "phases": {
                "inventory": SurfaceInventory().classify(paths),
                "evolution": EvolutionLab().evolve(),
                "adaptive_signals": AdaptiveSignals().summarize([
                    {"state": "ok"},
                    {"state": "blocked"},
                    {"state": "error"},
                ]),
                "graph_model": GraphPropagationModel().summarize("alpha"),
            },
        }


def main() -> None:
    paths = ["app/main.py", "web/client.ts", ".github/workflows/check.yml", "infra/main.tf", "config/runtime.json"]
    print(json.dumps(AdaptiveHomageOrchestrator().run(paths), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
