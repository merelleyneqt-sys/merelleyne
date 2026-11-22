(() => {
  const tracks = window.TRACKS || [];
  const $ = id => document.getElementById(id);
  const audio = $("audio"), list = $("list"), sub = $("sub");
  const subDefault = sub.innerHTML;
  const fill = $("fill"), track = $("track"), tCur = $("tCur"), tDur = $("tDur");
  const shuffleBtn = $("shuffle"), repeatBtn = $("repeat");
  let cur = -1, shuffle = false, repeat = "off", dragging = false;

  const fmt = s => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dur = () => audio.duration || (cur >= 0 ? tracks[cur].duration : 0);

  const playIcon = '<svg viewBox="0 0 24 24"><path class="i-play" d="M8 5v14l11-7z"/><path class="i-pause" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  list.innerHTML = tracks.map((t, i) => {
    const meta = [t.key, t.bpm && `${t.bpm} BPM`, fmt(t.duration)].filter(Boolean).join(" · ");
    return `
      <li class="row" data-i="${i}">
        <span class="idx">${pad(i + 1)}</span>
        <div class="info">
          <div class="title">${esc(t.title)}<span class="arrow">↘</span></div>
          <div class="meta">${esc(meta)}</div>
        </div>
        <div class="btns">
          <button class="play" aria-label="Play ${esc(t.title)}">${playIcon}</button>
          <a class="buy" href="${esc(t.buy || "#")}" aria-label="Buy ${esc(t.title)}">$${t.price}</a>
        </div>
      </li>`;
  }).join("");

  const rows = [...list.querySelectorAll(".row")];

  function load(i) {
    if (cur >= 0) rows[cur].classList.remove("active", "on");
    cur = i;
    audio.src = "audio/" + tracks[i].file;
    rows[i].classList.add("active");
    document.body.classList.add("has-player");
    paint();
  }

  function play(i) { load(i); audio.play(); }

  function toggle(i) {
    if (i !== cur) return play(i);
    audio.paused ? audio.play() : audio.pause();
  }

  function nextIndex(step) {
    if (shuffle && tracks.length > 1) {
      let n; do { n = Math.floor(Math.random() * tracks.length); } while (n === cur);
      return n;
    }
    const n = cur + step;
    if (n < 0 || n >= tracks.length) return repeat === "all" ? (n + tracks.length) % tracks.length : -1;
    return n;
  }

  function paint(frac) {
    const d = dur();
    if (frac == null) frac = d ? audio.currentTime / d : 0;
    fill.style.width = (frac * 100) + "%";
    tCur.textContent = fmt(frac * d);
    tDur.textContent = fmt(d);
  }

  function status() {
    if (cur < 0) { sub.innerHTML = subDefault; return; }
    sub.innerHTML = `<span class="red">${audio.paused ? "Paused" : "Now"}</span><span class="now">${esc(tracks[cur].title)}</span>`;
  }

  /* ---- list ---- */
  list.addEventListener("click", e => {
    const row = e.target.closest(".row");
    if (!row || e.target.closest(".buy")) return;
    if (e.target.closest(".play, .info, .idx")) toggle(+row.dataset.i);
  });

  /* ---- controls ---- */
  $("cover").addEventListener("click", () => toggle(cur < 0 ? 0 : cur));
  $("toggle").addEventListener("click", () => toggle(cur < 0 ? 0 : cur));
  $("next").addEventListener("click", () => { const n = nextIndex(1); if (n >= 0) play(n); });
  $("prev").addEventListener("click", () => {
    if (audio.currentTime > 3 || cur <= 0 && !shuffle && repeat !== "all") { audio.currentTime = 0; return; }
    const n = nextIndex(-1); if (n >= 0) play(n);
  });
  shuffleBtn.addEventListener("click", () => {
    shuffle = !shuffle;
    shuffleBtn.setAttribute("aria-pressed", shuffle);
  });
  repeatBtn.addEventListener("click", () => {
    repeat = { off: "all", all: "one", one: "off" }[repeat];
    repeatBtn.dataset.mode = repeat;
    repeatBtn.setAttribute("aria-label", "Repeat: " + repeat);
  });

  /* ---- seek bar (click or drag) ---- */
  const fracAt = e => {
    const r = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  track.addEventListener("pointerdown", e => {
    if (cur < 0) return;
    dragging = true;
    track.classList.add("drag");
    track.setPointerCapture(e.pointerId);
    paint(fracAt(e));
  });
  track.addEventListener("pointermove", e => { if (dragging) paint(fracAt(e)); });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("drag");
    const frac = fracAt(e);
    const seek = () => { audio.currentTime = frac * dur(); };
    audio.readyState >= 1 ? seek() : audio.addEventListener("loadedmetadata", seek, { once: true });
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  /* ---- keyboard ---- */
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea")) return;
    if (e.code === "Space") { e.preventDefault(); toggle(cur < 0 ? 0 : cur); }
  });

  /* ---- audio events ---- */
  audio.addEventListener("play", () => { document.body.classList.add("playing"); rows[cur]?.classList.add("on"); status(); });
  audio.addEventListener("pause", () => { document.body.classList.remove("playing"); rows[cur]?.classList.remove("on"); status(); });
  audio.addEventListener("timeupdate", () => { if (!dragging) paint(); });
  audio.addEventListener("loadedmetadata", () => { if (!dragging) paint(); });
  audio.addEventListener("ended", () => {
    if (repeat === "one") { audio.currentTime = 0; audio.play(); return; }
    const n = nextIndex(1);
    if (n >= 0) play(n);
  });
})();
