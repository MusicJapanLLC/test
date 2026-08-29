from pathlib import Path


def test_autonomous_promotion_requires_shadow_stability_gate():
    root = Path(__file__).resolve().parents[2]
    workflow = (root / ".github/workflows/senju-autonomous-improver.yml").read_text(encoding="utf-8")

    required = [
        "Shadow-test proposed strategy across multiple seeds",
        "python -m scripts.shadow_league",
        "--strategy /tmp/promotion/strategy.json",
        "--seeds 5",
        "--require-stable",
        "senju-prepromotion-shadow",
    ]
    for invariant in required:
        assert invariant in workflow, f"Senju promotion lost invariant: {invariant}"

    shadow_pos = workflow.index("Shadow-test proposed strategy across multiple seeds")
    promotion_bundle_pos = workflow.index("Upload validated promotion bundle")
    promote_job_pos = workflow.index("\n  promote:")
    assert shadow_pos < promotion_bundle_pos < promote_job_pos


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
