from src.log_db import LogDB


def _record_sent(db: LogDB, email: str) -> None:
    db.record(
        company="株式会社テスト",
        contact_name="山田太郎",
        email=email,
        subject="件名",
        body="本文",
        provider="gmail",
        provider_message_id="msg-1",
        status="sent",
    )


def test_already_sent_detects_prior_send(tmp_path):
    db = LogDB(str(tmp_path / "t.db"))
    assert db.already_sent("a@example.com") is False
    _record_sent(db, "a@example.com")
    assert db.already_sent("a@example.com") is True
    assert db.already_sent("b@example.com") is False


def test_failed_send_does_not_block_retry(tmp_path):
    db = LogDB(str(tmp_path / "t.db"))
    db.record(
        company="C",
        contact_name="N",
        email="x@example.com",
        subject="s",
        body="b",
        provider="gmail",
        provider_message_id="",
        status="failed",
        error="boom",
    )
    assert db.already_sent("x@example.com") is False


def test_sent_today_count_increments(tmp_path):
    db = LogDB(str(tmp_path / "t.db"))
    assert db.sent_today_count() == 0
    _record_sent(db, "a@example.com")
    _record_sent(db, "b@example.com")
    assert db.sent_today_count() == 2
