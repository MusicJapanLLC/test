# META / X / SENJU Delegated Root Factory

Production semantics:

```text
Owner standing authority
  -> live META/X/SENJU council receipt
  -> META authority
  -> X authority
  -> SENJU delegated root
  -> persistent AuthorityRegistry
  -> recursive descendant authority minting
```

The final `SENJU` profile is a real `AuthorityProfile`, has its own profile ID, is
persisted, converts to an `ExternalAuthorityScope`, and may act as the parent of later
Authority mint operations while delegation depth remains.

The Owner standing authorization remains the ceiling.  The factory does not create an
unrelated Internet root, add credential scope, activate private-network access, or
widen methods/hosts beyond that standing authority.
