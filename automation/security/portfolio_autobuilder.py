#!/usr/bin/env python3
"""Autonomous, evidence-first portfolio builder for Standment Security.

The builder converts the top defensive R&D gap into a tangible repository artifact
without fabricating verification. It may create BUILDING scaffolds, lab notes and a
portfolio index, but it never promotes an artifact to VERIFIED by itself.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

STARTER_ARTIFACTS = {
    "SEC-PORT-001": "standment-security/case-studies/security-scan-before-after/README.md",
    "SEC-PORT-002": "standment-security/evidence-packs/customer-security/README.md",
    "SEC-PORT-003": "standment-security/evidence-packs/supply-chain/README.md",
    "SEC-PORT-004": "standment-security/evidence-packs/auth-tenant-rls/README.md",
    "SEC-PORT-005": "standment-security/evidence-packs/agent-auditability/README.md",
    "SEC-PORT-006": "standment-security/evidence-packs/incident-readiness/README.md",
    "SEC-PORT-007": "standment-security/evidence-packs/continuous-retainer/README.md",
    "SEC-PORT-008": "standment-security/evidence-packs/architecture-review/README.md",
    "SEC-PORT-009": "standment-security/ai-security/agent-permission-boundary-lab.md",
    "SEC-PORT-010": "standment-security/ai-security/llm-security-eval-harness.md",
    "SEC-PORT-011": "standment-security/ai-security/security-evidence-dashboard.md",
}


def load_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain an object")
    return data


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def starter_content(selected: dict[str, Any]) -> str:
    track_id = str(selected.get("id", "UNKNOWN"))
    title = str(selected.get("title", "Untitled security portfolio track"))
    deliverable = str(selected.get("deliverable", ""))
    usefulness = str(selected.get("customer_usefulness", ""))
    return f"""# {title}\n\n**状態: BUILDING**\n\n> このファイルは自動R&Dが作るEvidence骨格。検証結果を捏造せず、実測Evidenceが入るまでVERIFIEDにはしない。\n\n## 目的\n{deliverable}\n\n## 顧客にとっての価値\n{usefulness}\n\n## Evidence Checklist\n- [ ] Baseline / before evidence\n- [ ] Reproduction steps\n- [ ] Defensive change or control\n- [ ] Retest / after evidence\n- [ ] Negative or counterevidence\n- [ ] Limitations / environment assumptions\n- [ ] Rollback or failure-handling note\n- [ ] Human-inspectable summary\n\n## Research Contract\n- Track: `{track_id}`\n- Owned / authorized systems only\n- No credentials, exploit payloads, or third-party targets in Senju directives\n- Code alone is not verification evidence\n- Technical evidence is not market-demand evidence\n\n## Next Build Step\nFill exactly one unchecked evidence item with a reproducible artifact, then rerun the portfolio gate.\n"""


def build_lab_note(report: dict[str, Any], now: datetime, starter_path: str | None) -> str:
    selected = report.get("selected") or {}
    missing = selected.get("evidence_missing") or []
    present = selected.get("evidence_present") or []
    counter = report.get("counterevidence_questions") or []
    return "\n".join([
        f"# Standment Security R&D Lab Note — {now.date().isoformat()}",
        "",
        "**状態: BUILDING**",
        "",
        f"- Track: `{selected.get('id')}` — {selected.get('title')}",
        f"- Research score: `{selected.get('research_score')}`",
        f"- Current portfolio status: `{selected.get('portfolio_status')}`",
        f"- Evidence coverage: `{float(selected.get('evidence_ratio') or 0):.0%}`",
        f"- Senju focus: `{selected.get('senju_focus')}`",
        "",
        "## 今日、何を強化したか",
        f"- 最優先ギャップを `{selected.get('id')}` に固定",
        f"- Starter artifact: `{starter_path or 'already-present / none'}`",
        "- Evidence不足を、翌日も追跡可能なlab noteとportfolio indexへ変換",
        "",
        "## Evidence Present",
        *(f"- `{x}`" for x in present),
        *(["- NONE"] if not present else []),
        "",
        "## Evidence Missing",
        *(f"- [ ] `{x}`" for x in missing),
        *(["- NONE"] if not missing else []),
        "",
        "## 顧客向け成果物",
        str(selected.get("deliverable", "")),
        "",
        "## 顧客メリット",
        str(selected.get("customer_usefulness", "")),
        "",
        "## 反証チェック",
        *(f"- {x}" for x in counter[:5]),
        "",
        "## 次の自動改善",
        "不足Evidenceを1つだけ埋め、独立再現できる形にしてからPortfolio Gateを再評価する。",
        "",
        "> 自動処理はVERIFIEDへ昇格しない。検証Evidenceが揃うまではBUILDINGのまま維持する。",
        "",
    ])


def build_index(program: dict[str, Any], repo_root: Path, latest_note: Path) -> str:
    rows: list[str] = []
    for track in program.get("tracks") or []:
        if not isinstance(track, dict):
            continue
        evidence = [str(x) for x in track.get("evidence_files") or []]
        present = sum(1 for x in evidence if (repo_root / x).exists())
        ratio = present / len(evidence) if evidence else 0.0
        rows.append(
            f"| `{track.get('id')}` | {track.get('title')} | {int(track.get('priority', 0))} | {ratio:.0%} | {track.get('senju_focus')} |"
        )
    return "\n".join([
        "# Standment Security Portfolio Index",
        "",
        "**Mission:** 顧客が開いて確認できる、防御的かつ再現可能なSecurity Evidenceを毎日増やす。",
        "",
        f"Latest autonomous lab note: `{latest_note.as_posix()}`",
        "",
        "| Track | Portfolio | Priority | Evidence | Senju |",
        "|---|---|---:|---:|---|",
        *rows,
        "",
        "## Promotion Rule",
        "- BUILDING / EXPERIMENTは自動生成可能",
        "- VERIFIEDは人間が確認できる実物 + 再現手順 + retest + counterevidenceが必要",
        "- コード、PR、AI自己評価だけではVERIFIEDにしない",
        "- 市場需要、契約、入金は技術Evidenceと別管理",
        "",
    ])


def evolve(report: dict[str, Any], program: dict[str, Any], repo_root: Path, now: datetime) -> dict[str, Any]:
    selected = report.get("selected") or {}
    track_id = str(selected.get("id", ""))
    if not track_id.startswith("SEC-PORT-"):
        raise ValueError(f"unexpected track id: {track_id}")

    created: list[str] = []
    starter_rel = STARTER_ARTIFACTS.get(track_id)
    if starter_rel:
        starter = repo_root / starter_rel
        if not starter.exists():
            ensure_parent(starter)
            starter.write_text(starter_content(selected), encoding="utf-8")
            created.append(starter_rel)

    date = now.astimezone(JST).date().isoformat()
    note_rel = f"standment-security/lab-notes/{date}/{track_id}.md"
    note = repo_root / note_rel
    if not note.exists():
        ensure_parent(note)
        note.write_text(build_lab_note(report, now.astimezone(JST), starter_rel), encoding="utf-8")
        created.append(note_rel)

    index_rel = "standment-security/PORTFOLIO_INDEX.md"
    index = repo_root / index_rel
    index_text = build_index(program, repo_root, Path(note_rel))
    if not index.exists() or index.read_text(encoding="utf-8") != index_text:
        ensure_parent(index)
        index.write_text(index_text, encoding="utf-8")
        created.append(index_rel)

    return {
        "schema": "standment-security-portfolio-autobuilder/v2",
        "track": track_id,
        "created_or_updated": created,
        "latest_note": note_rel,
        "starter": starter_rel,
        "verification_claimed": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default="reports/standment-security-rnd/daily.json")
    ap.add_argument("--program", default="standment-security/security_portfolio_program.json")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--out", default="reports/standment-security-rnd/evolution.json")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    report = load_json(root / args.report)
    program = load_json(root / args.program)
    result = evolve(report, program, root, datetime.now(JST))
    out = root / args.out
    ensure_parent(out)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
