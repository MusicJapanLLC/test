import unittest

from automation.reporting.portfolio_report import validate


def event(**overrides):
    base = {
        "title": "Demo artifact",
        "artifact_type": "webapp",
        "artifact_url": "https://example.com/demo",
        "status": "BUILDING",
        "what_it_is": "A human-inspectable demo",
        "why_it_matters": "Shows the claimed behavior",
        "proof": "manual QA pending",
        "source_system": "test",
        "owner": "R&D",
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

    def test_allows_candidate_web_artifact(self):
        self.assertEqual(validate(event()), [])


if __name__ == "__main__":
    unittest.main()
