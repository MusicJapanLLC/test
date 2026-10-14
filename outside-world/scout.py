#!/usr/bin/env python3
"""THE WORLD Outside World Scout.

Read-only public feed explorer for Child Guild / R&D.
No posting, login bypass, credential use, or third-party email is performed here.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UA = "TheWorld-OutsideScout/1.0 (+public-read-only; MusicJapanLLC/test)"
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")


def load_json(path: str, default: Any) -> Any:
    p = Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def clean_text(value: str | None, limit: int = 500) -> str:
    if not value:
        return ""
    text = html.unescape(TAG_RE.sub(" ", value))
    return SPACE_RE.sub(" ", text).strip()[:limit]


def fetch(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.1"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        if res.status < 200 or res.status >= 300:
            raise RuntimeError(f"HTTP {res.status}")
        return res.read(2_000_000)


def child_text(node: ET.Element, names: tuple[str, ...]) -> str:
    for el in node.iter():
        local = el.tag.rsplit("}", 1)[-1].lower()
        if local in names and el.text:
            return el.text.strip()
    return ""


def atom_link(node: ET.Element) -> str:
    for el in node.iter():
        if el.tag.rsplit("}", 1)[-1].lower() == "link":
            href = el.attrib.get("href", "").strip()
            rel = el.attrib.get("rel", "alternate")
            if href and rel in {"alternate", ""}:
                return href
    return ""


def parse_feed(raw: bytes, source: dict[str, Any]) -> list[dict[str, Any]]:
    root = ET.fromstring(raw)
    items: list[dict[str, Any]] = []
    limit = int(source.get("max_items") or 12)
    for node in root.iter():
        local = node.tag.rsplit("}", 1)[-1].lower()
        if local not in {"item", "entry"}:
            continue
        title = clean_text(child_text(node, ("title",)), 220)
        link = child_text(node, ("link",)) if local == "item" else atom_link(node)
        if not link:
            link = atom_link(node)
        summary = clean_text(child_text(node, ("description", "summary", "content")), 420)
        published = child_text(node, ("pubdate", "published", "updated", "date"))
        if not title or not link:
            continue
        uid = hashlib.sha256(f"{source['id']}|{link}".encode("utf-8")).hexdigest()[:20]
        items.append({
            "id": uid,
            "source_id": source["id"],
            "category": source.get("category", "misc"),
            "title": title,
            "url": link.strip(),
            "summary": summary,
            "published": published,
            "weight": float(source.get("weight", 1.0)),
        })
        if len(items) >= limit:
            break
    return items


def curiosity_score(item: dict[str, Any], seed: str) -> float:
    novelty_noise = int(hashlib.sha256(f"{seed}|{item['id']}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    weird_words = (
        "agent", "autonomous", "robot", "weird", "tiny", "experiment", "game",
        "creative", "hack", "prototype", "strange", "unexpected", "AI", "art",
        "browser", "security", "open source", "research",
    )
    hay = f"{item['title']} {item['summary']}".lower()
    weird = sum(1 for word in weird_words if word.lower() in hay) * 0.08
    return float(item.get("weight", 1.0)) + weird + novelty_noise * 0.45


def choose_child(seed: str) -> tuple[str, str]:
    names = [
        "Pixel","Momo","Byte","Pico","Nova","Kiki","Rin","Mochi","Zig","Nene",
        "Loop","Puku","Luna","Toto","Nico","Sora","Bibi","Kuma","Mimi","Robo",
        "Fizz","Poko","Mugi","Kero","Tama","Echo","Koko","Jelly","Pip","Yuzu",
        "Zero","Nori","Bam","Chibi","Wink","Ruru","Teki","Melo","Peta","Goma",
        "Raku","Nya","Mio","Qbit","Pompom","Zuzu","Lime","Taco","Mame","Orbit",
    ]
    idx = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16) % len(names)
    return f"CHILD-{idx + 1:02d}", names[idx]


def build(config: dict[str, Any], previous: dict[str, Any], seed: str) -> dict[str, Any]:
    seen = set(previous.get("seen_ids") or [])
    discoveries: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for source in config.get("sources", []):
        if source.get("kind") != "rss":
            continue
        source = {**source, "max_items": config.get("max_items_per_source", 12)}
        try:
            discoveries.extend(parse_feed(fetch(source["url"]), source))
        except Exception as exc:  # fail soft; one broken public feed must not stop the world
            errors.append({"source": source.get("id", "unknown"), "error": type(exc).__name__})

    unseen = [item for item in discoveries if item["id"] not in seen]
    pool = unseen or discoveries
    for item in pool:
        item["curiosity_score"] = round(curiosity_score(item, seed), 4)
    pool.sort(key=lambda x: x["curiosity_score"], reverse=True)
    pick = pool[0] if pool else None

    child_id, child_name = choose_child(seed)
    updated_seen = list(dict.fromkeys(([x["id"] for x in unseen[:80]] + list(seen))))[:400]
    return {
        "schema": "outside-world-scout-state/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "child": {"id": child_id, "name": child_name},
        "mode": "public_read_only_discovery",
        "picked": pick,
        "unseen_count": len(unseen),
        "fetched_count": len(discoveries),
        "errors": errors,
        "seen_ids": updated_seen,
        "rules": {
            "public_only": True,
            "no_login_bypass": True,
            "no_external_posting": True,
            "fun_without_utility_allowed": True,
        },
    }


def render(state: dict[str, Any]) -> str:
    child = state["child"]
    pick = state.get("picked")
    lines = [
        "# OUTSIDE WORLD SCOUT",
        "",
        f"**Scout:** {child['id']} / {child['name']}",
        f"**Fetched:** {state['fetched_count']} / unseen {state['unseen_count']}",
        "",
    ]
    if pick:
        lines.extend([
            "## こんなの見たんだよ！",
            f"**{pick['title']}**",
            f"- category: `{pick['category']}`",
            f"- source: `{pick['source_id']}`",
            f"- url: {pick['url']}",
            f"- memo: {pick['summary'] or 'タイトルだけで気になった。理由はまだない。'}",
            "",
            "**WHY:** 面白そうだったから。役に立つ必要はない。",
        ])
    else:
        lines.append("今日は公開Feedから持ち帰れる新しいものを見つけられなかった。次の巡回へ。")
    if state["errors"]:
        lines += ["", "## Feed errors"]
        lines += [f"- {e['source']}: {e['error']}" for e in state["errors"]]
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="outside-world/sources.json")
    p.add_argument("--previous", default="outside-world-previous.json")
    p.add_argument("--seed", default="")
    p.add_argument("--json", default="outside-world-state.json")
    p.add_argument("--report", default="outside-world-report.md")
    args = p.parse_args()

    seed = args.seed or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    config = load_json(args.config, {})
    previous = load_json(args.previous, {})
    state = build(config, previous, seed)
    Path(args.json).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.report).write_text(render(state), encoding="utf-8")
    print(json.dumps({
        "child": state["child"]["id"],
        "fetched": state["fetched_count"],
        "unseen": state["unseen_count"],
        "picked": (state.get("picked") or {}).get("title"),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
