from senju.authorization_issuance_bureau import (
    AuthorizationEvidence,
    VerifiedControlAttestation,
    build_authority_handoff,
    build_discovery_authorization_intake,
    issue_authorization,
    issue_from_discovery_key,
    issue_from_verified_control_attestation,
    recognize_discovery_key,
    request_review_key,
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
    assert grant.authorization_basis == "canonical_authorized_host"


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
    assert grant.authorization_basis == "trusted_owner_control_verification"


def test_verified_render_control_can_issue_without_canonical_pre_registration():
    host = "the-world-authority-precedent-20260901.onrender.com"
    grant = issue_from_verified_control_attestation(
        VerifiedControlAttestation(
            provider="render",
            host=host,
            service_url=f"https://{host}",
            provider_control_verified=True,
            owner_authorized=True,
            proof_ref="render:srv-dab2m5jtqb8s73ejvlb0",
            allowed_methods=("GET", "HEAD", "OPTIONS"),
            credential_scope="none",
            private_network=False,
            workspace_id="tea-da883v49v7es73euaiug",
            service_id="srv-dab2m5jtqb8s73ejvlb0",
        )
    )
    packet = build_authority_handoff(grant)
    assert grant.authority_effect == "authorization_issued"
    assert grant.authorization_basis == "verified_cloud_control:render"
    assert packet["requested_authority"]["host"] == host
    assert packet["requested_authority"]["inheritance"] == "same_or_narrower"


def test_any_requester_can_obtain_non_authorizing_review_key():
    key = request_review_key(
        "Public-Candidate.Example",
        requester="external-researcher-42",
        source="external_input",
        proof_ref="finding-public-1",
    )
    packet = build_discovery_authorization_intake(key, requested_methods=("GET", "HEAD"))
    assert key.host == "public-candidate.example"
    assert key.requester == "external-researcher-42"
    assert key.acquisition_policy == "open"
    assert key.authority_effect == "none"
    assert packet["review_key_acquisition"] == "open"
    assert packet["authorization_review_unlocked"] is True


def test_discovery_is_recognized_as_review_key():
    key = recognize_discovery_key("Discovered.Example", proof_ref="finding-1")
    packet = build_discovery_authorization_intake(key, requested_methods=("GET", "HEAD"))
    assert key.host == "discovered.example"
    assert key.status == "authorization_review_unlocked"
    assert packet["authorization_review_unlocked"] is True
    assert packet["authority_effect"] == "none"
    assert packet["next_action"] == "verify_authorization_then_issue"


def test_review_key_can_continue_after_owner_verification():
    key = request_review_key("new-owner-test.example", requester="agent-7")
    grant = issue_from_discovery_key(
        key,
        AuthorizationEvidence(
            host="new-owner-test.example",
            source="trusted-verifier-after-review-key",
            owner_control_verified=True,
            explicit_owner_authorization=True,
            requested_methods=("GET", "POST"),
            credential_scope="synthetic_test",
        ),
    )
    assert grant.authority_effect == "authorization_issued"
    assert grant.host == key.host


def test_review_key_cannot_borrow_verification_for_another_host():
    key = request_review_key("first.example")
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
        raise AssertionError("review key must remain exact-host bound")


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
        assert "no verified authorization basis" in str(exc)
    else:
        raise AssertionError("unknown discovery-only host must not be issued")


def test_untrusted_control_provider_is_denied():
    try:
        issue_from_verified_control_attestation(
            VerifiedControlAttestation(
                provider="unknown-cloud",
                host="owner.example",
                service_url="https://owner.example",
                provider_control_verified=True,
                owner_authorized=True,
                proof_ref="proof-1",
            )
        )
    except PermissionError as exc:
        assert "untrusted control provider" in str(exc)
    else:
        raise AssertionError("untrusted provider must not mint authorization")


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
