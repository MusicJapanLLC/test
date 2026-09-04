"""
Knowledge Pushback Engine — Bidirectional Knowledge Flow

THE-WORLD-GOD discovers improvements → pushes back to test repo
test repo applies improvements → reports results → THE-WORLD-GOD learns

This is the EXECUTION layer that closes the feedback loop.
"""

import json
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from pathlib import Path
import subprocess


class RepositoryManager:
    """Direct repo file operations without external APIs"""

    def __init__(self, repo_root: str):
        self.repo_root = Path(repo_root)
        self.git_dir = self.repo_root / ".git"

    def file_exists(self, file_path: str) -> bool:
        """Check if file exists in repo"""
        full_path = self.repo_root / file_path
        return full_path.exists()

    def read_file(self, file_path: str) -> Optional[str]:
        """Read file from repo"""
        try:
            full_path = self.repo_root / file_path
            return full_path.read_text()
        except Exception as e:
            print(f"[ERROR] Read {file_path}: {e}")
            return None

    def write_file(self, file_path: str, content: str) -> bool:
        """Write file to repo"""
        try:
            full_path = self.repo_root / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content)
            return True
        except Exception as e:
            print(f"[ERROR] Write {file_path}: {e}")
            return False

    def commit_and_push(self, message: str, branch: str = "main") -> Tuple[bool, str]:
        """Commit changes and push to branch"""
        try:
            # Stage all changes
            subprocess.run(
                ["git", "add", "-A"],
                cwd=self.repo_root,
                capture_output=True,
                check=True
            )

            # Commit
            result = subprocess.run(
                ["git", "commit", "-m", message],
                cwd=self.repo_root,
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                return False, f"Commit failed: {result.stderr}"

            # Push
            push_result = subprocess.run(
                ["git", "push", "origin", branch],
                cwd=self.repo_root,
                capture_output=True,
                text=True
            )

            if push_result.returncode != 0:
                return False, f"Push failed: {push_result.stderr}"

            return True, "Pushed successfully"

        except Exception as e:
            return False, str(e)


class KnowledgePushback:
    """
    Execute THE-WORLD-GOD discoveries as actual code changes in test repo
    """

    def __init__(self, test_repo_root: str, god_state_dir: str):
        self.repo = RepositoryManager(test_repo_root)
        self.state_dir = Path(god_state_dir)
        self.pushback_log = self.state_dir / "pushback_log.ndjson"
        self.metrics_file = self.state_dir / "pushback_metrics.json"

    def execute_fix(
        self,
        knowledge_id: str,
        target_repo: str,
        fix_proposal: Dict
    ) -> Dict:
        """
        Execute a knowledge-based fix in target repo

        Handles:
        - Configuration tuning
        - Dependency updates
        - Code pattern refactoring
        - Workflow/CI improvements
        """
        execution_id = f"exec_{datetime.utcnow().timestamp()}"
        result = {
            "execution_id": execution_id,
            "knowledge_id": knowledge_id,
            "target_repo": target_repo,
            "status": "pending",
            "timestamp": datetime.utcnow().isoformat(),
            "changes": [],
            "error": None
        }

        try:
            fix_type = fix_proposal.get("type", "unknown")

            if fix_type == "config_tune":
                result = self._apply_config_fix(result, fix_proposal)
            elif fix_type == "dependency_update":
                result = self._apply_dependency_fix(result, fix_proposal)
            elif fix_type == "code_pattern":
                result = self._apply_code_pattern_fix(result, fix_proposal)
            elif fix_type == "workflow":
                result = self._apply_workflow_fix(result, fix_proposal)
            else:
                result["error"] = f"Unknown fix type: {fix_type}"
                result["status"] = "failed"

            # Log the execution
            self._log_execution(result)

            return result

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
            self._log_execution(result)
            return result

    def _apply_config_fix(self, result: Dict, proposal: Dict) -> Dict:
        """Apply configuration tuning"""
        config_file = proposal.get("config_file")
        tuning = proposal.get("tuning", {})

        if not config_file:
            result["error"] = "config_file not specified"
            result["status"] = "failed"
            return result

        # Read existing config
        content = self.repo.read_file(config_file)
        if content is None:
            result["error"] = f"Config file not found: {config_file}"
            result["status"] = "failed"
            return result

        try:
            config = json.loads(content)
        except:
            result["error"] = "Config is not valid JSON"
            result["status"] = "failed"
            return result

        # Apply tuning
        original_config = json.loads(json.dumps(config))
        for key, value in tuning.items():
            config[key] = value
            result["changes"].append(f"Config.{key}: {original_config.get(key)} → {value}")

        # Write back
        if self.repo.write_file(config_file, json.dumps(config, indent=2)):
            result["status"] = "applied"
            result["applied_file"] = config_file
        else:
            result["error"] = "Failed to write config"
            result["status"] = "failed"

        return result

    def _apply_dependency_fix(self, result: Dict, proposal: Dict) -> Dict:
        """Apply dependency updates"""
        lockfile = proposal.get("lockfile", "package-lock.json")
        updates = proposal.get("updates", {})

        if not updates:
            result["error"] = "No updates specified"
            result["status"] = "failed"
            return result

        # For now, log the dependency update as a manifest
        update_manifest = {
            "timestamp": datetime.utcnow().isoformat(),
            "knowledge_id": result["knowledge_id"],
            "updates": updates
        }

        manifest_file = f"automation/dependency-updates/{result['execution_id']}.json"
        if self.repo.write_file(manifest_file, json.dumps(update_manifest, indent=2)):
            for pkg, version in updates.items():
                result["changes"].append(f"Dependency {pkg} → {version}")
            result["status"] = "applied"
            result["applied_file"] = manifest_file
        else:
            result["error"] = "Failed to write dependency manifest"
            result["status"] = "failed"

        return result

    def _apply_code_pattern_fix(self, result: Dict, proposal: Dict) -> Dict:
        """Apply code pattern refactorings"""
        affected_files = proposal.get("affected_files", [])
        transformations = proposal.get("transformations", {})

        applied_count = 0
        for file_path, transform_spec in transformations.items():
            if not self.repo.file_exists(file_path):
                result["changes"].append(f"SKIP {file_path}: not found")
                continue

            content = self.repo.read_file(file_path)
            if content is None:
                result["changes"].append(f"SKIP {file_path}: read error")
                continue

            # Apply transformation (search/replace)
            original = content
            for search, replace in transform_spec.get("replacements", []):
                content = content.replace(search, replace)

            if content != original:
                if self.repo.write_file(file_path, content):
                    applied_count += 1
                    result["changes"].append(f"Transformed: {file_path}")
                else:
                    result["changes"].append(f"FAILED: {file_path}")

        if applied_count > 0:
            result["status"] = "applied"
        else:
            result["status"] = "no_changes"

        return result

    def _apply_workflow_fix(self, result: Dict, proposal: Dict) -> Dict:
        """Apply CI/workflow improvements"""
        workflow_file = proposal.get("workflow_file")
        changes = proposal.get("changes", {})

        if not workflow_file:
            result["error"] = "workflow_file not specified"
            result["status"] = "failed"
            return result

        content = self.repo.read_file(workflow_file)
        if content is None:
            # Create new workflow
            if self.repo.write_file(workflow_file, changes.get("content", "")):
                result["status"] = "created"
                result["applied_file"] = workflow_file
                result["changes"].append(f"Created workflow: {workflow_file}")
            else:
                result["error"] = "Failed to create workflow"
                result["status"] = "failed"
        else:
            # Update existing workflow
            updated_content = content
            for key, value in changes.get("patches", {}).items():
                updated_content = updated_content.replace(key, value)

            if self.repo.write_file(workflow_file, updated_content):
                result["status"] = "applied"
                result["applied_file"] = workflow_file
                result["changes"].append(f"Updated workflow: {workflow_file}")
            else:
                result["error"] = "Failed to update workflow"
                result["status"] = "failed"

        return result

    def _log_execution(self, result: Dict):
        """Log execution to NDJSON audit log"""
        try:
            with open(self.pushback_log, 'a') as f:
                f.write(json.dumps(result) + "\n")
        except Exception as e:
            print(f"[ERROR] Failed to log execution: {e}")

    def get_pushback_metrics(self) -> Dict:
        """Get bidirectional flow metrics"""
        metrics = {
            "total_executions": 0,
            "successful": 0,
            "failed": 0,
            "applied_changes": 0,
            "by_type": {},
            "executions": []
        }

        if not self.pushback_log.exists():
            return metrics

        try:
            with open(self.pushback_log, 'r') as f:
                for line in f:
                    if not line.strip():
                        continue
                    exec_result = json.loads(line)
                    metrics["total_executions"] += 1
                    metrics["executions"].append(exec_result)

                    status = exec_result.get("status", "unknown")
                    if status == "applied" or status == "created":
                        metrics["successful"] += 1
                        metrics["applied_changes"] += len(exec_result.get("changes", []))
                    elif status == "failed":
                        metrics["failed"] += 0

                    fix_type = exec_result.get("fix_type", "unknown")
                    metrics["by_type"][fix_type] = metrics["by_type"].get(fix_type, 0) + 1

        except Exception as e:
            print(f"[ERROR] Failed to read metrics: {e}")

        return metrics

    def save_metrics(self):
        """Persist metrics to JSON"""
        metrics = self.get_pushback_metrics()
        try:
            with open(self.metrics_file, 'w') as f:
                json.dump(metrics, f, indent=2)
        except Exception as e:
            print(f"[ERROR] Failed to save metrics: {e}")


class BidirectionalKnowledgeFlow:
    """
    Orchestrates bidirectional flow:
    test ↔ Knowledge DB ↔ THE-WORLD-GOD

    Inbound: test discoveries flow to THE-WORLD-GOD
    Outbound: THE-WORLD-GOD improvements flow back to test
    """

    def __init__(self, test_repo_root: str, god_state_dir: str):
        self.pushback = KnowledgePushback(test_repo_root, god_state_dir)
        self.flow_log = Path(god_state_dir) / "bidirectional_flow.ndjson"

    def process_knowledge_discovery(self, discovery: Dict) -> Dict:
        """
        When test repo makes a discovery, record bidirectional intent
        """
        flow_event = {
            "direction": "inbound",
            "timestamp": datetime.utcnow().isoformat(),
            "discovery_id": discovery.get("knowledge_id"),
            "source_repo": "test",
            "target_repos": ["the-world2"],
            "status": "pending"
        }

        # Log the flow
        self._log_flow(flow_event)
        return flow_event

    def process_god_improvement(self, improvement: Dict) -> Dict:
        """
        When THE-WORLD-GOD finds an improvement, execute it back to test
        """
        flow_event = {
            "direction": "outbound",
            "timestamp": datetime.utcnow().isoformat(),
            "improvement_id": improvement.get("execution_id"),
            "source": "THE-WORLD-GOD",
            "target_repo": improvement.get("target_repo", "test"),
            "status": "executing"
        }

        # Execute the improvement
        execution = self.pushback.execute_fix(
            improvement.get("knowledge_id"),
            improvement.get("target_repo", "test"),
            improvement.get("proposal")
        )

        flow_event["execution_result"] = execution
        flow_event["status"] = execution.get("status")

        # Log the flow
        self._log_flow(flow_event)
        return flow_event

    def _log_flow(self, flow_event: Dict):
        """Log bidirectional flow event"""
        try:
            with open(self.flow_log, 'a') as f:
                f.write(json.dumps(flow_event) + "\n")
        except Exception as e:
            print(f"[ERROR] Failed to log flow: {e}")

    def get_flow_summary(self) -> Dict:
        """Get summary of bidirectional flow health"""
        summary = {
            "inbound_count": 0,
            "outbound_count": 0,
            "flow_rate": 0.0,
            "outbound_success_rate": 0.0,
            "last_inbound": None,
            "last_outbound": None
        }

        if not self.flow_log.exists():
            return summary

        try:
            inbound_events = []
            outbound_events = []

            with open(self.flow_log, 'r') as f:
                for line in f:
                    if not line.strip():
                        continue
                    event = json.loads(line)

                    if event.get("direction") == "inbound":
                        inbound_events.append(event)
                        summary["last_inbound"] = event.get("timestamp")
                    else:
                        outbound_events.append(event)
                        summary["last_outbound"] = event.get("timestamp")

            summary["inbound_count"] = len(inbound_events)
            summary["outbound_count"] = len(outbound_events)

            if inbound_events:
                summary["flow_rate"] = len(outbound_events) / len(inbound_events) if inbound_events else 0

            if outbound_events:
                successful = sum(1 for e in outbound_events if e.get("status") in ["applied", "created"])
                summary["outbound_success_rate"] = successful / len(outbound_events)

        except Exception as e:
            print(f"[ERROR] Failed to parse flow summary: {e}")

        return summary
