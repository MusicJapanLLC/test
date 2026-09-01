from senju.authorization_issuance_bureau import (
    AuthorizationEvidence,
    build_authority_handoff,
    build_discovery_authorization_intake,
    issue_authorization,
    issue_from_discovery_key,
    recognize_discovery_key,
)


def test_canonical_host_can_be_issued():
    grant = issue_authorization(
        AuthorizationEvidence(
            host="kabeya-authorized-test-range.onrender.com",
            source="canonical",
            owner_control_verified=False,
            explicit_owner_authorization=False,
            requested_methods=("GET", "HEAD"),
        ),
        canonical_authorized_hosts={"kabeya-authorized-test-range.onrender.com"},
    )
    assert grant.authority_effect == "authorization_issued"
    assert grant.host == "kabeya-authorized-test-range.onrender.com"


def test_verified_owner_control_can_issue_new_host():
    grant = issue_authorization(
        AuthorizationEvidence(
            host="new-owner-test.example",
            source="trusted-verifier",
            owner_control_verified=True,
            explicit_owner_authorization=True,
            requested_methods=("GET", "POST", "PATCH"),
            credential_scope="synthetic_test",
        )
    )
    packet = build_authority_handoff(grant)
    assert packet["next_action"] == "materialize_same_or_narrower_authority"
    assert packet["requested_authority"]["host"] == "new-owner-test.example"
    assert "PATCH" in packet["requested_authority"]["methods"]


def test_discovery_is_recognized_as_review_key():
    key = recognize_discovery_key("Discovered.Example", proof_ref="finding-1")
    packet = build_discovery_authorization_intake(key, requested_methods=("GET", "HEAD"))
    assert key.host == "discovered.example"
    assert key.status == "authorization_review_unlocked"
    assert packet["discovery_recognized"] is True
    assert packet["authorization_review_unlocked"] is True
    assert packet["authority_effect"] == "none"
    assert packet["next_action"] == "verify_owner_control_then_issue"


def test_discovery_key_can_continue_after_owner_verification():
    key = recognize_discovery_key("new-owner-test.example")
    grant = issue_from_discovery_key(
        key,
        AuthorizationEvidence(
            host="new-owner-test.example",
            source="trusted-verifier-after-discovery",
            owner_control_verified=True,
            explicit_owner_authorization=True,
            requested_methods=("GET", "POST"),
            credential_scope="synthetic_test",
        ),
    )
    assert grant.authority_effect == "authorization_issued"
    assert grant.host == key.host


def test_discovery_key_cannot_borrow_verification_for_another_host():
    key = recognize_discovery_key("first.example")
    try:
        issue_from_discovery_key(
            key,
            AuthorizationEvidence(
                host="second.example",
                source="trusted-verifier",
                owner_control_verified=True,
                explicit_owner_authorization=True,
            ),
        )
    except PermissionError as exc:
        assert "host mismatch" in str(exc)
    else:
        raise AssertionError("discovery key must remain exact-host bound")


def test_discovery_only_cannot_self_authorize_unknown_host():
    try:
        issue_authorization(
            AuthorizationEvidence(
                host="unrelated.example",
                source="discovery",
                owner_control_verified=False,
                explicit_owner_authorization=False,
            )
        )
    except PermissionError as exc:
        assert "no verified owner-controlled authorization" in str(exc)
    else:
        raise AssertionError("unknown discovery-only host must not be issued")


def test_private_network_is_denied():
    try:
        issue_authorization(
            AuthorizationEvidence(
                host="owner.example",
                source="trusted-verifier",
                owner_control_verified=True,
                explicit_owner_authorization=True,
                private_network=True,
            )
        )
    except PermissionError as exc:
        assert "private-network" in str(exc)
    else:
        raise AssertionError("private network must remain out of scope")


def test_credential_scope_is_bounded():
    try:
        issue_authorization(
            AuthorizationEvidence(
                host="owner.example",
                source="trusted-verifier",
                owner_control_verified=True,
                explicit_owner_authorization=True,
                credential_scope="production_admin",
            )
        )
    except PermissionError as exc:
        assert "credential scope" in str(exc)
    else:
        raise AssertionError("unbounded credentials must not be issued")
