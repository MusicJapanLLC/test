import csv
from dataclasses import dataclass
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


@dataclass
class Lead:
    company: str
    contact_name: str
    email: str
    title: str = ""
    note: str = ""


def _row_to_lead(row: list[str]) -> Lead | None:
    padded = row + [""] * (5 - len(row))
    company, contact_name, email, title, note = (s.strip() for s in padded[:5])
    if not email:
        return None
    return Lead(company, contact_name, email, title, note)


def fetch_leads(credentials_path: str, spreadsheet_id: str, range_: str) -> list[Lead]:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    service = build("sheets", "v4", credentials=creds)
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_)
        .execute()
    )
    return [lead for row in result.get("values", []) if (lead := _row_to_lead(row))]


def fetch_leads_from_csv(csv_path: str) -> list[Lead]:
    """Sheets API 未設定でも検証できる CSV フォールバック。

    CSV は1行目をヘッダとし、列順は company, contact_name, email, title, note。
    """
    rows = []
    with Path(csv_path).open(encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)
        rows = list(reader)
    return [lead for row in rows if (lead := _row_to_lead(row))]
