# White-Hat R&D → Portfolio Contract

## Role
The White-Hat R&D lane is an adversarial reviewer and evidence generator for defensive portfolio work.

It does not exist to maximize vulnerability counts. It exists to improve the quality of owned/authorized systems and produce reproducible Before/After evidence that can survive skeptical review.

The current-base integration also keeps GitHub checkout credentials non-persistent. Repository artifact writes, where needed, must use an explicit bounded API path rather than inheriting a hidden checkout credential.

## Two modes

### 1. Plan-only
Input: existing Security Scan / R&D findings.

Output:
- adversarial hypotheses;
- evidence needed to confirm/refute each hypothesis;
- bounded remediation candidates;
- next safe verification step.

Network access is disabled. This mode can analyze findings from a public/owned asset without actively probing that asset.

### 2. Local validation
Active requests are permitted only to loopback, private IP and link-local targets.

Hard boundaries:
- maximum 12 requests per run;
- GET / HEAD / OPTIONS / bounded POST only;
- no credential guessing;
- no authentication bypass attempts;
- no exploit payload execution;
- no destructive mutation;
- no path fuzzing;
- no phishing delivery.

## Portfolio conversion loop

```text
Existing Finding / Defensive Research
  -> White-Hat hypothesis
  -> Counter-hypothesis
  -> Plan-only evidence map
  -> owned source/config review or local validation
  -> bounded remediation
  -> same-condition rerun
  -> Before / After evidence
  -> human-inspectable Evidence Pack
  -> independent Portfolio Gate
```

## Promotion rules
White-Hat output alone is not a VERIFIED portfolio artifact.

A finding, attack hypothesis, code change, PR, AI statement or local score does not prove a vulnerability or a customer outcome by itself.

For a remediation case study to become VERIFIED, require:
- human-inspectable report;
- exact claimed condition;
- authorized scope;
- current behavioral/config evidence;
- explicit counterevidence / limitations;
- Before/After comparison using the same test condition;
- independent or reproducible rerun where practical;
- sanitized evidence suitable for customer review.

## R&D collaboration
- R&D supplies findings, product/security context and research priorities.
- White-Hat supplies adversarial hypotheses, falsification conditions and defensive proof gaps.
- Senju may improve bounded technical research quality only.
- Engineering implements the smallest useful remediation.
- White-Hat reruns the same evidence path.
- Portfolio Gate decides status independently.

## Output preference
Prefer portfolio outputs such as:
- Before/After remediation case study;
- customer-readable Control Evidence Pack;
- secure-default reference implementation;
- regression test demonstrating a fixed class of issue;
- local vulnerable-vs-hardened fixture with reproducible evidence;
- defensive architecture review with explicit proof and limitations.

Do not publish exploit instructions, credentials, sensitive customer data, or actionable third-party attack paths.
