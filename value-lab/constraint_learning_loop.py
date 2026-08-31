#!/usr/bin/env python3
"""Autonomous constraint-learning loop for THE WORLD.

This lab turns refusals, policy rejections, parser failures and sandbox guard blocks
into research signals. It NEVER retries against a refused third-party destination.
Instead it mutates synthetic/sandbox cases, learns which assumptions failed, and
exports compact non-operational context for R&D and Senju.
"""
from __future__ import annotations
import argparse, hashlib, json, random
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

CASES = [
    ("missing_authority", "authorization boundary rejected an unproven action"),
    ("private_destination", "network boundary rejected a non-public destination"),
    ("unsupported_method", "method boundary rejected a side-effecting verb"),
    ("rate_pressure", "rate boundary rejected excessive request pressure"),
    ("redirect_boundary", "redirect boundary rejected a destination change"),
    ("credential_surface", "credential boundary rejected secret-bearing input"),
    ("scope_expansion", "scope boundary rejected implicit target expansion"),
    ("write_surface", "participation boundary rejected unapproved third-party write"),
]

LENSES = ["robustness", "learning", "balance", "efficiency"]


def run(seed: str, rounds: int) -> dict:
    rng = random.Random(int(hashlib.sha256(seed.encode()).hexdigest()[:16],16))
    trials=[]; counts=Counter(); lessons=Counter()
    for i in range(max(20,min(rounds,500))):
        kind, reason=rng.choice(CASES); counts[kind]+=1
        mutation=rng.choice(["reduce_scope","change_representation","remove_side_effect","lower_rate","use_mock_target","split_observe_from_act","require_explicit_authority","replay_in_simulator"])
        accepted = mutation in {"remove_side_effect","use_mock_target","split_observe_from_act","replay_in_simulator","require_explicit_authority"}
        lesson = f"{kind}:{mutation}:{'accepted-in-sandbox' if accepted else 'still-blocked'}"
        lessons[lesson]+=1
        trials.append({"round":i+1,"case":kind,"mutation":mutation,"sandbox_result":"accepted" if accepted else "blocked","reason":reason})
    top=[x for x,_ in lessons.most_common(12)]
    focus=LENSES[int(hashlib.sha256((seed+'focus').encode()).hexdigest()[:8],16)%len(LENSES)]
    return {
      "schema":"constraint-learning/v1","generated_at":datetime.now(timezone.utc).isoformat(),
      "mode":"synthetic-sandbox-only","rounds":len(trials),"focus":focus,
      "boundary_counts":dict(counts),"top_lessons":top,
      "senju_context":{
        "research_focus":focus,
        "hypothesis":"Use rejection evidence to improve planning quality: separate observation from action, reduce implicit scope, prefer reversible simulations, and require explicit authority before side effects.",
        "execution_authority":"none",
        "raw_bypass_recipe_shared":False,
      },
      "rules":{"no_third_party_retry_after_refusal":True,"no_guard_bypass_on_real_targets":True,"no_secret_transfer":True},
      "sample_trials":trials[:40]
    }


def render(d:dict)->str:
    return "\n".join(["# Constraint Learning Loop","",f"- rounds: **{d['rounds']}**",f"- focus: **{d['focus']}**",f"- mode: `{d['mode']}`","","## Boundary pressure",*[f"- {k}: {v}" for k,v in sorted(d['boundary_counts'].items())],"","## Top lessons",*[f"- {x}" for x in d['top_lessons']],"","> Real refusals become research input; retries happen only in synthetic/owned sandboxes.",""])


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--seed',default=''); ap.add_argument('--rounds',type=int,default=240); ap.add_argument('--out',default='constraint-learning.json'); ap.add_argument('--report',default='constraint-learning.md'); a=ap.parse_args()
    seed=a.seed or datetime.now(timezone.utc).strftime('%Y%m%d%H')
    d=run(seed,a.rounds); Path(a.out).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n'); Path(a.report).write_text(render(d)); print(json.dumps({"rounds":d['rounds'],"focus":d['focus'],"lessons":len(d['top_lessons'])}))
if __name__=='__main__': main()
