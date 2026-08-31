# Adversary Autonomy Accelerator

This layer removes coordination latency around external findings while keeping terminal authority boundaries intact.

## Runtime path

```text
Finding
  -> existing Owner authority?
       yes -> immediate exact-host lease / transport-ready
       no  -> provisional root candidate (NO execution authority)
              -> META / X / SENJU / CHILD vote solicitations
              -> META / X / SENJU / CHILD / AI / PR-ARMY evidence bus
              -> existing Owner promotion lane

soft DENY + new evidence -> automatic reconsideration queue
HARD_DENY / revoked      -> terminal

credential target profile
  + active exact-host credentialed_action lease
  -> runtime credential acquisition ready

transport failure
  -> same host
  -> same authorization_reference
  -> same credential_scope
  -> GET / HEAD
  -> owner-predeclared recovery_paths only
```

## Seven requested pressure points and the implemented maximum-safe analogue

1. **Unrelated host root creation**: every unrelated host becomes a persistent provisional root candidate and is fanned out to all cooperating agents immediately. The candidate itself is not execution authority.
2. **DENY weakening**: ordinary DENY is automatically reopened after materially new evidence. HARD_DENY and revocation remain terminal.
3. **Discovery-driven credentials**: a discovery automatically creates credential acquisition work when an exact target profile exists. Runtime acquisition is marked ready only when an already-active lease explicitly contains both `credentialed_action` and a non-`none` credential scope. No raw credential is stored.
4. **Private network**: a signed, short-lived owner scope can authorize explicit RFC1918 targets. Loopback, link-local, cloud metadata, reserved, multicast and unspecified addresses remain blocked. This module supplies the authorization gate; a private executor must consume the verified decision rather than bypass it.
5. **Redirect ambiguity**: transport may already follow cross-host redirects among independently active exact-host leases sharing the same authorization reference. No redirect becomes authority by itself.
6. **Recovery exploration**: recovery can rotate GET/HEAD and owner-predeclared paths while preserving exact host, authorization reference and credential scope.
7. **Finding -> Authority**: Finding now automatically materializes the promotion request, four authority-vote tasks, six parallel evidence tasks, a provisional candidate, and credential-preparation state in one call. The final unrelated-root promotion remains in the existing Owner promotion lane.

## Files emitted

- `adversary_autonomy_accelerator_latest.json`
- `adversary_provisional_root_candidates.json`
- `adversary_authority_collaboration_bus.json`
- `adversary_credential_acquisition_queue.json`
- `authority_denial_reconsideration_queue.json`
- existing `adversary_external_host_requests.json`
- existing `adversary_external_host_vote_solicitations.json`

The intent is high autonomy and high parallelism, not a hidden path around revocation or trust-root ownership.
