import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    sheets_credentials_path: str
    spreadsheet_id: str
    sheets_range: str
    mail_provider: str
    gmail_token_path: str
    sendgrid_api_key: str
    sender_email: str
    sender_name: str
    template_path: str
    subject: str
    send_interval_seconds: int
    daily_send_limit: int
    db_path: str


def load_settings() -> Settings:
    return Settings(
        sheets_credentials_path=os.environ["GOOGLE_SHEETS_CREDENTIALS_PATH"],
        spreadsheet_id=os.environ["GOOGLE_SHEETS_SPREADSHEET_ID"],
        sheets_range=os.environ.get("GOOGLE_SHEETS_RANGE", "Sheet1!A2:E"),
        mail_provider=os.environ.get("MAIL_PROVIDER", "gmail"),
        gmail_token_path=os.environ.get("GMAIL_TOKEN_PATH", "./token.json"),
        sendgrid_api_key=os.environ.get("SENDGRID_API_KEY", ""),
        sender_email=os.environ["SENDER_EMAIL"],
        sender_name=os.environ.get("SENDER_NAME", ""),
        template_path=os.environ["TEMPLATE_PATH"],
        subject=os.environ["SUBJECT"],
        send_interval_seconds=int(os.environ.get("SEND_INTERVAL_SECONDS", "30")),
        daily_send_limit=int(os.environ.get("DAILY_SEND_LIMIT", "200")),
        db_path=os.environ.get("DB_PATH", "./data/outreach.db"),
    )
