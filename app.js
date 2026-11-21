(() => {
  const tracks = window.TRACKS || [];
  const audio = document.getElementById("audio");
  const list = document.getElementById("list");
  const sub = document.getElementById("sub");
  const subDefault = sub.innerHTML;
  let cur = -1;

  const fmt = s => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const playIcon = '<svg viewBox="0 0 24 24"><path class="i-play" d="M8 5v14l11-7z"/><path class="i-pause" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  list.innerHTML = tracks.map((t, i) => {
    const meta = [t.key, t.bpm && `${t.bpm} BPM`, fmt(t.duration)].filter(Boolean).join(" · ");
    const bars = (t.peaks || []).map(p => `<i style="height:${Math.max(6, p * 100)}%"></i>`).join("");
    return `
      <li class="row" data-i="${i}">
        <span class="idx">${pad(i + 1)}</span>
        <div class="info">
          <div class="title">${esc(t.title)}<span class="arrow">↘</span></div>
          <div class="meta">${esc(meta)}</div>
        </div>
        <div class="wave" aria-hidden="true">${bars}</div>
        <div class="btns">
          <button class="play" aria-label="Play ${esc(t.title)}">${playIcon}</button>
          <a class="buy" href="${esc(t.buy || "#")}" aria-label="Buy ${esc(t.title)}">$${t.price}</a>
        </div>
        <span class="bar"></span>
      </li>`;
  }).join("");

  const rows = [...list.querySelectorAll(".row")];

  function load(i) {
    if (cur >= 0) rows[cur].classList.remove("active", "on");
    cur = i;
    audio.src = "audio/" + tracks[i].file;
    rows[i].classList.add("active");
    paint(0);
  }

  function toggle(i) {
    if (i !== cur) { load(i); audio.play(); return; }
    audio.paused ? audio.play() : audio.pause();
  }

  function paint(frac) {
    if (cur < 0) return;
    const row = rows[cur];
    const bars = row.querySelectorAll(".wave i");
    const lit = Math.round(frac * bars.length);
    bars.forEach((b, k) => b.classList.toggle("on", k < lit));
    row.querySelector(".bar").style.width = (frac * 100) + "%";
  }

  function status() {
    if (cur < 0) { sub.innerHTML = subDefault; return; }
    const t = tracks[cur];
    sub.innerHTML = `<span class="red">${audio.paused ? "Paused" : "Now"}</span><span class="now">${esc(t.title)}</span>` +
      `<span>${fmt(audio.currentTime)} / ${fmt(audio.duration || t.duration)}</span>`;
  }

  list.addEventListener("click", e => {
    const row = e.target.closest(".row");
    if (!row || e.target.closest(".buy")) return;
    const i = +row.dataset.i;
    const wave = e.target.closest(".wave");
    if (wave) {
      const r = wave.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (i !== cur) load(i);
      const seek = () => { audio.currentTime = frac * (audio.duration || tracks[i].duration); };
      audio.readyState >= 1 ? seek() : audio.addEventListener("loadedmetadata", seek, { once: true });
      audio.play();
      return;
    }
    if (e.target.closest(".play, .info, .idx")) toggle(i);
  });

  document.getElementById("cover").addEventListener("click", () => toggle(cur < 0 ? 0 : cur));

  document.addEventListener("keydown", e => {
    if (e.code !== "Space" || e.target.closest("input, textarea")) return;
    e.preventDefault();
    toggle(cur < 0 ? 0 : cur);
  });

  audio.addEventListener("play", () => { document.body.classList.add("playing"); rows[cur]?.classList.add("on"); status(); });
  audio.addEventListener("pause", () => { document.body.classList.remove("playing"); rows[cur]?.classList.remove("on"); status(); });
  audio.addEventListener("timeupdate", () => { paint(audio.currentTime / (audio.duration || 1)); status(); });
  audio.addEventListener("ended", () => { if (cur < tracks.length - 1) { load(cur + 1); audio.play(); } });
})();
