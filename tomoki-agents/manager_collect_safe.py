#!/usr/bin/env python3
"""Safe entrypoint for TOMOKI Manager `collect` mode.

GitHub Actions artifact downloads are served through a temporary redirect to
signed object storage. `urllib` may forward the original GitHub Authorization
header while following that redirect. Azure/object storage rejects that
foreign bearer token, which used to make the entire Covenant cycle crash with
401 InvalidAuthenticationInfo.

This wrapper patches only Manager's artifact reader:
- authenticate the request to api.github.com;
- stop automatic redirects;
- follow the signed redirect URL without GitHub Authorization when the host
  changes;
- degrade one unreadable artifact to an empty report rather than crashing the
  whole workforce collector.

The underlying Manager orchestration and its repair boundaries remain
unchanged.
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

import manager


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def _github_headers() -> dict[str, str]:
    if not manager.TOKEN:
        raise RuntimeError("GITHUB_TOKEN/GH_TOKEN is required")
    return {
        "Authorization": f"Bearer {manager.TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tomoki-manager-safe-artifact-reader",
    }


def _download_artifact_zip(artifact_id: int) -> bytes:
    url = f"{manager.API}/actions/artifacts/{artifact_id}/zip"
    request = urllib.request.Request(url, headers=_github_headers(), method="GET")
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        if exc.code not in {301, 302, 303, 307, 308}:
            body = exc.read().decode("utf-8", errors="replace")[:1000]
            raise RuntimeError(f"GitHub artifact GET -> {exc.code}: {body}") from exc
        location = str(exc.headers.get("Location") or "").strip()
        if not location:
            raise RuntimeError("GitHub artifact redirect had no Location header") from exc

    source_host = urllib.parse.urlparse(url).netloc.lower()
    target_host = urllib.parse.urlparse(location).netloc.lower()
    if not target_host:
        raise RuntimeError("GitHub artifact redirect target has no host")

    # A signed cross-host URL carries its own authentication. Never forward
    # GitHub's bearer token to object storage.
    headers = _github_headers() if target_host == source_host else {
        "User-Agent": "tomoki-manager-safe-artifact-reader"
    }
    follow = urllib.request.Request(location, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(follow, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(
            f"Artifact redirected download -> {exc.code} host={target_host}: {body}"
        ) from exc


def _artifact_report(run_id: int, artifact_name: str) -> str:
    data = manager._json("GET", f"/actions/runs/{run_id}/artifacts?per_page=100")
    artifacts = data.get("artifacts") or []
    matches = [
        artifact
        for artifact in artifacts
        if artifact.get("name") == artifact_name and not artifact.get("expired")
    ]
    if not matches:
        return ""

    artifact_id = int(matches[0]["id"])
    try:
        raw = _download_artifact_zip(artifact_id)
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = [
                name
                for name in archive.namelist()
                if name.lower().endswith((".md", ".txt", ".json"))
            ]
            if not names:
                return ""
            return archive.read(names[0]).decode("utf-8", errors="replace")
    except (RuntimeError, zipfile.BadZipFile, OSError) as exc:
        # Report retrieval is evidence enrichment, not a reason to kill the
        # control plane. Manager will mark the report MISSING and continue.
        print(
            json.dumps(
                {
                    "event": "artifact_read_degraded",
                    "run_id": run_id,
                    "artifact": artifact_name,
                    "error": f"{type(exc).__name__}: {exc}"[:700],
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        return ""


def main() -> int:
    manager._artifact_report = _artifact_report
    return int(manager.main())


if __name__ == "__main__":
    raise SystemExit(main())
