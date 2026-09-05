# 🎯 最終手順：GitHubで直接workflowを作成

## ステップ1: GitHubにアクセス

このリンクを開いてください：

**https://github.com/MusicJapanLLC/test/new/claude/employee-onboarding-setup-udm86?filename=.github/workflows/ai-pr-approval-gate.yml**

## ステップ2: ファイル内容をコピペ

ローカルファイルの内容をコピー：
- ファイル: `C:\Users\user\Documents\test\.github\workflows\ai-pr-approval-gate.yml`

または、パッチファイル内の該当部分を使用

## ステップ3: Commit

GitHub UI で：
- Commit message: `feat(ci): add ai-pr-approval-gate workflow`
- Commit directly to `claude/employee-onboarding-setup-udm86` branch
- Click "Commit new file"

## ステップ4: 他の3つのworkflowも編集

### 編集が必要なファイル:

1. **ai-foundry-executor.yml**  
   https://github.com/MusicJapanLLC/test/edit/claude/employee-onboarding-setup-udm86/.github/workflows/ai-foundry-executor.yml
   
   Line 176の後に追加:
   ```bash
   PR_NUMBER="$(echo "$PR_URL" | grep -oE '[0-9]+$')"
   gh pr edit "$PR_NUMBER" --add-label "ai-merge-approved"
   echo "✅ Added ai-merge-approved label to PR #${PR_NUMBER}"
   ```

2. **tomoki-forge.yml**  
   https://github.com/MusicJapanLLC/test/edit/claude/employee-onboarding-setup-udm86/.github/workflows/tomoki-forge.yml
   
   Line 213の後に追加:
   ```bash
   PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
   gh pr edit "$PR_NUMBER" --add-label "ai-merge-approved" 2>/dev/null || true
   echo "✅ Added ai-merge-approved label to PR #${PR_NUMBER}"
   ```

3. **the-world-agent-factory.yml**  
   https://github.com/MusicJapanLLC/test/edit/claude/employee-onboarding-setup-udm86/.github/workflows/the-world-agent-factory.yml
   
   Line 319の後に追加:
   ```bash
   pr_number=$(echo "$url" | grep -oE '[0-9]+$')
   gh pr edit "$pr_number" --add-label "ai-merge-approved"
   echo "✅ Added ai-merge-approved label to PR #${pr_number}"
   ```

4. **self_heal_merge.py**  
   https://github.com/MusicJapanLLC/test/edit/claude/employee-onboarding-setup-udm86/automation/world/self_heal_merge.py
   
   Line 68-70を修正（ラベルチェック追加）

## ステップ5: 完了！

全て編集後、15分以内に auto-merge が動き始めます！

---

**所要時間**: 5分  
**効果**: 進化ループ完全復活 🚀
