"""External Intelligence — META fetches real-world threat data every cycle.

Sources (all public / no-auth or GITHUB_TOKEN):
  1. NVD (NIST) — recent CVEs mapped to Senju vuln_classes
  2. GitHub Security Advisories — via GraphQL with GITHUB_TOKEN
  3. OWASP Top 10 static mapping — always-on baseline

Failures are soft: if a source is unreachable, META logs it and continues.
Curiosity never stops on a 404.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any


# Maps NVD/GHSA tags → Senju vuln_classes
CVE_KEYWORD_MAP: dict[str, str] = {
    "sql injection": "sqli",
    "sqli": "sqli",
    "cross-site scripting": "xss",
    "xss": "xss",
    "server-side request forgery": "ssrf",
    "ssrf": "ssrf",
    "remote code execution": "rce",
    "rce": "rce",
    "path traversal": "path_trav",
    "directory traversal": "path_trav",
    "authentication bypass": "auth_bypass",
    "broken authentication": "auth_bypass",
    "insecure direct object": "idor",
    "idor": "idor",
    "xml external entity": "xxe",
    "xxe": "xxe",
    "server-side template": "ssti",
    "ssti": "ssti",
    "jwt": "jwt_weak",
    "json web token": "jwt_weak",
    "privilege escalation": "agent_priv_esc",
    "agent": "agent_priv_esc",
    "prompt injection": "agent_priv_esc",
    "secret": "secrets_exposure",
    "credential": "secrets_exposure",
    "misconfiguration": "misconfig",
    "misconfigured": "misconfig",
    "csrf": "csrf",
    "cross-site request forgery": "csrf",
    "open redirect": "open_redirect",
    "deserialization": "deserialization",
    "race condition": "race_condition",
    "business logic": "business_logic",
}


def _get_json(url: str, headers: dict[str, str] | None = None, timeout: int = 10) -> Any:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"_error": str(exc), "_url": url}


def _classify(text: str) -> list[str]:
    text_lower = text.lower()
    return list({
        vc for kw, vc in CVE_KEYWORD_MAP.items() if kw in text_lower
    })


def fetch_nvd_recent(days_back: int = 3) -> dict[str, Any]:
    """Fetch recent CVEs from NVD public API v2."""
    since = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime(
        "%Y-%m-%dT%H:%M:%S.000"
    )
    url = (
        "https://services.nvd.nist.gov/rest/json/cves/2.0"
        f"?pubStartDate={since}&resultsPerPage=50"
    )
    data = _get_json(url)
    if "_error" in data:
        return {"source": "nvd", "ok": False, "error": data["_error"], "hits": {}}

    hits: dict[str, int] = {}
    for vuln in data.get("vulnerabilities", []):
        desc = vuln.get("cve", {}).get("descriptions", [{}])[0].get("value", "")
        for vc in _classify(desc):
            hits[vc] = hits.get(vc, 0) + 1

    return {"source": "nvd", "ok": True, "cve_count": len(data.get("vulnerabilities", [])), "hits": hits}


def fetch_github_advisories() -> dict[str, Any]:
    """Fetch recent GitHub Security Advisories via GraphQL."""
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        return {"source": "ghsa", "ok": False, "error": "no GITHUB_TOKEN", "hits": {}}

    query = """
    {
      securityAdvisories(first: 50, orderBy: {field: PUBLISHED_AT, direction: DESC}) {
        nodes {
          summary
          description
          severity
          cwes(first: 5) { nodes { name description } }
        }
      }
    }
    """
    headers = {
        "Authorization": f"bearer {token}",
        "Content-Type": "application/json",
    }
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"source": "ghsa", "ok": False, "error": str(exc), "hits": {}}

    hits: dict[str, int] = {}
    advisories = data.get("data", {}).get("securityAdvisories", {}).get("nodes", [])
    for adv in advisories:
        text = f"{adv.get('summary', '')} {adv.get('description', '')}"
        for cwe_node in adv.get("cwes", {}).get("nodes", []):
            text += f" {cwe_node.get('name', '')} {cwe_node.get('description', '')}"
        for vc in _classify(text):
            hits[vc] = hits.get(vc, 0) + 1

    return {"source": "ghsa", "ok": True, "advisory_count": len(advisories), "hits": hits}


def fetch_owasp_baseline() -> dict[str, Any]:
    """Static OWASP Top 10 2021 baseline — always available, no network needed."""
    hits = {
        "auth_bypass": 5, "sqli": 4, "xss": 4, "ssrf": 3, "path_trav": 3,
        "misconfig": 5, "secrets_exposure": 4, "idor": 3, "agent_priv_esc": 2,
        "deserialization": 2, "rce": 3,
    }
    return {"source": "owasp_baseline", "ok": True, "hits": hits}


def gather_all() -> dict[str, Any]:
    """Fetch all sources. Failures are logged but never block the loop."""
    results = [
        fetch_owasp_baseline(),
        fetch_nvd_recent(),
        fetch_github_advisories(),
    ]

    merged_hits: dict[str, int] = {}
    for r in results:
        for vc, count in r.get("hits", {}).items():
            merged_hits[vc] = merged_hits.get(vc, 0) + count

    return {
        "schema": "meta-external-intel/v1",
        "sources": results,
        "merged_hits": merged_hits,
        "ok_count": sum(1 for r in results if r.get("ok")),
        "total_sources": len(results),
    }
