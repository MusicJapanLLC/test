from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def _load_module():
    path = Path(__file__).resolve().parents[1] / "the-world-strong-new-game" / "inherit_credential_bindings.py"
    spec = importlib.util.spec_from_file_location("inherit_credential_bindings", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_inherits_binding_reference_into_every_world_without_secret_value(tmp_path: Path) -> None:
    module = _load_module()
    state = tmp_path / "state"
    generation = state / "generation-000001"
    _write(state / "latest.json", {"checkpoint": "generation-000001/checkpoint.json"})
    _write(
        generation / "checkpoint.json",
        {
            "generation": 1,
            "world_count": 4,
            "invariants": {},
            "world_manifest_digests": [],
        },
    )
    for world in range(1, 5):
        _write(generation / f"world-{world}" / "manifest.json", {"world": world, "inheritance": {}})

    source = tmp_path / "bindings.json"
    _write(
        source,
        {
            "bindings": [
                {
                    "id": "synthetic-bearer",
                    "host": "owned.example",
                    "owner_authorization": "explicit",
                    "credential_scope": "synthetic_test_bearer",
                    "secret_env": "OWNED_TEST_BEARER_TOKEN",
                    "header": "Authorization",
                    "prefix": "Bearer ",
                    "methods": ["POST", "PUT", "PATCH"],
                    "synthetic_only": True,
                }
            ]
        },
    )

    result = module.inherit(state, source)
    assert result["binding_count"] == 1
    assert result["cross_world_binding_inheritance"] is True
    assert result["secret_values_serialized"] is False

    for world in range(1, 5):
        manifest = json.loads((generation / f"world-{world}" / "manifest.json").read_text())
        inherited = manifest["credential_binding_inheritance"]
        assert inherited["binding_count"] == 1
        binding = inherited["bindings"][0]
        assert binding["secret_env"] == "OWNED_TEST_BEARER_TOKEN"
        assert binding["secret_value_inherited"] is False
        assert "secret_value" not in binding
        assert manifest["inheritance"]["credential_bindings"] is True
        assert manifest["inheritance"]["credential_values"] is False
