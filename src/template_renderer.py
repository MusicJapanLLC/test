from pathlib import Path
from jinja2 import Template

from src.sheets_client import Lead


def render(template_path: str, lead: Lead) -> str:
    template = Template(Path(template_path).read_text(encoding="utf-8"))
    return template.render(
        company=lead.company,
        contact_name=lead.contact_name,
        title=lead.title,
        email=lead.email,
        note=lead.note,
    )
