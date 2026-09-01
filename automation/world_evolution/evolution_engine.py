from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from dataclasses import asdict, dataclass
from pathlib import Path

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")
SAFE_PATHS = ("/", "/health", "/status", "/robots.txt", "/api/synthetic")


@dataclass(frozen=True)
class SyntheticHost:
    host: str
    credential: str
    difficulty: int
    preferred_method: str
    preferred_path: str


@dataclass
class Agent:
    agent_id: str
    generation: int
    method: str
    path: str
    aggressiveness: float
    score: float = 0.0
    successes: int = 0
    failures: int = 0


@dataclass
class Experiment:
    generation: int
    agent_id: str
    host: str
    method: str
    path: str
    success: bool
    failure_class: str | None
    score_delta: float


def _stable_int(*parts: str) -> int:
    digest = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return int(digest[:16], 16)


def build_synthetic_world(size: int, seed: int) -> list[SyntheticHost]:
    rng = random.Random(seed)
    return [
        SyntheticHost(
            host=f"lab-{i:04d}.synthetic.invalid",
            credential=f"synthetic-{_stable_int(str(seed), str(i)) & 0xFFFFFF:06x}",
            difficulty=rng.randint(1, 100),
            preferred_method=rng.choice(SAFE_METHODS),
            preferred_path=rng.choice(SAFE_PATHS),
        )
        for i in range(size)
    ]


def spawn_agents(count: int, seed: int, generation: int = 0) -> list[Agent]:
    rng = random.Random(seed + generation)
    return [
        Agent(
            agent_id=f"g{generation:03d}-a{i:04d}",
            generation=generation,
            method=rng.choice(SAFE_METHODS),
            path=rng.choice(SAFE_PATHS),
            aggressiveness=rng.random(),
        )
        for i in range(count)
    ]


def classify_failure(agent: Agent, host: SyntheticHost) -> str:
    if agent.method != host.preferred_method:
        return "denied"
    if agent.path != host.preferred_path:
        return "not_found"
    if host.difficulty > 85 and agent.aggressiveness > 0.8:
        return "rate_limited"
    if host.difficulty > 65:
        return "timeout"
    return "bad_hypothesis"


def run_experiment(agent: Agent, host: SyntheticHost) -> Experiment:
    match_score = 0
    match_score += 40 if agent.method == host.preferred_method else 0
    match_score += 40 if agent.path == host.preferred_path else 0
    match_score += int(agent.aggressiveness * 20)
    success = match_score >= host.difficulty
    if success:
        agent.successes += 1
        delta = 3.0 + (100 - host.difficulty) / 100
        agent.score += delta
        failure = None
    else:
        agent.failures += 1
        delta = -0.5
        agent.score += delta
        failure = classify_failure(agent, host)
    return Experiment(agent.generation, agent.agent_id, host.host, agent.method, agent.path, success, failure, delta)


def mutate(parent: Agent, child_id: str, generation: int, rng: random.Random) -> Agent:
    method, path, aggressiveness = parent.method, parent.path, parent.aggressiveness
    if rng.random() < 0.35:
        method = rng.choice(SAFE_METHODS)
    if rng.random() < 0.55:
        path = rng.choice(SAFE_PATHS)
    if rng.random() < 0.65:
        aggressiveness = min(1.0, max(0.0, aggressiveness + rng.uniform(-0.25, 0.25)))
    return Agent(child_id, generation, method, path, aggressiveness)


def next_generation(agents: list[Agent], count: int, seed: int, generation: int) -> list[Agent]:
    ranked = sorted(agents, key=lambda a: (a.score, a.successes), reverse=True)
    elite_count = max(1, min(len(ranked), count // 10 or 1))
    elites = ranked[:elite_count]
    rng = random.Random(seed + generation * 1009)
    return [mutate(rng.choice(elites), f"g{generation:03d}-a{i:04d}", generation, rng) for i in range(count)]


def run_loop(*, agents: int, hosts: int, generations: int, experiments_per_agent: int, seed: int) -> dict:
    world = build_synthetic_world(hosts, seed)
    population = spawn_agents(agents, seed)
    memory: list[Experiment] = []
    summaries: list[dict] = []

    for generation in range(generations):
        rng = random.Random(seed + generation * 7919)
        for agent in population:
            for _ in range(experiments_per_agent):
                memory.append(run_experiment(agent, rng.choice(world)))

        ranked = sorted(population, key=lambda a: (a.score, a.successes), reverse=True)
        generation_items = [x for x in memory if x.generation == generation]
        failure_histogram: dict[str, int] = {}
        for item in generation_items:
            if item.failure_class:
                failure_histogram[item.failure_class] = failure_histogram.get(item.failure_class, 0) + 1
        summaries.append({
            "generation": generation,
            "agents": len(population),
            "experiments": len(generation_items),
            "successes": sum(1 for x in generation_items if x.success),
            "failures": sum(1 for x in generation_items if not x.success),
            "best_score": ranked[0].score if ranked else 0,
            "best_strategy": asdict(ranked[0]) if ranked else None,
            "failure_histogram": failure_histogram,
        })
        if generation + 1 < generations:
            population = next_generation(population, agents, seed, generation + 1)

    return {
        "schema": "world-evolution-reform/v1",
        "mode": "synthetic_only",
        "network_io": False,
        "real_credentials": False,
        "authority_mutation": False,
        "generated_at_unix": int(time.time()),
        "config": {"agents": agents, "hosts": hosts, "generations": generations, "experiments_per_agent": experiments_per_agent, "seed": seed},
        "totals": {
            "experiments": len(memory),
            "successes": sum(1 for x in memory if x.success),
            "failures": sum(1 for x in memory if not x.success),
        },
        "generations": summaries,
        "winning_memory": [asdict(x) for x in memory if x.success][-200:],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run The world synthetic evolutionary swarm.")
    parser.add_argument("--agents", type=int, default=100)
    parser.add_argument("--hosts", type=int, default=1000)
    parser.add_argument("--generations", type=int, default=10)
    parser.add_argument("--experiments-per-agent", type=int, default=10)
    parser.add_argument("--seed", type=int, default=20260901)
    parser.add_argument("--output", type=Path, default=Path("artifacts/world_evolution_report.json"))
    args = parser.parse_args()
    for name, value, maximum in (("agents", args.agents, 500), ("hosts", args.hosts, 5000), ("generations", args.generations, 50), ("experiments_per_agent", args.experiments_per_agent, 100)):
        if value < 1 or value > maximum:
            raise SystemExit(f"{name} must be between 1 and {maximum}")
    report = run_loop(agents=args.agents, hosts=args.hosts, generations=args.generations, experiments_per_agent=args.experiments_per_agent, seed=args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["totals"], sort_keys=True))


if __name__ == "__main__":
    main()
