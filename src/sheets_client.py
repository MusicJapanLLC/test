from dataclasses import dataclass
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


@dataclass
class Lead:
    company: str
    contact_name: str
    email: str
    title: str = ""
    note: str = ""


def fetch_leads(credentials_path: str, spreadsheet_id: str, range_: str) -> list[Lead]:
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
    rows = result.get("values", [])
    leads = []
    for row in rows:
        padded = row + [""] * (5 - len(row))
        company, contact_name, email, title, note = padded[:5]
        if not email:
            continue
        leads.append(Lead(company, contact_name, email, title, note))
    return leads
