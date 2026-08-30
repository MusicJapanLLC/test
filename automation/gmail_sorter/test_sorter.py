import json
import unittest
from pathlib import Path

from automation.gmail_sorter.sorter import classify


def message(sender: str, subject: str, labels=None):
    return {
        "labelIds": labels or ["INBOX"],
        "payload": {
            "headers": [
                {"name": "From", "value": sender},
                {"name": "Subject", "value": subject},
            ]
        },
    }


class GmailSorterRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config = json.loads(Path("automation/gmail_sorter/rules.json").read_text(encoding="utf-8"))
        cls.rules = config["rules"]

    def test_github_failure_is_archived_and_marked_incident(self):
        result = classify(self.rules, message("MusicJapanLLC <notifications@github.com>", "Run failed: Security Guard"))
        self.assertIsNotNone(result)
        self.assertTrue(result["archive"])
        self.assertIn("開発/GitHub", result["labels"])
        self.assertIn("開発/障害", result["labels"])

    def test_security_alert_is_kept_and_starred(self):
        result = classify(self.rules, message("GitHub <noreply@github.com>", "Security alert: OAuth scope changed"))
        self.assertIsNotNone(result)
        self.assertFalse(result["archive"])
        self.assertTrue(result["star"])
        self.assertIn("要対応", result["labels"])

    def test_timerex_is_sales(self):
        result = classify(self.rules, message("TimeRex <noreply@example.test>", "河上諒平さんが新しい予定を追加しました"))
        self.assertIsNotNone(result)
        self.assertFalse(result["archive"])
        self.assertTrue(result["star"])
        self.assertIn("営業・商談", result["labels"])

    def test_nikkei_is_archived(self):
        result = classify(self.rules, message("日経 <nikkei-news@mx.nikkei.com>", "夕版ニュース"))
        self.assertIsNotNone(result)
        self.assertTrue(result["archive"])
        self.assertIn("News/日経新聞", result["labels"])

    def test_promotion_category_is_archived(self):
        result = classify(self.rules, message("Store <news@example.test>", "Sale", ["INBOX", "CATEGORY_PROMOTIONS"]))
        self.assertIsNotNone(result)
        self.assertTrue(result["archive"])
        self.assertIn("あとで読む/広告", result["labels"])

    def test_unknown_mail_is_left_untouched(self):
        self.assertIsNone(classify(self.rules, message("person@example.test", "hello")))


if __name__ == "__main__":
    unittest.main()
