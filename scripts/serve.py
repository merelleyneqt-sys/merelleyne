#!/usr/bin/env python3
"""Local server: previews the site AND runs the admin (only on this Mac).

Usage: python3 scripts/serve.py [port]      (or double-click Admin.command)
  Site:  http://localhost:8765/
  Admin: http://localhost:8765/admin/

Binds to 127.0.0.1 only, so nobody else on the network or internet can reach the admin.
The public (hosted) site is plain static files: it has no upload API at all.
"""
import http.server, json, os, re, shutil, subprocess, sys, tempfile, pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
TRACKS_JSON = ROOT / "tracks.json"
AUDIO_EXT = {".mp3", ".wav", ".aif", ".aiff", ".flac", ".m4a"}
MAX_UPLOAD = 1024 * 1024 * 1024  # 1 GB


# ---------------- helpers ----------------
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "track"


def guess_from_name(name):
    """'Merelleyne - Ashfall (Gm_135BPM).wav' -> ('Ashfall', 'Gm', 135)"""
    stem = pathlib.Path(name).stem
    key, bpm = "", None
    m = re.search(r"\(\s*([A-G][#b♯♭]?)\s*(maj|min|m)?[\s_-]*(\d{2,3})\s*bpm\s*\)", stem, re.I)
    if m:
        key = m[1].upper().replace("♯", "#").replace("♭", "b") + ("m" if (m[2] or "").lower() in ("m", "min") else "")
        bpm = int(m[3])
    else:
        m = re.search(r"(\d{2,3})\s*bpm", stem, re.I) or re.search(r"[_\s-](\d{2,3})$", stem)
        if m:
            bpm = int(m[1])
    title = re.sub(r"\(.*?\)", "", stem)
    title = re.sub(r"[_\s-]\d{2,3}$", "", title)
    title = re.sub(r"^\s*\d+[.)]\s*", "", title)            # "1. Name"
    title = re.sub(r"^\s*merelleyne\s*-\s*", "", title, flags=re.I)
    title = re.sub(r"\s+", " ", title.replace("_", " ")).strip(" -")
    return title or stem, key, bpm


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out))


def read_tracks():
    return json.loads(TRACKS_JSON.read_text())


def write_tracks(tracks):
    if not isinstance(tracks, list):
        raise ValueError("Expected a list of tracks")
    clean = []
    for t in tracks:
        f = pathlib.Path(str(t.get("file", ""))).name
        if not f or not (AUDIO / f).is_file():
            continue
        bpm = t.get("bpm")
        try:
            bpm = int(bpm) if bpm is not None and str(bpm).strip() else None
        except ValueError:
            bpm = None
        clean.append({"title": str(t.get("title", "")).strip() or f, "key": str(t.get("key", "")).strip(),
                      "bpm": bpm,
                      "genre": str(t.get("genre") or "").strip(), "file": f})
    TRACKS_JSON.write_text("[\n" + ",\n".join("  " + json.dumps(t, ensure_ascii=False) for t in clean) + "\n]\n")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_tracks.py")], check=True, capture_output=True)
    # Saving never deletes audio files; unused ones are cleaned up only on Publish.
    return clean


def remove_unused_audio():
    """Delete mp3s no track uses. Only called on Publish; files stay recoverable from git history."""
    used = {t["file"] for t in read_tracks()}
    for p in AUDIO.glob("*.mp3"):
        if p.name not in used:
            p.unlink()


def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()


# ---------------- server ----------------
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---- JSON helpers ----
    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def local_only(self):
        # reject requests from other origins (a random website can't drive the admin via your browser)
        origin = self.headers.get("Origin")
        if origin and urllib.parse.urlparse(origin).hostname not in ("localhost", "127.0.0.1"):
            self.send_json({"error": "forbidden"}, 403)
            return False
        return True

    # ---- routes ----
    def do_GET(self):
        if self.path.split("?")[0] == "/api/tracks":
            tracks = read_tracks()
            for t in tracks:
                p = AUDIO / t["file"]
                t["duration"] = duration(p) if p.is_file() else 0
            return self.send_json(tracks)
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if not self.local_only():
            return
        try:
            if path == "/api/upload":
                return self.upload()
            if path == "/api/tracks":
                n = int(self.headers.get("Content-Length", 0))
                tracks = write_tracks(json.loads(self.rfile.read(n) or b"[]"))
                return self.send_json(tracks)
            if path == "/api/publish":
                return self.publish()
            self.send_json({"error": "not found"}, 404)
        except Exception as e:  # report to the admin page instead of a silent failure
            self.send_json({"error": str(e)}, 500)

    def upload(self):
        name = urllib.parse.unquote(self.headers.get("X-Filename", "upload"))
        ext = pathlib.Path(name).suffix.lower()
        n = int(self.headers.get("Content-Length", 0))
        if ext not in AUDIO_EXT:
            return self.send_json({"error": f"Unsupported file type: {ext or '?'}"}, 400)
        if not 0 < n <= MAX_UPLOAD:
            return self.send_json({"error": "File is empty or too large"}, 400)

        title, key, bpm = guess_from_name(name)
        slug = slugify(title)
        out = AUDIO / f"{slug}.mp3"
        i = 2
        while out.exists():
            out = AUDIO / f"{slug}-{i}.mp3"; i += 1

        with tempfile.TemporaryDirectory() as tmp:
            src = pathlib.Path(tmp) / ("in" + ext)
            with open(src, "wb") as f:
                left = n
                while left > 0:
                    buf = self.rfile.read(min(1 << 20, left))
                    if not buf:
                        break
                    f.write(buf); left -= len(buf)
            r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:a", "-ac", "2",
                                "-b:a", "160k", "-map_metadata", "-1", str(out)], capture_output=True, text=True)
            if r.returncode != 0:
                out.unlink(missing_ok=True)
                return self.send_json({"error": "Could not convert audio: " + r.stderr.strip()[-300:]}, 400)

        self.send_json({"title": title, "key": key, "bpm": bpm, "file": out.name, "duration": duration(out)})

    def publish(self):
        remove_unused_audio()
        for p in ("audio", "tracks.json", "tracks.js", "cover.jpg"):
            if (ROOT / p).exists():
                git("add", "-A", p)
        code, out = git("diff", "--cached", "--quiet")
        if code == 0:
            msg = "Nothing new to publish."
        else:
            code, out = git("commit", "-m", "Update tracks (admin)")
            if code != 0:
                return self.send_json({"error": out}, 500)
            msg = "Saved."
        _, remotes = git("remote")
        if remotes.strip():
            code, out = git("push")
            if code != 0:
                return self.send_json({"error": "Push failed: " + out[-300:]}, 500)
            r = subprocess.run(["bash", str(ROOT / "scripts" / "deploy.sh")], cwd=ROOT, capture_output=True, text=True)
            if r.returncode != 0:
                return self.send_json({"error": "Deploy failed: " + (r.stdout + r.stderr)[-300:]}, 500)
            msg += " Site is updating — live in about a minute."
        else:
            msg += " (Not online yet — hosting isn't connected.)"
        self.send_json({"message": msg})

    # ---- Range support (audio seeking; Safari needs it) ----
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        m = rng and re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
        if not m or not os.path.isfile(path):
            self._remaining = None
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m[1]) if m[1] else max(0, size - int(m[2] or 0))
        end = min(int(m[2]) if m[1] and m[2] else size - 1, size - 1)
        if start > end:
            self.send_error(416)
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, src, dst):
        left = getattr(self, "_remaining", None)
        if left is None:
            return shutil.copyfileobj(src, dst)
        while left > 0:
            buf = src.read(min(65536, left))
            if not buf:
                break
            dst.write(buf)
            left -= len(buf)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"Site:  http://localhost:{port}/\nAdmin: http://localhost:{port}/admin/")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
