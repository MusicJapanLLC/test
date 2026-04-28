import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

JST = timezone(timedelta(hours=9))


def _now_jst_iso() -> str:
    return datetime.now(JST).isoformat()


def _today_jst_prefix() -> str:
    return datetime.now(JST).strftime("%Y-%m-%d")

SCHEMA = """
CREATE TABLE IF NOT EXISTS send_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at TEXT NOT NULL,
    company TEXT,
    contact_name TEXT,
    email TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    provider TEXT,
    provider_message_id TEXT,
    status TEXT NOT NULL,
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_send_log_email ON send_log(email);
CREATE INDEX IF NOT EXISTS idx_send_log_sent_at ON send_log(sent_at);
"""


class LogDB:
    def __init__(self, db_path: str):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def already_sent(self, email: str) -> bool:
        cur = self.conn.execute(
            "SELECT 1 FROM send_log WHERE email = ? AND status = 'sent' LIMIT 1",
            (email,),
        )
        return cur.fetchone() is not None

    def sent_today_count(self) -> int:
        cur = self.conn.execute(
            "SELECT COUNT(*) FROM send_log WHERE status = 'sent' AND sent_at LIKE ?",
            (f"{_today_jst_prefix()}%",),
        )
        return cur.fetchone()[0]

    def record(
        self,
        *,
        company: str,
        contact_name: str,
        email: str,
        subject: str,
        body: str,
        provider: str,
        provider_message_id: str,
        status: str,
        error: str = "",
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO send_log
            (sent_at, company, contact_name, email, subject, body, provider, provider_message_id, status, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _now_jst_iso(),
                company,
                contact_name,
                email,
                subject,
                body,
                provider,
                provider_message_id,
                status,
                error,
            ),
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
