#!/usr/bin/env python3
"""Standment Security Scan.

A deliberately non-invasive, allowlist-only website security audit.
It performs read-only HTTPS/TLS/header checks plus a very small set of
well-known accidental-exposure probes. It does not fuzz, brute-force,
bypass authentication, exploit vulnerabilities, or mutate remote state.
"""
from __future__ import annotations

import argparse
import json
import re
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

USER_AGENT = "Standment-Security-Scan/1.0 (+defensive-passive-audit)"
MAX_BODY = 2_000_000


@dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    title: str
    detail: str
    remediation: str
    penalty: int


@dataclass
class ResponseSnapshot:
    status: int
    final_url: str
    headers: dict[str, str]
    set_cookies: list[str]
    body: bytes


SENSITIVE_PROBES: dict[str, re.Pattern[str]] = {
    ".env": re.compile(r"(?m)^[A-Z][A-Z0-9_]{2,}\s*="),
    ".git/HEAD": re.compile(r"^ref:\s+refs/heads/"),
    "package.json": re.compile(r'"(?:dependencies|devDependencies|scripts)"\s*:'),
    "vite.config.ts": re.compile(r"\bdefineConfig\s*\("),
}

SEVERITY_ORDER = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}


def clamp_score(value: int) -> int:
    return max(0, min(100, value))


def grade_for_score(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def calculate_score(findings: list[Finding]) -> int:
    return clamp_score(100 - sum(max(0, f.penalty) for f in findings))


def fetch(url: str, timeout: float = 12.0) -> ResponseSnapshot:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="GET")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return ResponseSnapshot(
                status=int(resp.status),
                final_url=resp.geturl(),
                headers={k.lower(): v for k, v in resp.headers.items()},
                set_cookies=list(resp.headers.get_all("Set-Cookie") or []),
                body=resp.read(MAX_BODY),
            )
    except urllib.error.HTTPError as exc:
        return ResponseSnapshot(
            status=int(exc.code),
            final_url=exc.geturl(),
            headers={k.lower(): v for k, v in exc.headers.items()},
            set_cookies=list(exc.headers.get_all("Set-Cookie") or []),
            body=exc.read(min(MAX_BODY, 256_000)),
        )


def tls_snapshot(hostname: str, port: int = 443, timeout: float = 8.0) -> dict[str, Any]:
    ctx = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=hostname) as tls:
            cert = tls.getpeercert()
            cipher = tls.cipher()
            expires_raw = cert.get("notAfter")
            expires_at = None
            days_remaining = None
            if expires_raw:
                expires_dt = datetime.strptime(expires_raw, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                expires_at = expires_dt.isoformat()
                days_remaining = int((expires_dt - datetime.now(timezone.utc)).total_seconds() // 86400)
            return {
                "version": tls.version(),
                "cipher": cipher[0] if cipher else None,
                "certificate_expires_at": expires_at,
                "certificate_days_remaining": days_remaining,
            }


def add(findings: list[Finding], severity: str, code: str, title: str, detail: str, remediation: str, penalty: int) -> None:
    findings.append(Finding(severity, code, title, detail, remediation, penalty))


def inspect_headers(snapshot: ResponseSnapshot, findings: list[Finding]) -> None:
    h = snapshot.headers
    csp = h.get("content-security-policy", "")

    if "strict-transport-security" not in h:
        add(findings, "HIGH", "header.hsts.missing", "HSTSがありません", "HTTPS利用後もブラウザにHTTPS強制を記憶させるHSTSがありません。", "Strict-Transport-Securityを設定してください。", 12)
    if not csp:
        add(findings, "HIGH", "header.csp.missing", "CSPがありません", "ブラウザ側のスクリプト・接続先を制限するContent-Security-Policyがありません。", "必要な外部ドメインだけを許可するCSPを導入してください。", 15)
    else:
        if "'unsafe-eval'" in csp:
            add(findings, "HIGH", "csp.unsafe-eval", "CSPでunsafe-evalを許可", "実行時の文字列コード評価を許可しています。", "unsafe-evalを削除し、動的コード生成を廃止してください。", 12)
        if re.search(r"(?:^|;)\s*script-src[^;]*\s\*", csp):
            add(findings, "HIGH", "csp.script-wildcard", "script-srcがワイルドカード", "任意オリジンのスクリプト読み込みを許可する可能性があります。", "script-srcを明示的な許可リストにしてください。", 12)
        if "frame-ancestors" not in csp and "x-frame-options" not in h:
            add(findings, "MEDIUM", "header.framing.missing", "クリックジャッキング対策が弱い", "frame-ancestorsまたはX-Frame-Optionsが確認できません。", "CSP frame-ancestorsを優先して設定してください。", 7)

    if h.get("x-content-type-options", "").lower() != "nosniff":
        add(findings, "MEDIUM", "header.nosniff.missing", "MIME sniffing対策がありません", "X-Content-Type-Options: nosniff がありません。", "nosniffを設定してください。", 6)
    if "referrer-policy" not in h:
        add(findings, "LOW", "header.referrer-policy.missing", "Referrer-Policyがありません", "外部遷移時のReferer情報量を明示制御していません。", "strict-origin-when-cross-origin等を設定してください。", 3)
    if "permissions-policy" not in h:
        add(findings, "LOW", "header.permissions-policy.missing", "Permissions-Policyがありません", "カメラ・マイク・位置情報などのブラウザ機能を明示制限していません。", "不要なブラウザ機能をPermissions-Policyで無効化してください。", 4)
    if "cross-origin-opener-policy" not in h:
        add(findings, "LOW", "header.coop.missing", "COOPがありません", "別オリジン文脈との分離ポリシーがありません。", "互換性を確認しCross-Origin-Opener-Policyを設定してください。", 3)

    acao = h.get("access-control-allow-origin", "")
    acac = h.get("access-control-allow-credentials", "").lower()
    if acao == "*" and acac == "true":
        add(findings, "HIGH", "cors.wildcard-with-credentials", "CORS設定が矛盾しています", "Access-Control-Allow-Origin: * と Access-Control-Allow-Credentials: true が同時に返っています。", "資格情報を伴うCORSが必要なら明示的な許可オリジンへ限定し、不要ならcredentialsを無効化してください。", 10)


def inspect_cookies(snapshot: ResponseSnapshot, findings: list[Finding]) -> None:
    for raw in snapshot.set_cookies:
        lower = raw.lower()
        name = raw.split("=", 1)[0].strip() or "cookie"
        if "secure" not in lower:
            add(findings, "MEDIUM", "cookie.secure.missing", f"Cookie {name} にSecureがありません", "HTTPS通信以外でも送信される余地があります。", "認証・状態CookieにはSecure属性を付けてください。", 6)
        if "httponly" not in lower:
            add(findings, "LOW", "cookie.httponly.missing", f"Cookie {name} にHttpOnlyがありません", "JavaScriptからCookieへアクセスできる可能性があります。", "JavaScriptアクセスが不要なCookieにはHttpOnlyを付けてください。", 3)
        if "samesite=" not in lower:
            add(findings, "LOW", "cookie.samesite.missing", f"Cookie {name} にSameSiteがありません", "クロスサイト送信ポリシーが明示されていません。", "用途に応じてSameSite=Lax/Strictを設定してください。", 3)


def inspect_html(snapshot: ResponseSnapshot, findings: list[Finding]) -> dict[str, Any]:
    text = snapshot.body.decode("utf-8", errors="replace")
    inline_handlers = sorted(set(re.findall(r"\s(on[a-z]+)\s*=", text, flags=re.IGNORECASE)))
    if inline_handlers:
        add(findings, "MEDIUM", "html.inline-event-handler", "インラインイベントハンドラを検出", f"HTML内に {', '.join(inline_handlers[:8])} を検出しました。", "addEventListener等へ移し、強いCSPと両立させてください。", 6)
    mixed = sorted(set(re.findall(r"(?:src|href|action|poster)=[\"'](http://[^\"']+)", text, flags=re.IGNORECASE)))
    if mixed:
        add(findings, "HIGH", "html.mixed-content", "HTTPリソース参照を検出", f"HTTPSページからHTTP URLを参照しています: {mixed[0][:180]}", "すべてHTTPSへ変更してください。", 12)
    third_party_scripts = sorted(set(re.findall(r"<script[^>]+src=[\"'](https?://[^\"']+)", text, flags=re.IGNORECASE)))
    return {"inline_event_handlers": inline_handlers, "mixed_content_urls": mixed, "third_party_scripts": third_party_scripts}


def inspect_tls(target_url: str, findings: list[Finding]) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(target_url)
    if parsed.scheme != "https":
        add(findings, "CRITICAL", "transport.https.required", "HTTPSではありません", "診断対象がHTTPSを使用していません。", "TLS証明書を設定しHTTPSへ常時リダイレクトしてください。", 30)
        return {"error": "target is not https"}
    try:
        info = tls_snapshot(parsed.hostname or "", parsed.port or 443)
    except Exception as exc:
        add(findings, "HIGH", "tls.connection.failed", "TLS検証に失敗", str(exc), "証明書・DNS・TLS設定を確認してください。", 15)
        return {"error": str(exc)}
    days = info.get("certificate_days_remaining")
    if isinstance(days, int):
        if days < 0:
            add(findings, "CRITICAL", "tls.certificate.expired", "TLS証明書が期限切れ", f"証明書期限を {abs(days)} 日超過しています。", "直ちに証明書を更新してください。", 30)
        elif days < 14:
            add(findings, "HIGH", "tls.certificate.expiring", "TLS証明書の期限が近い", f"残り約 {days} 日です。", "自動更新設定を確認し、期限前に更新してください。", 12)
        elif days < 30:
            add(findings, "MEDIUM", "tls.certificate.expiring-soon", "TLS証明書の更新時期が近い", f"残り約 {days} 日です。", "証明書更新を確認してください。", 5)
    return info


def inspect_exposures(base_url: str, findings: list[Finding]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    base = base_url if base_url.endswith("/") else base_url + "/"
    for relative, signature in SENSITIVE_PROBES.items():
        url = urllib.parse.urljoin(base, relative)
        try:
            snap = fetch(url)
            text = snap.body.decode("utf-8", errors="replace")
            exposed = 200 <= snap.status < 300 and bool(signature.search(text))
            results.append({"path": relative, "status": snap.status, "signature_match": exposed, "final_url": snap.final_url})
            if exposed:
                add(findings, "CRITICAL", "exposure.sensitive-file", "開発・秘密情報ファイルが公開", f"/{relative} が公開状態に見えます。", "公開対象から除外し、漏えいした秘密情報があればローテーションしてください。", 30)
        except Exception as exc:
            results.append({"path": relative, "error": str(exc)})
    return results


def render_markdown(report: dict[str, Any]) -> str:
    target = report["target"]
    summary = report["summary"]
    findings = report["findings"]
    lines = [
        "# Standment Security Scan",
        "",
        f"- 対象: `{target['url']}`",
        f"- スコア: **{summary['score']} / 100**",
        f"- 評価: **{summary['grade']}**",
        f"- Findings: **{summary['finding_count']}**",
        f"- Critical / High: **{summary['critical_high_count']}**",
        "",
        "## 判定",
        "",
        summary["verdict_ja"],
        "",
        "## Findings",
        "",
    ]
    if not findings:
        lines.append("今回の受動診断では指摘事項を検出しませんでした。")
    else:
        for item in findings:
            lines.extend([
                f"### {item['severity']} — {item['title']}",
                "",
                item["detail"],
                "",
                f"**修正:** {item['remediation']}",
                "",
            ])
    lines.extend([
        "## 診断範囲",
        "",
        "この診断はHTTPS/TLS、HTTPレスポンスヘッダー、トップページHTML、Cookie属性、限定的な公開ファイル確認のみを行う非侵襲・読み取り専用の診断です。侵入試験、認証突破、ブルートフォース、脆弱性悪用、負荷試験は行いません。",
        "",
    ])
    return "\n".join(lines)


def audit_target(target: dict[str, Any]) -> dict[str, Any]:
    if target.get("authorized") is not True:
        raise ValueError(f"target {target.get('id')} is not explicitly authorized")
    url = str(target.get("url", "")).strip()
    if not url:
        raise ValueError("target url is required")

    findings: list[Finding] = []
    tls = inspect_tls(url, findings)
    try:
        root = fetch(url)
    except Exception as exc:
        add(findings, "CRITICAL", "availability.fetch.failed", "サイトへ接続できません", str(exc), "DNS・TLS・公開設定・稼働状況を確認してください。", 35)
        root = ResponseSnapshot(0, url, {}, [], b"")

    if root.status and not 200 <= root.status < 400:
        add(findings, "HIGH", "availability.status", "トップページが正常応答ではありません", f"HTTP {root.status} を返しました。", "公開経路とアプリケーションの状態を確認してください。", 12)

    inspect_headers(root, findings)
    inspect_cookies(root, findings)
    html_info = inspect_html(root, findings)
    exposures = inspect_exposures(url, findings)

    findings.sort(key=lambda f: (-SEVERITY_ORDER.get(f.severity, 0), f.code))
    score = calculate_score(findings)
    minimum = int(target.get("minimum_score", 90))
    critical_high = sum(f.severity in {"CRITICAL", "HIGH"} for f in findings)
    passed = score >= minimum and critical_high == 0
    verdict = "合格。現在の基準では重大な受動診断指摘はありません。" if passed else "要改善。重大指摘または基準スコア未達があります。修正後に再診断してください。"

    return {
        "schema": "standment.security-scan.v1",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "target": {k: target.get(k) for k in ("id", "name", "url", "owner", "minimum_score")},
        "summary": {
            "score": score,
            "grade": grade_for_score(score),
            "finding_count": len(findings),
            "critical_high_count": critical_high,
            "minimum_score": minimum,
            "passed": passed,
            "verdict_ja": verdict,
        },
        "http": {"status": root.status, "final_url": root.final_url, "headers": root.headers},
        "tls": tls,
        "html": html_info,
        "exposure_probes": exposures,
        "findings": [asdict(f) for f in findings],
    }


def load_targets(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    targets = data.get("targets", [])
    if not isinstance(targets, list) or not targets:
        raise ValueError("config must contain a non-empty targets list")
    return targets


def safe_filename(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-") or "target"


def main() -> int:
    parser = argparse.ArgumentParser(description="Standment allowlist-only passive security scan")
    parser.add_argument("--config", type=Path, default=Path("security/targets.json"))
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true")
    group.add_argument("--target-id")
    parser.add_argument("--output-dir", type=Path, default=Path("security-reports/site-audit"))
    args = parser.parse_args()

    targets = load_targets(args.config)
    if args.target_id:
        targets = [t for t in targets if t.get("id") == args.target_id]
        if not targets:
            raise SystemExit(f"unknown target id: {args.target_id}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    failed = False
    index: list[dict[str, Any]] = []
    for target in targets:
        report = audit_target(target)
        key = safe_filename(str(target.get("id", "target")))
        json_path = args.output_dir / f"{key}.json"
        md_path = args.output_dir / f"{key}.md"
        json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        md_path.write_text(render_markdown(report), encoding="utf-8")
        index.append({"id": target.get("id"), **report["summary"], "json": str(json_path), "markdown": str(md_path)})
        failed = failed or not report["summary"]["passed"]
        print(f"{target.get('id')}: {report['summary']['score']}/100 {report['summary']['grade']} passed={report['summary']['passed']}")

    (args.output_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
