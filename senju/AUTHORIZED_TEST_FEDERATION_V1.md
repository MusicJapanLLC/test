# AUTHORIZED TEST FEDERATION V1

Registry: `/AUTHORIZED_TEST_TARGETS.json`
Runtime scope: `/senju/config/authorized-test-federation.json`
Broadcast: `/senju/config/authorized-test-federation-broadcast.json`
Remote delegation trust anchors: `/senju/config/remote-authority-trust-anchors.json`

Senju should actively discover and security-test VERIFIED members of `the-world-security-test-federation-v1` at normal authorized rates. Same-host URLs inherit recursively. External links inherit only after member verification through the registry, a matching destination `/.well-known/security-test-federation.json`, or a cryptographically verified remote authority delegation. Non-member, unsigned, and unverifiable hosts remain out of scope.

## Production remote authority delegation rule

An already owner-authorized Host A may generate read-only production Authority for an exact external Host B when A provides a valid RS256-signed federation member declaration, `.well-known` manifest, remote policy, remote declaration, or linked registry entry naming B.

A signed A -> B delegation may include B's RSA/JWK public delegation key. When that key is validly delegated, B becomes eligible to sign a further B -> C delegation. The same rule repeats recursively:

```text
Owner-authorized A + pinned A public key
  -> A signs B + optional B public key
  -> B Authorized
  -> B signs C + optional C public key
  -> C Authorized
  -> ...
```

There is no fixed trust-chain depth limit. Each hop preserves lineage/provenance and is re-verifiable from the signed declaration chain.

Delegated production Authority is deliberately monotonic: HTTPS only, GET/HEAD only, credential scope `none`, read-only effect, and no DELETE. A remote assertion without a valid signature or independent owner basis is evidence/candidate data only and cannot create a new trust root.

The signature covers canonical UTF-8 JSON of the complete declaration object with the `signature` field removed, serialized with sorted keys and compact separators. Signature object format:

```json
{
  "signature": {
    "alg": "RS256",
    "value": "<base64url signature>"
  }
}
```

Child delegation keys may be included under `delegation_keys`:

```json
{
  "source_host": "a.example.com",
  "source_kind": "well_known_manifest",
  "authorized_hosts": ["b.example.net"],
  "delegation_keys": {
    "b.example.net": {
      "kty": "RSA",
      "alg": "RS256",
      "n": "<base64url modulus>",
      "e": "AQAB"
    }
  },
  "signature": {
    "alg": "RS256",
    "value": "<base64url signature>"
  }
}
```
