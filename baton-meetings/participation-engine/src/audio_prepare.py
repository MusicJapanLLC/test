#!/usr/bin/env python3
"""Convert local WASAPI recordings into bounded mono 16 kHz diarization chunks.

Requires only CPython 3.12 standard library. Uses audioop only for format
conversion, not speaker inference. Keeps original WAVs intact.
"""
from __future__ import annotations
import argparse
import audioop
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import wave

TARGET_RATE = 16000
MAX_CHUNK_S = 180
OVERLAP_S = 0.6

def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as fd:
        for block in iter(lambda: fd.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def timestamp(raw):
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)

def prepare(manifest_path: Path, max_seconds=MAX_CHUNK_S):
    if not (10 <= max_seconds <= MAX_CHUNK_S):
        raise ValueError("INVALID_CHUNK_SECONDS")
    manifest_path = manifest_path.resolve(strict=True)
    parent = manifest_path.parent
    data = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    if data.get("schema_version") != 1 or data.get("consent_confirmed_by_operator") is not True:
        raise ValueError("CAPTURE_CONSENT_EVIDENCE_REQUIRED")
    tracks = [track for track in data.get("tracks", []) if track.get("ok") is True]
    if not tracks:
        raise ValueError("NO_USABLE_RECORDING_TRACKS")
    starts = [timestamp(t["capture_started_at"]) for t in tracks]
    earliest = min(starts)
    out = parent / "prepared"
    out.mkdir(exist_ok=True)
    results = []
    warnings = []
    for track in tracks:
        source = track.get("source")
        name = track.get("file")
        if source not in {"remote", "local_mic"} or not isinstance(name, str) or Path(name).name != name:
            raise ValueError("INVALID_TRACK_IDENTITY")
        filepath = (parent / name).resolve(strict=True)
        if filepath.parent != parent:
            raise ValueError("TRACK_PATH_OUTSIDE_SESSION")
        if digest(filepath) != track.get("sha256"):
            raise ValueError("TRACK_AUDIO_HASH_MISMATCH")
        if track.get("non_silent_blocks", 0) == 0:
            warnings.append(f"{source}: recording may contain only silence")
        offset_s = (timestamp(track["capture_started_at"]) - earliest).total_seconds()
        with wave.open(str(filepath), "rb") as reader:
            if reader.getsampwidth() != 2 or reader.getcomptype() != "NONE":
                raise ValueError("ONLY_PCM16_WAV_SUPPORTED")
            nch = reader.getnchannels()
            rate = reader.getframerate()
            count = reader.getnframes()
            if nch not in (1, 2) or not (8000 <= rate <= 192000) or count == 0:
                raise ValueError("UNSUPPORTED_AUDIO_STREAM")
            seg_idx = 0
            while True:
                start_s = max(0, seg_idx * max_seconds - (OVERLAP_S if seg_idx > 0 else 0))
                if start_s * rate >= count:
                    break
                end_s = min((seg_idx + 1) * max_seconds, count / rate)
                frames = max(1, round((end_s - start_s) * rate))
                reader.setpos(min(round(start_s * rate), count - 1))
                buf = reader.readframes(frames)
                if nch == 2:
                    buf = audioop.tomono(buf, 2, 0.5, 0.5)
                if rate != TARGET_RATE:
                    buf, _ = audioop.ratecv(buf, 2, 1, rate, TARGET_RATE, None)
                newname = f"{source}-{seg_idx:05d}.wav"
                final = out / newname
                if final.exists():
                    # Idempotence: preserve exact output, but only if bytes match
                    oldhash = digest(final)
                    raise ValueError(f"PREPARED_FILE_ALREADY_EXISTS_{source}_{seg_idx}_{oldhash[:6]}")
                fd = os.open(str(final), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "wb") as fp:
                    with wave.open(fp, "wb") as dst:
                        dst.setsampwidth(2)
                        dst.setnchannels(1)
                        dst.setframerate(TARGET_RATE)
                        dst.writeframes(buf)
                if final.stat().st_size > 24_000_000:
                    raise ValueError("PREPARED_CHUNK_EXCEEDS_API_CAP")
                results.append({
                    "chunk_id": f"{source}-{seg_idx:05d}",
                    "source": source,
                    "file": newname,
                    "sha256": digest(final),
                    "bytes": final.stat().st_size,
                    "absolute_start_s": round(offset_s + start_s, 3),
                    "absolute_end_s": round(offset_s + end_s, 3),
                    "sample_rate": TARGET_RATE,
                    "channels": 1,
                    "speaker_scope": "per_chunk_unless_verified",
                })
                seg_idx += 1
    result = {
        "schema_version": 1,
        "source_capture_manifest_sha256": digest(manifest_path),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "prepared_directory": "prepared",
        "chunks": results,
        "warnings": warnings,
        "speaker_labels_are_not_real_identities": True,
    }
    temp = parent / "prepared-manifest.tmp"
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(parent / "prepared-manifest.json")
    return {"status": "PREPARED", "chunks": len(results), "warnings": warnings, "prepared_manifest": str(parent / "prepared-manifest.json")}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--chunk-seconds", type=int, default=MAX_CHUNK_S)
    args = p.parse_args()
    try:
        print(json.dumps(prepare(args.manifest, args.chunk_seconds), ensure_ascii=False))
    except (ValueError, OSError, KeyError, wave.Error) as error:
        print(json.dumps({"status":"ERROR","code":str(error)[:120]}))
        raise SystemExit(2)

if __name__ == "__main__":
    main()
