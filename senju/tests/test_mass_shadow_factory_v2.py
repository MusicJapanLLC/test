import unittest

from scripts.mass_shadow_factory_v2 import (
    MICRO_GENERATIONS,
    MICRO_MATCHES,
    MICRO_POPULATION,
    _micro_config,
)


BASE = {
    "population": 120,
    "generations": 16,
    "matches": 440,
    "mutation_rate": 0.08,
    "red_budget": 16,
    "blue_budget": 16,
    "seed": 20260829,
}


class MassShadowV2Tests(unittest.TestCase):
    def test_micro_config_really_stays_below_production_strategy_bounds(self):
        cfg = _micro_config(BASE, 123)
        self.assertEqual(cfg.evolution.population_size, MICRO_POPULATION)
        self.assertEqual(cfg.evolution.generations, MICRO_GENERATIONS)
        self.assertEqual(cfg.evolution.matches_per_generation, MICRO_MATCHES)
        self.assertEqual(MICRO_POPULATION, 12)
        self.assertEqual(MICRO_GENERATIONS, 1)
        self.assertEqual(MICRO_MATCHES, 20)
        self.assertLess(cfg.evolution.population_size, 40)
        self.assertLess(cfg.evolution.generations, 6)
        self.assertLess(cfg.evolution.matches_per_generation, 100)

    def test_promotable_strategy_is_not_mutated_by_micro_config(self):
        _micro_config(BASE, 999)
        self.assertEqual(BASE["population"], 120)
        self.assertEqual(BASE["generations"], 16)
        self.assertEqual(BASE["matches"], 440)


if __name__ == "__main__":
    unittest.main()
