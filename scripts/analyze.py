#!/usr/bin/env python3
"""Guess BPM and key of an audio file. Prints JSON: {"bpm": 135, "key": "Gm"}

Runs inside .venv (essentia); create it once with:
  uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python essentia
Accuracy on our own labelled tracks (2026-11): BPM 15/18 exact, key 9/11.
"""
import json, sys
import essentia
essentia.log.infoActive = False
essentia.log.warningActive = False
import essentia.standard as es

audio = es.MonoLoader(filename=sys.argv[1], sampleRate=44100)()
bpm = es.RhythmExtractor2013(method="multifeature")(audio)[0]
key, scale, _ = es.KeyExtractor(profileType="bgate")(audio)
print(json.dumps({"bpm": round(float(bpm)) or None, "key": key + ("m" if scale == "minor" else "")}))
