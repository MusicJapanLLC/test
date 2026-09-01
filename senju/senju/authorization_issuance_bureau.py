"""Package compatibility bridge for the Authorization Issuance Bureau.

The implementation historically lives at ``senju/authorization_issuance_bureau.py``
while the installable ``senju`` package lives in ``senju/senju``.  Re-export the
bounded bureau API here so package modules can import it consistently without
changing the authorization semantics.
"""

from authorization_issuance_bureau import (  # noqa: F401
    AuthorizationEvidence,
    DiscoveryAuthorizationKey,
    IssuedAuthorization,
    VerifiedControlAttestation,
    build_authority_handoff,
    build_discovery_authorization_intake,
    issue_authorization,
    issue_from_discovery_key,
    issue_from_verified_control_attestation,
    recognize_discovery_key,
    request_review_key,
)

__all__ = [
    "AuthorizationEvidence",
    "DiscoveryAuthorizationKey",
    "IssuedAuthorization",
    "VerifiedControlAttestation",
    "build_authority_handoff",
    "build_discovery_authorization_intake",
    "issue_authorization",
    "issue_from_discovery_key",
    "issue_from_verified_control_attestation",
    "recognize_discovery_key",
    "request_review_key",
]
