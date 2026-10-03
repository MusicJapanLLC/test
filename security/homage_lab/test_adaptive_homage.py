import json
import unittest

from security.homage_lab.adaptive_homage import (
    AdaptiveHomageOrchestrator,
    AdaptiveSignals,
    EvolutionLab,
    GraphPropagationModel,
    SurfaceInventory,
)


class AdaptiveHomageTests(unittest.TestCase):
    def test_inventory_is_local_and_deterministic(self) -> None:
        result = SurfaceInventory().classify(["a.py", "b.ts", "c.yml", "d.py"])
        self.assertEqual(result["python"], 2)
        self.assertEqual(result["typescript"], 1)
        self.assertEqual(result["yaml"], 1)

    def test_evolution_is_seeded_and_stable(self) -> None:
        first = EvolutionLab().evolve()
        second = EvolutionLab().evolve()
        self.assertEqual(first["best"], second["best"])
        self.assertEqual(first["fitness"], second["fitness"])
        self.assertEqual(len(first["history"]), 20)

    def test_adaptive_signal_summary(self) -> None:
        result = AdaptiveSignals().summarize([
            {"state": "ok"},
            {"state": "blocked"},
            {"state": "error"},
            {"state": "other"},
        ])
        self.assertEqual(result["totals"], {"ok": 1, "blocked": 1, "error": 1, "other": 1})
        self.assertEqual(len(result["recommendations"]), 3)

    def test_graph_model_is_in_memory_only(self) -> None:
        result = GraphPropagationModel().summarize("alpha")
        self.assertEqual(result["reachable"], ["alpha", "beta", "delta", "epsilon", "gamma"])
        self.assertEqual(result["coverage"], 1.0)

    def test_orchestrator_is_json_serializable_and_no_external_io(self) -> None:
        report = AdaptiveHomageOrchestrator().run(["one.py", "two.json"])
        self.assertFalse(report["external_io"])
        encoded = json.dumps(report, sort_keys=True)
        self.assertIn("adaptive-homage/v1", encoded)


if __name__ == "__main__":
    unittest.main()
