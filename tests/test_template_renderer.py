from src.sheets_client import Lead
from src.template_renderer import render


def test_renders_with_contact_name(tmp_path):
    tpl = tmp_path / "t.txt"
    tpl.write_text("{{ company }} / {{ contact_name }} 様", encoding="utf-8")
    lead = Lead(company="株式会社A", contact_name="鈴木", email="a@b.com")
    assert render(str(tpl), lead) == "株式会社A / 鈴木 様"


def test_renders_with_optional_title(tmp_path):
    tpl = tmp_path / "t.txt"
    tpl.write_text("{{ contact_name }}{% if title %} {{ title }}{% endif %}", encoding="utf-8")
    lead = Lead(company="A", contact_name="鈴木", email="a@b.com", title="部長")
    assert render(str(tpl), lead) == "鈴木 部長"


def test_renders_without_title(tmp_path):
    tpl = tmp_path / "t.txt"
    tpl.write_text("{{ contact_name }}{% if title %} {{ title }}{% endif %}", encoding="utf-8")
    lead = Lead(company="A", contact_name="鈴木", email="a@b.com")
    assert render(str(tpl), lead) == "鈴木"
