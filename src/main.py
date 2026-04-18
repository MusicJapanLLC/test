import argparse
import time

from config.settings import load_settings
from src.log_db import LogDB
from src.mail_client import build_mail_client
from src.sheets_client import fetch_leads
from src.template_renderer import render


def run(dry_run: bool) -> None:
    settings = load_settings()
    leads = fetch_leads(
        settings.sheets_credentials_path,
        settings.spreadsheet_id,
        settings.sheets_range,
    )
    print(f"[info] fetched {len(leads)} leads")

    db = LogDB(settings.db_path)
    sent_today = db.sent_today_count()
    remaining = settings.daily_send_limit - sent_today
    print(f"[info] sent today={sent_today}, remaining={remaining}")

    mail = None if dry_run else build_mail_client(settings)

    for lead in leads:
        if remaining <= 0:
            print("[info] daily limit reached; stopping")
            break
        if db.already_sent(lead.email):
            print(f"[skip] already sent: {lead.email}")
            continue

        body = render(settings.template_path, lead)

        if dry_run:
            print(f"--- DRY RUN to {lead.email} ({lead.company}) ---")
            print(f"Subject: {settings.subject}")
            print(body)
            print("-------------------------------------------")
            continue

        try:
            msg_id = mail.send(lead.email, settings.subject, body)
            db.record(
                company=lead.company,
                contact_name=lead.contact_name,
                email=lead.email,
                subject=settings.subject,
                body=body,
                provider=settings.mail_provider,
                provider_message_id=msg_id,
                status="sent",
            )
            remaining -= 1
            print(f"[sent] {lead.email} id={msg_id}")
        except Exception as e:
            db.record(
                company=lead.company,
                contact_name=lead.contact_name,
                email=lead.email,
                subject=settings.subject,
                body=body,
                provider=settings.mail_provider,
                provider_message_id="",
                status="failed",
                error=str(e),
            )
            print(f"[fail] {lead.email}: {e}")

        time.sleep(settings.send_interval_seconds)

    db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="送信せず内容だけ確認")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
