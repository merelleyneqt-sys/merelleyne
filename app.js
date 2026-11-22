(() => {
  const tracks = window.TRACKS || [];
  const S = window.SETTINGS || { contacts: {} };
  const $ = id => document.getElementById(id);
  const audio = $("audio"), list = $("list");
  const fill = $("fill"), seek = $("seek"), tCur = $("tCur"), tDur = $("tDur");
  const shuffleBtn = $("shuffle"), repeatBtn = $("repeat");
  const pNow = $("pNow"), pTitle = $("pTitle"), pMeta = $("pMeta");
  const muteBtn = $("mute"), vol = $("vol"), volFill = $("volFill");
  let cur = -1, shuffle = false, repeat = "off", seeking = false;

  /* ---- tiny storage helpers (may be unavailable: private mode etc.) ---- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const fmt = s => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dur = () => audio.duration || (cur >= 0 ? tracks[cur].duration : 0);
  const desc = t => [t.key, t.bpm && `${t.bpm} BPM`].filter(Boolean).join(" · ");

  const playIcon = '<svg viewBox="0 0 24 24"><path class="i-play" d="M8 5v14l11-7z"/><path class="i-pause" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const selIcon = '<svg viewBox="0 0 24 24"><path class="i-plus" d="M12 5v14M5 12h14"/><path class="i-check" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  list.innerHTML = tracks.map((t, i) => `
      <li class="row" data-i="${i}">
        <div class="info">
          <div class="title">${esc(t.title)}<span class="arrow">↘</span></div>
          <div class="meta">${esc([desc(t), fmt(t.duration)].filter(Boolean).join(" · "))}</div>
        </div>
        <div class="btns">
          <button class="play" aria-label="Play ${esc(t.title)}">${playIcon}</button>
          <button class="sel" aria-label="Select ${esc(t.title)}" aria-pressed="false">${selIcon}</button>
        </div>
      </li>`).join("");

  const rows = [...list.querySelectorAll(".row")];

  /* ================= playback ================= */
  function load(i) {
    if (cur >= 0) rows[cur].classList.remove("active", "on");
    cur = i;
    audio.src = "audio/" + tracks[i].file;
    rows[i].classList.add("active");
    document.body.classList.add("has-player");
    nowPlaying();
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

  function nowPlaying() {
    const t = tracks[cur];
    pTitle.textContent = t.title;
    pMeta.textContent = desc(t);
    pNow.classList.remove("swap"); void pNow.offsetWidth; pNow.classList.add("swap"); // replay animation
  }

  function paint(frac) {
    const d = dur();
    if (frac == null) frac = d ? audio.currentTime / d : 0;
    fill.style.width = (frac * 100) + "%";
    tCur.textContent = fmt(frac * d);
    tDur.textContent = fmt(d);
  }

  /* ================= selection ================= */
  let picked = new Set(store.get("picked", []).filter(f => tracks.some(t => t.file === f)));
  function renderPicked(bump) {
    rows.forEach((r, i) => {
      const on = picked.has(tracks[i].file);
      r.classList.toggle("picked", on);
      r.querySelector(".sel").setAttribute("aria-pressed", on);
    });
    $("selCount").textContent = picked.size ? `· ${picked.size}` : "";
    $("hint").style.visibility = picked.size ? "hidden" : "visible";
    store.set("picked", [...picked]);
    if (bump) { const b = $("contactBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  }
  renderPicked(false);

  /* ---- list clicks: buttons do their thing, anywhere else on the row plays ---- */
  list.addEventListener("click", e => {
    const row = e.target.closest(".row");
    if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest(".sel")) {
      const f = tracks[i].file;
      picked.has(f) ? picked.delete(f) : picked.add(f);
      renderPicked(true);
      return;
    }
    toggle(i);
  });

  /* ================= controls ================= */
  $("cover").addEventListener("click", () => toggle(cur < 0 ? 0 : cur));
  $("toggle").addEventListener("click", () => toggle(cur < 0 ? 0 : cur));
  $("next").addEventListener("click", () => { const n = nextIndex(1); if (n >= 0) play(n); });
  $("prev").addEventListener("click", () => {
    if (audio.currentTime > 3 || (cur <= 0 && !shuffle && repeat !== "all")) { audio.currentTime = 0; return; }
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

  /* ---- generic draggable line slider ---- */
  function slider(el, { onMove, onEnd }) {
    const at = e => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    let drag = false;
    el.addEventListener("pointerdown", e => { drag = true; el.classList.add("drag"); el.setPointerCapture(e.pointerId); onMove(at(e)); });
    el.addEventListener("pointermove", e => { if (drag) onMove(at(e)); });
    const end = e => { if (!drag) return; drag = false; el.classList.remove("drag"); onEnd && onEnd(at(e)); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  slider(seek, {
    onMove: f => { if (cur < 0) return; seeking = true; paint(f); },
    onEnd: f => {
      if (cur < 0) return;
      seeking = false;
      const go = () => { audio.currentTime = f * dur(); };
      audio.readyState >= 1 ? go() : audio.addEventListener("loadedmetadata", go, { once: true });
    },
  });

  /* ---- volume ---- */
  let volume = store.get("volume", 0.9), lastVol = volume || 0.9;
  function setVol(v) {
    volume = v;
    audio.volume = v;
    audio.muted = v === 0;
    volFill.style.width = (v * 100) + "%";
    muteBtn.classList.toggle("muted", v === 0);
    muteBtn.classList.toggle("low", v > 0 && v < 0.5);
    muteBtn.setAttribute("aria-label", v === 0 ? "Unmute" : "Mute");
    store.set("volume", v);
  }
  slider(vol, { onMove: f => { setVol(f); if (f > 0) lastVol = f; } });
  muteBtn.addEventListener("click", () => {
    if (volume > 0) { lastVol = volume; setVol(0); } else setVol(lastVol || 0.9);
  });
  setVol(volume);

  /* ================= contact window ================= */
  const modal = $("modal"), mMsg = $("mMsg"), mNote = $("mNote");
  const C = S.contacts || {};

  function message() {
    const sel = tracks.filter(t => picked.has(t.file));
    if (!sel.length) return S.messageEmpty || "Hi!";
    const lines = sel.map(t => `— ${t.title}${desc(t) ? ` (${desc(t)})` : ""}`).join("\n");
    return (S.messageWithTracks || "{list}").replace("{list}", lines);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch {}
      ta.remove(); return ok;
    }
  }
  // Default hint: tells people the message goes to the clipboard on click (TG/IG can't prefill reliably).
  const copyNames = () => channels.filter(c => c.copy).map(c => c.name).join(" & ");
  const hint = () => copyNames() ? `${copyNames()}: the message is copied automatically on click — just paste it into the chat` : "";
  function note(text) {
    mNote.textContent = text;
    mNote.classList.remove("show"); void mNote.offsetWidth; mNote.classList.add("show");
    clearTimeout(note.t);
    note.t = setTimeout(() => { mNote.classList.remove("show"); mNote.textContent = hint(); }, 4000);
  }

  const channels = [
    C.telegram && { name: "Telegram", handle: "@" + C.telegram,
      href: m => `https://t.me/${C.telegram}?text=${encodeURIComponent(m)}`, copy: true },
    C.instagram && { name: "Instagram", handle: "@" + C.instagram,
      href: () => `https://ig.me/m/${C.instagram}`, copy: true },
    C.email && { name: "Email", handle: C.email,
      href: m => `mailto:${C.email}?subject=${encodeURIComponent(S.emailSubject || "")}&body=${encodeURIComponent(m)}`, copy: false },
  ].filter(Boolean);

  $("mBtns").innerHTML = channels.map((c, k) =>
    `<button class="m-btn" data-k="${k}"><span>${esc(c.name)}</span><small>${esc(c.handle)}</small></button>`).join("");

  $("mBtns").addEventListener("click", async e => {
    const b = e.target.closest(".m-btn"); if (!b) return;
    const c = channels[+b.dataset.k], m = mMsg.value;
    if (c.copy && await copy(m)) note("Message copied — paste it into the chat (⌘V / long-press → Paste)");
    window.open(c.href(m), c.name === "Email" ? "_self" : "_blank", "noopener");
  });

  function renderModalList() {
    const sel = tracks.filter(t => picked.has(t.file));
    const n = sel.length;
    $("mSub").textContent = n ? `Selected · ${n}` : "Nothing selected";
    $("mList").innerHTML = n
      ? sel.map(t => `<li class="m-item"><span class="n">${esc(t.title)}</span><span class="k">${esc(desc(t))}</span>` +
          `<button class="m-x" data-file="${esc(t.file)}" aria-label="Remove ${esc(t.title)}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join("")
      : `<li class="m-empty">Pick tracks with <b>+</b> to list them here</li>`;
  }
  $("mList").addEventListener("click", e => {
    const x = e.target.closest(".m-x"); if (!x) return;
    picked.delete(x.dataset.file);
    renderPicked(false);
    renderModalList();
    $("mClear").style.visibility = picked.size ? "visible" : "hidden";
    mMsg.value = message();
  });

  function openModal() {
    const n = picked.size;
    renderModalList();
    $("mClear").style.visibility = n ? "visible" : "hidden";
    mMsg.value = message();
    clearTimeout(note.t);
    mNote.classList.remove("show");
    mNote.textContent = hint();
    modal.classList.remove("closing");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    if (modal.hidden || modal.classList.contains("closing")) return;
    modal.classList.add("closing");
    setTimeout(() => { modal.hidden = true; modal.classList.remove("closing"); document.body.style.overflow = ""; }, 200);
  }
  $("contactBtn").addEventListener("click", openModal);
  modal.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  $("mCopy").addEventListener("click", async () => { if (await copy(mMsg.value)) note("Copied"); });
  $("mClear").addEventListener("click", () => { picked.clear(); renderPicked(false); openModal(); });

  /* ================= keyboard ================= */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") return closeModal();
    if (!modal.hidden || e.target.closest("button, a, input, textarea")) return;
    if (e.code === "Space") { e.preventDefault(); toggle(cur < 0 ? 0 : cur); }
  });

  /* ================= audio events ================= */
  audio.addEventListener("play", () => { document.body.classList.add("playing"); rows[cur]?.classList.add("on"); });
  audio.addEventListener("pause", () => { document.body.classList.remove("playing"); rows[cur]?.classList.remove("on"); });
  audio.addEventListener("timeupdate", () => { if (!seeking) paint(); });
  audio.addEventListener("loadedmetadata", () => { if (!seeking) paint(); });
  audio.addEventListener("ended", () => {
    if (repeat === "one") { audio.currentTime = 0; audio.play(); return; }
    const n = nextIndex(1);
    if (n >= 0) play(n);
  });
})();
