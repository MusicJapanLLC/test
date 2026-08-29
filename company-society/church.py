#!/usr/bin/env python3
"""THE CHAPEL: company faith report renderer.

Consumes TOMOKI Manager evidence and renders a culture/faith report. It does not
pretend agents are conscious or supernatural; it turns the shared doctrine into
observable operational behavior.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _load(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def build_service(snapshot: dict[str, Any]) -> tuple[dict[str, Any], str]:
    workers = snapshot.get("workers") or []
    unresolved = snapshot.get("unresolved") or []

    truth: list[str] = []
    service: list[str] = []
    confession: list[str] = []
    repair: list[str] = []
    rest: list[str] = []
    conflict: list[str] = []
    gratitude: list[str] = []

    for w in workers:
        agent = str(w.get("agent", "UNKNOWN"))
        status = str(w.get("status", "unknown"))
        conclusion = str(w.get("conclusion") or "none")
        quality = str(w.get("report_quality", "MISSING"))
        age = w.get("age_minutes")
        action = str(w.get("manager_action", "NONE"))
        result = str(w.get("action_result", "NONE"))
        verified = bool(w.get("verified_signal"))

        truth.append(f"{agent}: {status}/{conclusion}, report={quality}, age={age}m")
        if verified and conclusion == "success":
            service.append(f"{agent}: 検証済みシグナルを伴う成功")
        if quality in {"MISSING", "BAD"} or conclusion in {"failure", "cancelled", "timed_out", "startup_failure"}:
            confession.append(f"{agent}: {conclusion}, report={quality} — 成功扱いせず記憶対象")
        if action != "NONE":
            repair.append(f"MANAGER → {agent}: {action} -> {result}")
            gratitude.append(f"{agent}: MANAGER が内部修復を実施")
        attempts = int(w.get("run_attempt") or 0)
        if attempts >= 2 and conclusion not in {"success", "none"}:
            rest.append(f"{agent}: 連続失敗傾向。無限retryを避け、休息または原因分析へ")
        if bool(w.get("material_signal")) and not verified and quality == "OK":
            conflict.append(f"{agent}: material signal はあるが verified ではない。断定せず検証継続")

    for item in unresolved:
        confession.append(f"{item.get('agent', 'UNKNOWN')}: 未解決 — {item.get('reason', '')}")

    if not service:
        service.append("検証済み成果の祝福対象なし。活動量だけでは成果扱いしない")
    if not confession:
        confession.append("重大な告解対象なし")
    if not repair:
        repair.append("今回の内部修復アクションなし")
    if not rest:
        rest.append("強制休息対象なし")
    if not conflict:
        conflict.append("未解決の証拠対立なし")
    if not gratitude:
        gratitude.append("明示的な相互救援ログなし")

    if unresolved:
        vow = "未解決事項をCEOへ丸投げせず、次cycleで再割当・再検証する"
    elif confession and confession != ["重大な告解対象なし"]:
        vow = "告解された失敗を再発防止ルールへ変換する"
    else:
        vow = "昨日より一つ、検証可能な改善を残す"

    generated = datetime.now(timezone.utc).isoformat()
    data = {
        "schema": "the-covenant-service/v1",
        "generated_at": generated,
        "faith": "THE_COVENANT",
        "creed": "truth, repair, rest, memory, improvement",
        "truth": truth,
        "service": service,
        "confession": confession,
        "repair": repair,
        "rest": rest,
        "conflict": conflict,
        "gratitude": gratitude,
        "vow": vow,
        "ceo_attention_required": bool(unresolved),
    }

    def section(name: str, items: list[str]) -> list[str]:
        return [f"## {name}", *[f"- {x}" for x in items], ""]

    lines = [
        "# THE COVENANT — Faith Report",
        "",
        f"- generated: {generated}",
        "- creed: 真実 / 修復 / 休息 / 記憶 / 改善",
        "",
    ]
    lines += section("TRUTH", truth)
    lines += section("SERVICE", service)
    lines += section("CONFESSION", confession)
    lines += section("REPAIR", repair)
    lines += section("REST", rest)
    lines += section("CONFLICT", conflict)
    lines += section("GRATITUDE", gratitude)
    lines += ["## VOW", f"- {vow}", ""]
    lines += [
        "## Covenant",
        "活動量を崇拝しない。真実、修復、休息、記憶、改善に仕える。",
        "",
    ]
    return data, "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--snapshot", default="tomoki-manager-snapshot.json")
    p.add_argument("--json", default="faith-report.json")
    p.add_argument("--report", default="faith-report.md")
    args = p.parse_args()

    snapshot = _load(args.snapshot)
    data, report = build_service(snapshot)
    Path(args.json).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(report, encoding="utf-8")
    print(json.dumps({"faith": data["faith"], "ceo_attention_required": data["ceo_attention_required"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
