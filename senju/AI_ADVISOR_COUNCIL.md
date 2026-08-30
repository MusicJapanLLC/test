# Senju AI Advisor Council

Senju treats two deployed AI systems as active engineering/research peers:

1. **Standment Personal AI Core**  
   `https://standment-personal-ai-core-se1c3z.v2.appdeploy.ai/`
2. **AI FOUNDRY Forge v2**  
   `https://test-git-feat-ai-foundry-forge-v2-musicjapanllc.vercel.app/`

The runtime endpoints used by the council are:

- Personal AI Core: `POST /api/chat`
- AI FOUNDRY: `POST /api/foundry` with `action: "chat"`

## Standing owner rules

These rules are intentional:

- **Senju may ask these AIs any question.**
- There is no topic/category filter in `senju.advisor_council`.
- **Answers may be implemented.**
- An answer is captured as an implementation candidate and handed to the existing engineering lanes.
- Advisor text is not executed directly as shell/code. It is evidence/input for Senju, Jules, FOUNDRY, or another existing engineering executor.
- The executor inherits the repository/runtime authority that already exists. An advisor answer does not silently create new network, credential, deployment, or target authority.
- Code changes require tests/evidence before success is claimed.

This distinction keeps the advisory surface broad while keeping execution reproducible.

## Flow

```text
QUESTION (any topic)
    |
    +--> Standment Personal AI Core ----+
    |                                   |
    +--> AI FOUNDRY Forge v2 -----------+--> evidence bundle
                                            |
                                            v
                              implementation_candidate=true
                                            |
                                            v
                              existing Jules / Senju /
                              FOUNDRY engineering lane
                                            |
                                            v
                                  inspect current repo
                                  detect overlap/stale work
                                  implement if useful
                                  test + evidence
                                  focused PR
```

## Why both AIs

Personal AI Core is useful as a memory-rich general research/security peer.
AI FOUNDRY is useful as an implementation-first engineering peer.

The council keeps both answers rather than forcing one model to be the sole authority. The next engineering agent can compare them against current repository evidence.

## CLI

From the `senju/` directory:

```bash
python -m senju.advisor_council \
  --question "What should Senju improve next?" \
  --context "Current focus: agent collaboration and development throughput"
```

Output is written under:

```text
senju/reports/advisor-council/
  latest.json
  advisor-YYYYMMDDTHHMMSSZ.json
```

Each bundle includes:

- exact question
- context/base SHA
- provider endpoint
- answer
- provider acknowledgement/status
- response SHA-256
- implementation policy
- recommended next agent

## Personal AI workspace

Personal AI Core requires a 32-hex workspace identifier.

By default Senju derives a stable non-secret workspace namespace from
`senju-advisor-council`.

To use another workspace:

```bash
export SENJU_PERSONAL_AI_WORKSPACE=<32 lowercase hex chars>
```

This value is an application workspace namespace, not a credential.

## Scheduled active use

`.github/workflows/senju-ai-advisor-council.yml` runs every six hours and can also
be started manually with any question.

Each cycle:

1. runs the council tests;
2. asks both AIs;
3. uploads the raw evidence bundle;
4. if there is no existing open advisor implementation task, creates one
   `[Jules]` issue containing the latest recommendations.

The repository's Jules issue router then turns that issue into a real Jules
engineering session. This is deliberately bounded to one open advisor
implementation issue at a time so active use does not become PR/Issue spam.

Manual workflow runs can disable creation of the implementation issue and use
the council for research-only questioning.
