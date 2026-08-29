#!/usr/bin/env python3
"""Continuous defensive portfolio rounds for the Standment Elite White-Hat Cell.

This worker is deliberately evidence-first and target-free. It does not attack networks.
Each invocation chooses one defensive lens, inspects repository evidence, creates a
human-readable portfolio card, records missing proof, and defines exactly one next
improvement. Repeated invocations rotate lenses so the hourly reporter has fresh,
comparable evidence instead of raw code or activity counts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LENSES = [
    {
        "id": "AUTH-BOUNDARY",
        "title": "Auth / Tenant / Permission Boundary Review",
        "purpose": "AI/SaaSの認証・権限・テナント境界がfail-closedになっているかを証拠化する",
        "refs": [
            "security/STANDMENT_SECURITY_STANDARD.md",
            "standment-security/CONTROL_EVIDENCE_TEMPLATE.md",
            "standment-security/ai-security/agent-permission-boundary-lab.md",
        ],
        "next": "所有/明示許可済みテスト環境でallowed/blocked action matrixを再現し、Before/AfterをEvidence Packへ追加する",
    },
    {
        "id": "SUPPLY-CHAIN",
        "title": "Software Supply-Chain Assurance Pack",
        "purpose": "依存関係・静的解析・SBOM・変更ゲートを一つの顧客向け証拠パックとして確認できるようにする",
        "refs": [
            ".github/workflows/codeql.yml",
            ".github/workflows/dependency-review.yml",
            ".github/workflows/standment-security-gate.yml",
            "scripts/security/sbom_from_lock.py",
        ],
        "next": "最新のCodeQL/Dependency/SBOM結果を同一run単位で束ね、PASS/FAILと残存リスクを1枚のEvidence Cardにする",
    },
    {
        "id": "AGENT-BOUNDARY",
        "title": "Autonomous Agent Permission & Auditability Lab",
        "purpose": "自律AIが何を許可され、何を拒否され、何を実行したかを追跡可能にする",
        "refs": [
            "company-society/AUTONOMY.md",
            "automation/security/workflow_policy.py",
            ".github/workflows/security-guard.yml",
            "standment-security/ELITE_WHITEHAT_CELL.md",
        ],
        "next": "代表的なallowed/denied操作を安全なテスト入力で再実行し、拒否証拠と監査証跡を同じケーススタディへ束ねる",
    },
    {
        "id": "RECOVERY",
        "title": "Incident Readiness / Recovery Evidence Pack",
        "purpose": "バックアップ・ロールバック・復旧手順が『ある』ではなく『再現できる』ことを示す",
        "refs": [
            "security/STANDMENT_SECURITY_STANDARD.md",
            "standment-security/CONTROL_EVIDENCE_TEMPLATE.md",
            "standment-security/evidence-packs/incident-readiness/README.md",
        ],
        "next": "所有環境の非破壊fixtureでrollback/recoveryを再現し、復旧前後・所要条件・失敗条件を記録する",
    },
    {
        "id": "EVIDENCE-INTEGRITY",
        "title": "Security Evidence Integrity & Reproducibility",
        "purpose": "セキュリティ成果の根拠が人間に読めて、同じ条件で再実行でき、反証も残る状態にする",
        "refs": [
            "automation/security/portfolio_rnd.py",
            "automation/security/test_portfolio_rnd.py",
            "standment-security/CONTROL_EVIDENCE_TEMPLATE.md",
            "standment-security/REPORTING_CONTRACT.md",
        ],
        "next": "同一入力を2回実行して選定track/evidence ratio/promotion decisionが一致するか比較し、差分があれば原因をEvidence Packへ残す",
    },
]


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def run_round(root: Path, round_number: int, run_id: str) -> dict[str, Any]:
    lens = LENSES[(round_number - 1) % len(LENSES)]
    refs = list(lens["refs"])
    present = [p for p in refs if (root / p).exists()]
    missing = [p for p in refs if not (root / p).exists()]
    ratio = round(len(present) / max(1, len(refs)), 3)

    program = _load_json(root / "standment-security/security_portfolio_program.json")
    tracks = [x for x in program.get("tracks", []) if isinstance(x, dict)]
    related = []
    words = set(str(lens["title"]).lower().replace("/", " ").split())
    for track in tracks:
        blob = " ".join(str(track.get(k, "")) for k in ("id", "title", "hypothesis", "deliverable")).lower()
        overlap = sum(1 for w in words if len(w) >= 4 and w in blob)
        if overlap:
            related.append((overlap, str(track.get("id") or ""), str(track.get("title") or "")))
    related.sort(reverse=True)

    challenge = (
        "ファイルが存在してもランタイム挙動・顧客価値・脆弱性不在は証明しない。"
        "VERIFIEDには所有/明示許可済みscope、行動証拠、反証、再実行性が必要。"
    )
    fingerprint_src = json.dumps({"lens": lens["id"], "present": present, "missing": missing, "next": lens["next"]}, ensure_ascii=False, sort_keys=True)
    fingerprint = hashlib.sha256(fingerprint_src.encode()).hexdigest()[:16]

    return {
        "schema": "elite-whitehat-continuous-round/v1",
        "run_id": run_id,
        "round": round_number,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "lens_id": lens["id"],
        "artifact": lens["title"],
        "use_case": lens["purpose"],
        "evidence": {"present": present, "missing": missing, "coverage": ratio},
        "related_portfolio": [{"id": x[1], "title": x[2]} for x in related[:3]],
        "counterevidence": challenge,
        "status": "BUILDING",
        "next_improvement": lens["next"],
        "fingerprint": fingerprint,
    }


def render_card(row: dict[str, Any]) -> str:
    ev = row["evidence"]
    related = ", ".join(x["id"] for x in row.get("related_portfolio", [])) or "NONE"
    missing = ", ".join(ev["missing"]) if ev["missing"] else "NONE"
    return "\n".join([
        f"# SECURITY PORTFOLIO MICRO ROUND {row['round']}",
        "",
        f"- 成果物: **{row['artifact']}**",
        f"- 用途: {row['use_case']}",
        f"- Evidence coverage: **{ev['coverage']:.0%}** ({len(ev['present'])}/{len(ev['present']) + len(ev['missing'])})",
        f"- 不足Evidence: {missing}",
        f"- 関連Portfolio: {related}",
        f"- 反証/限界: {row['counterevidence']}",
        f"- 現在ステータス: **{row['status']}**",
        f"- 次の改善: {row['next_improvement']}",
        f"- fingerprint: `{row['fingerprint']}`",
        "",
    ])


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--round", type=int, required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--out-dir", required=True)
    args = p.parse_args()

    root = Path.cwd()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    row = run_round(root, args.round, args.run_id)
    stem = f"round-{args.round:02d}"
    (out / f"{stem}.json").write_text(json.dumps(row, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / f"{stem}.md").write_text(render_card(row), encoding="utf-8")
    print(json.dumps({"round": args.round, "artifact": row["artifact"], "coverage": row["evidence"]["coverage"], "fingerprint": row["fingerprint"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
