import unittest

from automation.reporting.portfolio_report import render, validate


def event(**overrides):
    base = {
        "title": "Demo artifact",
        "artifact_type": "webapp",
        "artifact_url": "https://example.com/demo",
        "status": "BUILDING",
        "what_it_is": "A human-inspectable demo",
        "why_it_matters": "The owner can inspect the behavior instead of trusting an implementation claim.",
        "proof": "manual QA pending",
        "source_system": "test",
        "owner": "R&D",
        "before_state": "Only source code existed; there was no inspectable result.",
        "after_state": "A web demo is accessible and shows the core interaction.",
        "capability_gain": "A human can now inspect the interaction directly.",
        "owner_benefit": "Review can happen from a URL without reading code.",
        "business_effect": "Shortens the path from internal build to buyer-readable proof; commercial impact is not measured yet.",
        "evolution_stage_before": 0,
        "evolution_stage_after": 1,
        "measurement_next": "Measure review time and successful external opens on the next cycle.",
        "next_target": "Verify the core interaction end-to-end.",
        "success_criteria": "Two independent QA runs complete the core path with zero blocking errors.",
    }
    base.update(overrides)
    return base


class PortfolioReportValidationTest(unittest.TestCase):
    def test_rejects_gmail_inbox(self):
        errors = validate(event(artifact_url="https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox"))
        self.assertTrue(any("private inbox" in error for error in errors), errors)

    def test_rejects_source_type_even_with_web_url(self):
        errors = validate(event(artifact_type="code"))
        self.assertTrue(any("source code" in error for error in errors), errors)

    def test_requires_delta_fields(self):
        errors = validate(event(capability_gain=""))
        self.assertTrue(any("capability_gain" in error for error in errors), errors)

    def test_requires_metric_or_next_measurement(self):
        errors = validate(event(measurement_next="", metrics=[]))
        self.assertTrue(any("metrics or measurement_next" in error for error in errors), errors)

    def test_rejects_invalid_evolution_stage(self):
        errors = validate(event(evolution_stage_after=9))
        self.assertTrue(any("0-5" in error for error in errors), errors)

    def test_l5_requires_external_value_evidence(self):
        errors = validate(event(evolution_stage_after=5))
        self.assertTrue(any("external_value_evidence" in error for error in errors), errors)

    def test_allows_candidate_web_artifact(self):
        self.assertEqual(validate(event()), [])

    def test_render_leads_with_human_delta(self):
        text = render(event(metrics=[{"name": "review steps", "before": 3, "after": 1, "unit": "steps"}]))
        self.assertIn("PORTFOLIO DELTA", text)
        self.assertIn("L0 IDEA -> L1 INSPECTABLE", text)
        self.assertIn("*Before*", text)
        self.assertIn("*New capability*", text)
        self.assertIn("review steps", text)
        self.assertIn("*Next evolution*", text)


if __name__ == "__main__":
    unittest.main()
