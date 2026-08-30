import json
import unittest
from pathlib import Path

from controller import Candidate, competition_rank, demo_ready, manager_review_ready, score_candidate

POLICY = json.loads((Path(__file__).parent / "policy.json").read_text(encoding="utf-8"))
WEIGHTS = POLICY["weights"]


def candidate(key, score, evidence=70, artifacts=1, counter=True):
    return Candidate(
        key=key,
        title=f"Candidate {key}",
        customer_problem="A measurable customer problem",
        buyer="SMB operator",
        deliverable="A concrete customer-facing deliverable",
        metrics={name: score for name in WEIGHTS},
        evidence_strength=evidence,
        artifact_count=artifacts,
        counterevidence_present=counter,
    )


class ValueLabPolicyTests(unittest.TestCase):
    def test_weighted_score(self):
        self.assertEqual(score_candidate(candidate("a", 80), WEIGHTS), 80.0)

    def test_counterevidence_is_mandatory(self):
        ranked = competition_rank([candidate("strong", 90, counter=False), candidate("honest", 70)], WEIGHTS)
        self.assertEqual(ranked[0]["candidate"].key, "honest")
        self.assertTrue(ranked[1]["disqualified"])

    def test_manager_gate(self):
        self.assertFalse(manager_review_ready(candidate("a", 70, evidence=49)))
        self.assertTrue(manager_review_ready(candidate("a", 70, evidence=50)))

    def test_demo_requires_artifact(self):
        self.assertFalse(demo_ready(candidate("a", 70, artifacts=0), 80))
        self.assertTrue(demo_ready(candidate("a", 70, artifacts=1), 80))


if __name__ == "__main__":
    unittest.main()
