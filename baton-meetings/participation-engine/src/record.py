#!/usr/bin/env python3
"""Music Japan local recording: WASAPI loopback + independent microphone WAV.

No network operations. No silent/background recording. Both explicit consent
and authorization are required. Never uses the user's unapproved device.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import sys
import threading
import time
import wave
from array import array
from datetime import datetime, timezone

VENDOR = Path(__file__).resolve().parent.parent / "vendor"
if VENDOR.is_dir():
    sys.path.insert(0, str(VENDOR))
STOP = threading.Event()
FRAMES = 1024

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def _pyaudio():
    try:
        import pyaudiowpatch as pa
    except ImportError as exc:
        raise RuntimeError("PYAUDIOWPATCH_NOT_INSTALLED: install pinned PyAudioWPatch to vendor directory") from exc
    return pa

def find_devices(pa, p, loopback_index=None, mic_index=None):
    api = p.get_host_api_info_by_type(pa.paWASAPI)
    speakers = p.get_device_info_by_index(api["defaultOutputDevice"])
    if loopback_index is not None:
        loopback = p.get_device_info_by_index(loopback_index)
        if not loopback.get("isLoopbackDevice"):
            raise RuntimeError("SELECTED_DEVICE_NOT_LOOPBACK")
    else:
        matches = list(p.get_loopback_device_info_generator())
        loopback = speakers if speakers.get("isLoopbackDevice") else None
        if loopback is None:
            loopback = next((d for d in matches if speakers["name"] in d["name"]), None)
        if loopback is None:
            raise RuntimeError("DEFAULT_LOOPBACK_NOT_FOUND")
    try:
        mic = p.get_device_info_by_index(mic_index if mic_index is not None else api["defaultInputDevice"])
        if not mic.get("maxInputChannels", 0):
            mic = None
    except (OSError, KeyError):
        mic = None
    return loopback, mic

def device_view(info):
    if not info:
        return None
    return {
        "index": int(info["index"]),
        "name": str(info["name"]),
        "sample_rate": int(info["defaultSampleRate"]),
        "input_channels": int(info["maxInputChannels"]),
        "loopback": bool(info.get("isLoopbackDevice")),
    }

def _rms(pcm):
    buf = array("h")
    buf.frombytes(pcm[:len(pcm) // 2 * 2])
    if not buf:
        return 0
    return int((sum(v * v for v in buf) / len(buf)) ** 0.5)

def _record_track(pa, p, device, output, name, ready_event, stats):
    if device is None:
        stats[name] = {"ok": False, "error": "DEVICE_NOT_FOUND"}
        ready_event.set()
        return
    rate = int(device["defaultSampleRate"])
    channels = min(2, int(device["maxInputChannels"]))
    if rate < 8000 or channels < 1:
        stats[name] = {"ok": False, "error": "UNSUPPORTED_DEVICE_FORMAT"}
        ready_event.set()
        return
    stream = None
    fp = None
    try:
        # Fail if any audio file exists. Never silently truncate earlier recordings.
        fd = os.open(str(output), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        fp = os.fdopen(fd, "wb")
        with wave.open(fp, "wb") as wav:
            wav.setnchannels(channels)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            stream = p.open(
                format=pa.paInt16, channels=channels, rate=rate,
                frames_per_buffer=FRAMES, input=True,
                input_device_index=int(device["index"]),
            )
            ready_event.set()
            start = time.monotonic()
            started_at = utc_now()
            total_frames = 0
            nonzero_blocks = 0
            max_rms = 0
            errors = 0
            while not STOP.is_set():
                try:
                    data = stream.read(FRAMES, exception_on_overflow=False)
                except (OSError, IOError):
                    errors += 1
                    if errors >= 4:
                        break
                    continue
                wav.writeframesraw(data)
                total_frames += len(data) // (2 * channels)
                level = _rms(data)
                if level > 32:
                    nonzero_blocks += 1
                max_rms = max(max_rms, level)
            stats[name] = {
                "ok": total_frames > 0 and errors < 4,
                "capture_started_at": started_at,
                "capture_finished_at": utc_now(),
                "sample_rate": rate,
                "channels": channels,
                "frames": total_frames,
                "duration_s": round(total_frames / rate, 3),
                "rms_peak": max_rms,
                "non_silent_blocks": nonzero_blocks,
                "errors": errors,
                "device_index": int(device["index"]),
            }
    except Exception as exc:
        # Device-specific diagnostics only; no ambient meeting transcript in logs.
        stats[name] = {"ok": False, "error": type(exc).__name__}
        ready_event.set()
    finally:
        if stream is not None:
            try:
                stream.stop_stream()
                stream.close()
            except Exception:
                pass
        if fp is not None and not fp.closed:
            fp.close()

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as infile:
        for chunk in iter(lambda: infile.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--probe", action="store_true")
    cli.add_argument("--output-dir", type=Path)
    cli.add_argument("--duration", type=float, default=6.0)
    cli.add_argument("--authorized", action="store_true")
    cli.add_argument("--consent", action="store_true")
    cli.add_argument("--microphone", action="store_true")
    cli.add_argument("--loopback-index", type=int)
    cli.add_argument("--mic-index", type=int)
    args = cli.parse_args()
    pa = _pyaudio()
    p = pa.PyAudio()
    try:
        loop, mic = find_devices(pa, p, args.loopback_index, args.mic_index)
        if args.probe:
            print(json.dumps({
                "status": "PROBED_NO_RECORDING",
                "loopback": device_view(loop),
                "microphone": device_view(mic),
                "recommended": "headphones to reduce echo; microphone recording is optional",
            }, ensure_ascii=False))
            return 0
        if args.authorized is not True or args.consent is not True:
            raise RuntimeError("RECORDING_REQUIRES_AUTHORIZED_CONSENT")
        if not args.output_dir:
            raise RuntimeError("OUTPUT_DIRECTORY_REQUIRED")
        if not (1 <= args.duration <= 28800):
            raise RuntimeError("DURATION_OUT_OF_RANGE")
        folder = args.output_dir.resolve()
        if folder.exists():
            raise RuntimeError("OUTPUT_DIRECTORY_ALREADY_EXISTS")
        folder.mkdir(parents=True, mode=0o700)
        signal.signal(signal.SIGINT, lambda *_: STOP.set())
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, lambda *_: STOP.set())
        stats = {}
        ready = [threading.Event(), threading.Event()]
        tracks = [("remote", loop, folder / "remote.wav", ready[0])]
        if args.microphone:
            tracks.append(("local_mic", mic, folder / "local_mic.wav", ready[1]))
        workers = []
        for name, device, target, ready_event in tracks:
            worker = threading.Thread(
                target=_record_track,
                args=(pa, p, device, target, name, ready_event, stats),
                daemon=True,
            )
            workers.append(worker)
            worker.start()
        for name, device, path, event in tracks:
            if not event.wait(timeout=10):
                STOP.set()
                raise RuntimeError("AUDIO_DEVICE_START_TIMEOUT")
        until = time.monotonic() + args.duration
        while time.monotonic() < until and not STOP.is_set():
            time.sleep(min(0.25, until - time.monotonic()))
        STOP.set()
        for worker in workers:
            worker.join(timeout=10)
        manifest = {
            "schema_version": 1,
            "capture": "windows-wasapi-loopback",
            "created_at": utc_now(),
            "consent_confirmed_by_operator": True,
            "recording_notice_required_for_participants": True,
            "tracks": [],
        }
        for name, device, path, _ in tracks:
            record = stats.get(name, {"ok": False, "error": "CAPTURE_DID_NOT_FINISH"})
            if path.exists() and path.stat().st_size >= 44:
                record["file"] = path.name
                record["bytes"] = path.stat().st_size
                record["sha256"] = sha256_file(path)
            manifest["tracks"].append({"source": name, **record})
        tmp = folder / "manifest.tmp"
        tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(folder / "manifest.json")
        summary = {
            "status": "CAPTURE_COMPLETED" if any(t.get("ok") for t in manifest["tracks"]) else "CAPTURE_FAILED",
            "manifest": str(folder / "manifest.json"),
            "tracks": [{"source": t["source"], "ok": t.get("ok"), "duration_s": t.get("duration_s"),
                        "non_silent_blocks": t.get("non_silent_blocks"), "error": t.get("error")}
                       for t in manifest["tracks"]],
        }
        print(json.dumps(summary))
        return 0 if summary["status"] == "CAPTURE_COMPLETED" else 3
    finally:
        p.terminate()

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"status": "ERROR", "code": str(error)[:150]}))
        sys.exit(2)
