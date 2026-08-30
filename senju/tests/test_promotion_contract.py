from pathlib import Path


def test_autonomous_promotion_requires_shadow_champion_and_holdout_gate():
    root = Path(__file__).resolve().parents[2]
    workflow = (root / ".github/workflows/senju-autonomous-improver.yml").read_text(encoding="utf-8")
    selector = (root / "senju/scripts/shadow_selector.py").read_text(encoding="utf-8")

    workflow_required = [
        "Restore latest R&D research directive",
        "Apply bounded R&D research focus to Senju proposal",
        "Run multi-candidate Shadow Champion selection and unseen holdout",
        "python -m scripts.shadow_selector",
        "--strategy /tmp/promotion/strategy.json",
        "--selected /tmp/shadow-selected-strategy.json",
        "senju-prepromotion-shadow",
        "cp /tmp/shadow-selected-strategy.json /tmp/promotion/strategy.json",
    ]
    for invariant in workflow_required:
        assert invariant in workflow, f"Senju promotion lost invariant: {invariant}"

    selector_required = [
        "SELECTION_SALTS",
        "HOLDOUT_SALTS",
        "choose_stable",
        "robust_score",
        "holdout",
        "selected",
    ]
    for invariant in selector_required:
        assert invariant in selector, f"Shadow selector lost invariant: {invariant}"

    rnd_pos = workflow.index("Apply bounded R&D research focus to Senju proposal")
    shadow_pos = workflow.index("Run multi-candidate Shadow Champion selection and unseen holdout")
    promotion_bundle_pos = workflow.index("Upload validated promotion bundle")
    promote_job_pos = workflow.index("\n  promote:")
    assert rnd_pos < shadow_pos < promotion_bundle_pos < promote_job_pos


def test_promotion_scope_remains_state_only():
    root = Path(__file__).resolve().parents[2]
    workflow = (root / ".github/workflows/senju-autonomous-improver.yml").read_text(encoding="utf-8")
    allowed = {
        "senju/state/champion.json",
        "senju/state/strategy.json",
        "senju/state/last-evolution-summary.json",
        "senju/state/last-evolution-plan.md",
    }
    write_lines = [line.strip() for line in workflow.splitlines() if line.strip().startswith("put_file ")]
    observed = {line.split()[-1] for line in write_lines}
    assert observed == allowed

    for forbidden in [
        "pull_request_target:",
        "workflow_run:",
        "runs-on: self-hosted",
        "git push --force",
        "permissions: write-all",
    ]:
        assert forbidden not in workflow
