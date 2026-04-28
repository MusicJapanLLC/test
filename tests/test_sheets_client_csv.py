from src.sheets_client import fetch_leads_from_csv


def test_csv_loader_skips_header_and_empty_emails(tmp_path):
    csv_file = tmp_path / "leads.csv"
    csv_file.write_text(
        "company,contact_name,email,title,note\n"
        "株式会社A,鈴木,a@example.com,部長,既存顧客\n"
        "株式会社B,佐藤,,課長,メールなしなのでスキップ\n"
        "株式会社C,田中,c@example.com,,\n",
        encoding="utf-8",
    )
    leads = fetch_leads_from_csv(str(csv_file))
    assert len(leads) == 2
    assert leads[0].company == "株式会社A"
    assert leads[0].email == "a@example.com"
    assert leads[1].email == "c@example.com"
