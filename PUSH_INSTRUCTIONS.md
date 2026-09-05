# Auto-Merge Restoration - Manual Push Required

## OAuth Workflow Scope Issue

GitHub OAuth token lacks `workflow` scope - cannot push workflow file changes directly.

## Branch Status

**Local Branch**: `claude/auto-merge-restoration-20260906-0616`  
**Base Branch**: `claude/employee-onboarding-setup-udm86`  
**Commits Ready**: 3 commits

### Commit Log
```
3ddea80 fix(ci): apply forgotten edits to tomoki-forge message and self_heal_merge label check
29e356e docs(audit): add comprehensive auto-merge restoration analysis report
130e4a1 fix(ci): restore auto-merge by adding ai-merge-approved label automation
```

### Changed Files
```
.github/workflows/ai-foundry-executor.yml     | +3
.github/workflows/ai-pr-approval-gate.yml     | +126 (new file)
.github/workflows/the-world-agent-factory.yml | +3
.github/workflows/tomoki-forge.yml            | +6 -2
automation/world/self_heal_merge.py           | +5 -2
docs/reports/AUTO_MERGE_RESTORATION_REPORT.md | +299 (new file)
```

## Manual Steps Required

### Option 1: Push via Git CLI (with proper token)
```bash
# Ensure GitHub token has 'workflow' scope
git push -u origin claude/auto-merge-restoration-20260906-0616

# Then create PR
gh pr create \
  --base claude/employee-onboarding-setup-udm86 \
  --head claude/auto-merge-restoration-20260906-0616 \
  --title "fix(ci): restore auto-merge by adding ai-merge-approved label automation" \
  --body "See docs/reports/AUTO_MERGE_RESTORATION_REPORT.md for full analysis"
```

### Option 2: Apply patch file
Generate and apply patch:
```bash
git format-patch HEAD~3..HEAD --stdout > auto-merge-fix.patch
git checkout claude/employee-onboarding-setup-udm86
git apply auto-merge-fix.patch
git push
```

## Summary

**Problem**: 100+ PRs skipped auto-merge since Aug 30 (missing `ai-merge-approved` label)

**Solution**: 
1. New workflow: `ai-pr-approval-gate.yml` - auto-evaluates and labels PRs
2. Enhanced 3 PR-creating workflows to add label inline
3. Hardened `self_heal_merge.py` to check label before merge

**Impact**: Restores full auto-merge functionality with maintained security boundaries

**Ready for**: Manual push → PR creation → Merge → Validation
