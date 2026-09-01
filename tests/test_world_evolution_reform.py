from automation.world_evolution.evolution_engine import (
    SAFE_METHODS,
    SAFE_PATHS,
    build_synthetic_world,
    next_generation,
    run_loop,
    spawn_agents,
)


def test_synthetic_world_never_uses_real_hosts_or_credentials():
    world = build_synthetic_world(50, seed=7)
    assert len(world) == 50
    assert all(host.host.endswith(".synthetic.invalid") for host in world)
    assert all(host.credential.startswith("synthetic-") for host in world)


def test_population_mutation_stays_inside_safe_strategy_space():
    population = spawn_agents(20, seed=7)
    evolved = next_generation(population, 20, seed=7, generation=1)
    assert len(evolved) == 20
    assert all(agent.method in SAFE_METHODS for agent in evolved)
    assert all(agent.path in SAFE_PATHS for agent in evolved)
    assert all(0.0 <= agent.aggressiveness <= 1.0 for agent in evolved)


def test_closed_loop_runs_many_experiments_and_keeps_real_side_effects_disabled():
    report = run_loop(agents=20, hosts=100, generations=4, experiments_per_agent=5, seed=11)
    assert report["totals"]["experiments"] == 20 * 4 * 5
    assert report["network_io"] is False
    assert report["real_credentials"] is False
    assert report["authority_mutation"] is False
    assert report["mode"] == "synthetic_only"
    assert len(report["generations"]) == 4


def test_evolution_is_deterministic_for_same_seed_except_timestamp():
    first = run_loop(agents=10, hosts=30, generations=3, experiments_per_agent=3, seed=99)
    second = run_loop(agents=10, hosts=30, generations=3, experiments_per_agent=3, seed=99)
    first.pop("generated_at_unix")
    second.pop("generated_at_unix")
    assert first == second
