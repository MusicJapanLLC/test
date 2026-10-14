"""戦争経済の性質テスト: 有限性・両陣営の存続・淘汰圧・極端モード。"""
from senju.config import EvolutionConfig, SenjuConfig
from senju.economy import EconomyConfig
from senju.tournament import Tournament


def _run(economy=None, gens=15, pop=40, matches=200, seed=11):
    cfg = SenjuConfig(
        evolution=EvolutionConfig(population_size=pop, generations=gens,
                                  matches_per_generation=matches, seed=seed),
        economy=economy or EconomyConfig(),
    )
    return Tournament(cfg).run()


def test_resources_never_go_negative():
    report = _run()
    for g in report.generations:
        assert g.red_resources >= 0
        assert g.blue_resources >= 0


def test_world_pool_is_bounded():
    # 総資源は世界の上限(2*pop*start)を超えない（資源は有限）。
    cfg_pop, start = 40, 100.0
    report = _run()
    cap = 2 * cfg_pop * start
    for g in report.generations:
        assert g.red_resources + g.blue_resources <= cap + 1e-6


def test_both_sides_survive_default_economy():
    # デフォルト経済では、どちらの陣営も全滅しない（軍拡競争が維持される）。
    report = _run(gens=25)
    last = report.generations[-1]
    assert last.red_resources > 0
    assert last.blue_resources > 0


def test_selection_pressure_produces_deaths():
    # 淘汰圧が働けば個体は死ぬ（苛烈プリセットで検証）。
    report = _run(economy=EconomyConfig.extreme(), gens=25)
    total_deaths = sum(g.red_deaths + g.blue_deaths for g in report.generations)
    assert total_deaths > 0


def test_extreme_is_more_lethal_than_default():
    default = _run(economy=EconomyConfig(), gens=20)
    extreme = _run(economy=EconomyConfig.extreme(), gens=20)
    d_default = sum(g.red_deaths + g.blue_deaths for g in default.generations)
    d_extreme = sum(g.red_deaths + g.blue_deaths for g in extreme.generations)
    assert d_extreme > d_default


def test_scope_clean_even_under_economy():
    report = _run(economy=EconomyConfig.extreme())
    assert report.scope_violations == []
