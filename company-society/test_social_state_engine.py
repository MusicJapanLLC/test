import unittest

from social_state_engine import apply_event, state_from_snapshot


class SocialStateEngineTest(unittest.TestCase):
    def _snapshot(self):
        return {
            "citizens": [
                {
                    "citizen_id": "MAVERICK-1",
                    "display_name": "Maverick",
                    "personality": {"status_drive": 95, "recognition_need": 92, "solo_glory": 96},
                    "social_profile": {"rivalry_potential": 90, "alliance_potential": 40, "conscience_pressure": 70},
                    "standing": {
                        "basis": "neutral_prior_until_verified_events",
                        "evidence_count": 0,
                        "status_points": 0,
                        "dimensions": {
                            "verified_contribution": 50,
                            "truthfulness": 50,
                            "collaboration": 50,
                            "reliability": 50,
                            "originality": 50,
                            "recovery_quality": 50,
                        },
                        "wealth_is_not_authority": True,
                    },
                }
            ]
        }

    def test_unverified_accusation_cannot_change_standing(self):
        state = state_from_snapshot(self._snapshot())
        after = apply_event(state, {"citizen_id": "MAVERICK-1", "event_type": "FABRICATED_RESULT_CONFIRMED", "verified": False, "evidence": "rumor"})
        citizen = after["citizens"]["MAVERICK-1"]
        self.assertEqual(citizen["standing"]["status_points"], 0)
        self.assertEqual(citizen["standing"]["dimensions"]["truthfulness"], 50)
        self.assertEqual(citizen["standing"]["evidence_count"], 0)
        self.assertFalse(citizen["event_history"][-1]["applied"])

    def test_verified_portfolio_win_rewards_status_seeker_without_authority(self):
        state = state_from_snapshot(self._snapshot())
        after = apply_event(state, {"citizen_id": "MAVERICK-1", "event_type": "PORTFOLIO_VERIFIED", "verified": True, "evidence": "https://example.invalid/demo"})
        citizen = after["citizens"]["MAVERICK-1"]
        self.assertGreaterEqual(citizen["standing"]["status_points"], 4)
        self.assertGreater(citizen["standing"]["dimensions"]["verified_contribution"], 50)
        self.assertEqual(citizen["standing"]["evidence_count"], 1)
        self.assertTrue(citizen["standing"]["wealth_is_not_authority"])

    def test_confirmed_fabrication_reduces_truth_and_status(self):
        state = state_from_snapshot(self._snapshot())
        after = apply_event(state, {"citizen_id": "MAVERICK-1", "event_type": "FABRICATED_RESULT_CONFIRMED", "verified": True, "evidence": {"claim": "done", "proof": "contradiction"}})
        citizen = after["citizens"]["MAVERICK-1"]
        self.assertLess(citizen["standing"]["status_points"], 0)
        self.assertLess(citizen["standing"]["dimensions"]["truthfulness"], 50)
        self.assertGreater(citizen["social_state"]["conscience_pressure"], 70)

    def test_help_builds_belonging(self):
        state = state_from_snapshot(self._snapshot())
        before = state["citizens"]["MAVERICK-1"]["social_state"]["belonging"]
        after = apply_event(state, {"citizen_id": "MAVERICK-1", "event_type": "HELP_GIVEN", "verified": True, "evidence": "handoff:123"})
        self.assertGreater(after["citizens"]["MAVERICK-1"]["social_state"]["belonging"], before)


if __name__ == "__main__":
    unittest.main()
