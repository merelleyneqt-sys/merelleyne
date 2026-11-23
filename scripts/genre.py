#!/usr/bin/env python3
"""Guess the genre of audio files by sound (CLAP, runs locally, sends nothing anywhere).

The model and its libraries live on the external SSD:
  /Volumes/ExtSSDEvo_1TB/Developer/merelleyne-genre/{venv,model}
Usage: <that folder>/venv/bin/python scripts/genre.py audio/*.mp3
Prints one JSON line per file; not sure -> "Alternative".
"""
import json, pathlib, subprocess, sys
import numpy as np, torch
from transformers import ClapModel, ClapProcessor

# laion/clap-htsat-unfused (NOT larger_clap_music: that checkpoint has an untrained text part). transformers 4.46.3
MODEL = pathlib.Path("/Volumes/ExtSSDEvo_1TB/Developer/merelleyne-genre/model")
GENRES = {
    "Metal": "heavy metal", "Metalcore": "metalcore", "Rock": "rock", "Alternative": "alternative rock",
    "Trap": "trap", "Hip-Hop": "boom bap hip hop", "Trap Metal": "trap metal", "Phonk": "phonk",
    "Electronic": "electronic dance", "Drum & Bass": "drum and bass", "Synthwave": "synthwave",
    "Ambient": "ambient", "Cinematic": "cinematic orchestral", "Pop": "pop", "R&B": "r&b", "Lo-Fi": "lo-fi",
}
TEMPLATES = ["{} music", "this is a {} song", "an instrumental {} track"]
MIN_PROB, MIN_LEAD, SR = 0.35, 0.12, 48000   # otherwise: not sure

names = list(GENRES)
model = ClapModel.from_pretrained(MODEL, local_files_only=True).eval()
proc = ClapProcessor.from_pretrained(MODEL, local_files_only=True)


def vec(out):   # older transformers return a tensor, newer an output object
    v = out if torch.is_tensor(out) else out.pooler_output
    return v / v.norm(dim=-1, keepdim=True)


with torch.no_grad():
    tv = []
    for g in names:
        x = proc.tokenizer([t.format(GENRES[g]) for t in TEMPLATES], padding=True, return_tensors="pt")
        v = vec(model.get_text_features(**x)).mean(0)
        tv.append(v / v.norm())
    tv = torch.stack(tv)
    scale = model.logit_scale_a.exp()
    for path in sys.argv[1:]:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                             capture_output=True, check=True).stdout
        a = np.frombuffer(raw, dtype=np.float32)
        n = 10 * SR
        starts = np.linspace(0.08 * len(a), max(0.08 * len(a), 0.92 * len(a) - n), 10).astype(int)
        x = proc.feature_extractor([a[s:s + n] for s in starts], sampling_rate=SR, return_tensors="pt")
        p = (scale * vec(model.get_audio_features(**x)) @ tv.T).softmax(-1).mean(0)
        top = p.argsort(descending=True)[:3].tolist()
        sure = p[top[0]] >= MIN_PROB and p[top[0]] - p[top[1]] >= MIN_LEAD
        heavy = p[names.index("Metal")] + p[names.index("Metalcore")] >= 0.6   # clearly metal, only the subgenre is unclear
        genre = names[top[0]] if sure else "Metal" if heavy else "Alternative"
        print(json.dumps({"file": pathlib.Path(path).name, "genre": genre,
                          "top": {names[i]: round(float(p[i]), 2) for i in top}}, ensure_ascii=False), flush=True)
