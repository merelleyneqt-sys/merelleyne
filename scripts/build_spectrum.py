#!/usr/bin/env python3
"""Sound data for the fire visualizer: audio/<slug>.mp3 -> audio/<slug>.bin

24 log-spaced bands (low -> high), 20 frames per second, one byte each (~100 KB per track).
Precomputed so the site never routes audio through WebAudio (it misbehaves on iPhones).
Usage: .venv/bin/python scripts/build_spectrum.py [file.mp3 ...]   (no args: every mp3 without data)
"""
import pathlib, subprocess, sys
import numpy as np

AUDIO = pathlib.Path(__file__).resolve().parent.parent / "audio"
BANDS, FPS, SR, N = 24, 20, 22050, 2048


def build(mp3):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    a = np.pad(np.frombuffer(raw, dtype=np.float32), N // 2)
    frames = int((len(a) - N) / SR * FPS) + 1
    freqs = np.fft.rfftfreq(N, 1 / SR)
    edges = np.geomspace(40, 10500, BANDS + 1)
    cuts = [(np.searchsorted(freqs, lo), max(np.searchsorted(freqs, lo) + 1, np.searchsorted(freqs, hi)))
            for lo, hi in zip(edges, edges[1:])]
    out = np.empty((frames, BANDS))
    win = np.hanning(N)
    for f in range(frames):
        s = int(f * SR / FPS)
        p = np.abs(np.fft.rfft(a[s:s + N] * win)) ** 2
        out[f] = [p[lo:hi].mean() for lo, hi in cuts]
    db = 10 * np.log10(out + 1e-9)
    top = np.percentile(db, 98, axis=0)            # each band relative to its own loud moments
    x = np.clip((db - (top - 32)) / 32, 0, 1)
    mp3.with_suffix(".bin").write_bytes((x * 255).astype(np.uint8).tobytes())


if __name__ == "__main__":
    todo = [pathlib.Path(p) for p in sys.argv[1:]] or [p for p in sorted(AUDIO.glob("*.mp3")) if not p.with_suffix(".bin").exists()]
    for p in todo:
        build(p)
    print(f"{len(todo)} done")
