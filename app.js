(() => {
  const tracks = window.TRACKS || [];
  const S = window.SETTINGS || { contacts: {} };
  const I18N = window.I18N || { en: {} };
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
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dur = () => audio.duration || (cur >= 0 ? tracks[cur].duration : 0);
  const desc = t => [t.key, t.bpm && `${t.bpm} BPM`].filter(Boolean).join(" · ");
  const slug = t => t.file.replace(/\.mp3$/i, "");

  /* ================= language ================= */
  let lang = store.get("lang", (navigator.language || "").toLowerCase().startsWith("ru") ? "ru" : "en");
  if (!I18N[lang]) lang = "en";
  const t = (key, vars = {}) => {
    let s = (I18N[lang] && I18N[lang][key]) ?? (I18N.en && I18N.en[key]) ?? key;
    for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  };
  const pick = v => (v && typeof v === "object") ? (v[lang] ?? v.en ?? "") : (v ?? "");   // settings value per language

  /* ================= list ================= */
  const selIcon = '<svg viewBox="0 0 24 24"><path class="i-plus" d="M12 5v14M5 12h14"/><path class="i-check" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  list.innerHTML = tracks.map((tr, i) => `
      <li class="row" data-i="${i}" id="t-${esc(slug(tr))}">
        <div class="info">
          <div class="title">${esc(tr.title)}<span class="arrow">↘</span></div>
          <div class="meta">${fmt(tr.duration)}</div>
        </div>
        <div class="btns">
          <button class="sel" aria-pressed="false">${selIcon}</button>
        </div>
      </li>`).join("");

  const rows = [...list.querySelectorAll(".row")];

  /* ================= search ================= */
  const q = $("q"), qClear = $("qClear");
  const norm = s => s.toLowerCase().replace(/ё/g, "е").trim();
  function filter() {
    const v = norm(q.value);
    let shown = 0, first = true;
    rows.forEach((r, i) => {
      const ok = !v || norm(tracks[i].title).includes(v);
      r.hidden = !ok;
      r.classList.toggle("first", ok && first);
      if (ok) { shown++; first = false; }
    });
    qClear.hidden = !v;
    $("found").textContent = v ? t("found", { n: shown }) : "";
    $("none").hidden = shown > 0;
    list.hidden = shown === 0;
  }
  q.addEventListener("input", filter);
  q.addEventListener("keydown", e => { if (e.key === "Escape" && q.value) { e.stopPropagation(); q.value = ""; filter(); } });
  qClear.addEventListener("click", () => { q.value = ""; filter(); q.focus(); });
  const visible = () => rows.map((r, i) => r.hidden ? -1 : i).filter(i => i >= 0);

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
  // next/prev follow the list as currently filtered by search
  function nextIndex(step) {
    const vis = visible();
    if (!vis.length) return -1;
    if (shuffle && vis.length > 1) {
      let n; do { n = vis[Math.floor(Math.random() * vis.length)]; } while (n === cur);
      return n;
    }
    const pos = vis.indexOf(cur);
    if (pos < 0) return step > 0 ? vis[0] : vis[vis.length - 1];
    const n = pos + step;
    if (n < 0 || n >= vis.length) return repeat === "all" ? vis[(n + vis.length) % vis.length] : -1;
    return vis[n];
  }

  function nowPlaying() {
    const tr = tracks[cur];
    pTitle.textContent = tr.title;
    pMeta.textContent = desc(tr);
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
  let picked = new Set(store.get("picked", []).filter(f => tracks.some(tr => tr.file === f)));
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
  function togglePick(i) {
    const f = tracks[i].file;
    picked.has(f) ? picked.delete(f) : picked.add(f);
    renderPicked(true);
  }
  renderPicked(false);

  /* ---- list clicks: buttons do their thing, anywhere else on the row plays ---- */
  let swallowClick = false;   // set after a long-press opened the menu
  list.addEventListener("click", e => {
    if (swallowClick) { swallowClick = false; return; }
    const row = e.target.closest(".row");
    if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest(".sel")) return togglePick(i);
    toggle(i);
  });

  /* ================= controls ================= */
  $("cover").addEventListener("click", () => toggle(cur < 0 ? (visible()[0] ?? 0) : cur));
  $("toggle").addEventListener("click", () => toggle(cur < 0 ? (visible()[0] ?? 0) : cur));
  $("next").addEventListener("click", () => { const n = nextIndex(1); if (n >= 0) play(n); });
  $("prev").addEventListener("click", () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const n = nextIndex(-1);
    n >= 0 ? play(n) : (audio.currentTime = 0);
  });
  shuffleBtn.addEventListener("click", () => {
    shuffle = !shuffle;
    shuffleBtn.setAttribute("aria-pressed", shuffle);
  });
  const repeatLabel = () => repeatBtn.setAttribute("aria-label", t({ off: "repeatOff", all: "repeatAll", one: "repeatOne" }[repeat]));
  repeatBtn.addEventListener("click", () => {
    repeat = { off: "all", all: "one", one: "off" }[repeat];
    repeatBtn.dataset.mode = repeat;
    repeatLabel();
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
    muteBtn.setAttribute("aria-label", t(v === 0 ? "unmute" : "mute"));
    store.set("volume", v);
  }
  slider(vol, { onMove: f => { setVol(f); if (f > 0) lastVol = f; } });
  muteBtn.addEventListener("click", () => {
    if (volume > 0) { lastVol = volume; setVol(0); } else setVol(lastVol || 0.9);
  });

  /* ================= clipboard + toast ================= */
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
  const toastEl = document.createElement("div");
  toastEl.className = "toast"; toastEl.setAttribute("role", "status");
  document.body.appendChild(toastEl);
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("show"); void toastEl.offsetWidth; toastEl.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  /* ================= contact window ================= */
  const modal = $("modal"), mMsg = $("mMsg"), mNote = $("mNote");
  const C = S.contacts || {};

  function message() {
    const sel = tracks.filter(tr => picked.has(tr.file));
    if (!sel.length) return pick(S.messageEmpty) || "Hi!";
    const lines = sel.map(tr => `— ${tr.title}${desc(tr) ? ` (${desc(tr)})` : ""}`).join("\n");
    return (pick(S.messageWithTracks) || "{list}").replace("{list}", lines);
  }

  const channels = [
    C.telegram && { id: "telegram", name: () => "Telegram", handle: "@" + C.telegram,
      href: m => `https://t.me/${C.telegram}?text=${encodeURIComponent(m)}`, copy: true },
    C.instagram && { id: "instagram", name: () => "Instagram", handle: "@" + C.instagram,
      href: () => `https://ig.me/m/${C.instagram}`, copy: true },
    C.email && { id: "email", name: () => t("email"), handle: C.email,
      href: m => `mailto:${C.email}?subject=${encodeURIComponent(pick(S.emailSubject))}&body=${encodeURIComponent(m)}`, copy: false },
  ].filter(Boolean);

  function renderChannels() {
    $("mBtns").innerHTML = channels.map((c, k) =>
      `<button class="m-btn" data-k="${k}"><span>${esc(c.name())}</span><small>${esc(c.handle)}</small></button>`).join("");
  }

  // Default hint: tells people the message goes to the clipboard on click (TG/IG can't prefill reliably).
  const hint = () => {
    const names = channels.filter(c => c.copy).map(c => c.name()).join(t("and"));
    return names ? t("copyHint", { names }) : "";
  };
  function note(text) {
    mNote.textContent = text;
    mNote.classList.remove("show"); void mNote.offsetWidth; mNote.classList.add("show");
    clearTimeout(note.t);
    note.t = setTimeout(() => { mNote.classList.remove("show"); mNote.textContent = hint(); }, 4000);
  }

  $("mBtns").addEventListener("click", async e => {
    const b = e.target.closest(".m-btn"); if (!b) return;
    const c = channels[+b.dataset.k], m = mMsg.value;
    if (c.copy && await copy(m)) note(t("copiedPaste"));
    window.open(c.href(m), c.id === "email" ? "_self" : "_blank", "noopener");
  });

  function renderModalList() {
    const sel = tracks.filter(tr => picked.has(tr.file));
    const n = sel.length;
    $("mSub").textContent = n ? t("selected", { n }) : t("nothingSelected");
    $("mList").innerHTML = n
      ? sel.map(tr => `<li class="m-item"><span class="n">${esc(tr.title)}</span><span class="k">${esc(desc(tr))}</span>` +
          `<button class="m-x" data-file="${esc(tr.file)}" aria-label="${esc(t("remove", { t: tr.title }))}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join("")
      : `<li class="m-empty">${t("emptyList")}</li>`;
  }
  $("mList").addEventListener("click", e => {
    const x = e.target.closest(".m-x"); if (!x) return;
    picked.delete(x.dataset.file);
    renderPicked(false);
    fillModal();
  });

  function fillModal() {
    renderModalList();
    $("mClear").style.visibility = picked.size ? "visible" : "hidden";
    mMsg.value = message();
    clearTimeout(note.t);
    mNote.classList.remove("show");
    mNote.textContent = hint();
  }
  function openModal() {
    closeMenu();
    fillModal();
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
  $("mCopy").addEventListener("click", async () => { if (await copy(mMsg.value)) note(t("copied")); });
  $("mClear").addEventListener("click", () => { picked.clear(); renderPicked(false); fillModal(); });

  /* ================= links window (click the name) ================= */
  const links = $("links");
  const socials = (S.socials || []).filter(x => x && x.url);
  const renderLinks = () => $("lList").innerHTML = socials.map((x, k) => {
    const ext = !/^mailto:/i.test(x.url);
    return `<li style="animation-delay:${60 + k * 45}ms"><a class="l-item" href="${esc(x.url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>` +
      `<span class="n">${esc(/^e-?mail$/i.test(x.name) ? t("email") : x.name)}</span><span class="h">${esc(x.handle || "")}</span><span class="a">↗</span></a></li>`;
  }).join("");
  if (!socials.length) $("nameBtn").disabled = true;
  function openLinks() {
    closeMenu();
    links.classList.remove("closing");
    links.hidden = false;
    document.body.style.overflow = "hidden";
    links.querySelector(".l-item")?.focus({ preventScroll: true });
  }
  function closeLinks() {
    if (links.hidden || links.classList.contains("closing")) return;
    links.classList.add("closing");
    setTimeout(() => { links.hidden = true; links.classList.remove("closing"); document.body.style.overflow = ""; }, 200);
  }
  $("nameBtn").addEventListener("click", openLinks);
  links.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeLinks(); });

  /* ================= right-click / long-press menu ================= */
  const ctx = $("ctx");
  const ico = {
    play: '<path class="fill" d="M8 5v14l11-7z"/>',
    pause: '<path class="fill" d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  };
  let menuFor = -1;

  function openMenu(i, x, y) {
    menuFor = i;
    const tr = tracks[i];
    const isPlaying = i === cur && !audio.paused;
    const isPicked = picked.has(tr.file);
    const item = (act, icon, label, extra = "") =>
      `<button class="ctx-i" role="menuitem" data-act="${act}"><svg viewBox="0 0 24 24">${ico[icon]}</svg><span>${esc(label)}</span>${extra}</button>`;
    ctx.innerHTML =
      `<div class="ctx-h">${esc(tr.title)}</div>` +
      item("play", isPlaying ? "pause" : "play", t(isPlaying ? "menuPause" : "menuPlay")) +
      item("pick", isPicked ? "minus" : "plus", t(isPicked ? "menuDeselect" : "menuSelect")) +
      `<div class="ctx-sep"></div>` +
      item("download", "down", t("menuDownload"), `<em>${esc(t("free"))}</em>`) +
      item("link", "link", t("menuLink"));
    ctx.hidden = false;
    // keep inside the viewport; grow from the cursor
    const w = ctx.offsetWidth, h = ctx.offsetHeight, m = 8;
    const left = Math.min(x, innerWidth - w - m), top = Math.min(y, innerHeight - h - m);
    ctx.style.left = Math.max(m, left) + "px";
    ctx.style.top = Math.max(m, top) + "px";
    ctx.style.transformOrigin = `${x - Math.max(m, left)}px ${y - Math.max(m, top)}px`;
    ctx.classList.remove("in"); void ctx.offsetWidth; ctx.classList.add("in");
    rows.forEach(r => r.classList.toggle("ctx-on", +r.dataset.i === i));
    ctx.querySelector(".ctx-i").focus({ preventScroll: true });
  }
  function closeMenu() {
    if (ctx.hidden) return;
    ctx.hidden = true; menuFor = -1;
    rows.forEach(r => r.classList.remove("ctx-on"));
  }

  function download(i) {
    const tr = tracks[i];
    const a = document.createElement("a");
    a.href = "audio/" + tr.file;
    a.download = `${S.artist || "Merelleyne"} - ${tr.title} (tagged).mp3`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function copyLink(i) {
    const url = location.href.split("#")[0] + "#" + slug(tracks[i]);
    if (await copy(url)) toast(t("linkCopied"));
  }

  ctx.addEventListener("click", e => {
    const b = e.target.closest(".ctx-i"); if (!b) return;
    const i = menuFor;
    closeMenu();
    ({ play: () => toggle(i), pick: () => togglePick(i), download: () => download(i), link: () => copyLink(i) })[b.dataset.act]();
  });
  ctx.addEventListener("keydown", e => {
    const items = [...ctx.querySelectorAll(".ctx-i")], k = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(k + 1) % items.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(k - 1 + items.length) % items.length].focus(); }
  });

  list.addEventListener("contextmenu", e => {
    const row = e.target.closest(".row"); if (!row) return;
    e.preventDefault();
    openMenu(+row.dataset.i, e.clientX, e.clientY);
  });
  // touch: long-press opens the same menu
  let lp = null;
  list.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch") return;
    const row = e.target.closest(".row"); if (!row) return;
    const x = e.clientX, y = e.clientY;
    lp = { x, y, timer: setTimeout(() => { swallowClick = true; navigator.vibrate?.(10); openMenu(+row.dataset.i, x, y); }, 520) };
  });
  const cancelLp = e => { if (lp && (!e || e.type !== "pointermove" || Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10)) { clearTimeout(lp.timer); lp = null; } };
  list.addEventListener("pointermove", cancelLp);
  list.addEventListener("pointerup", () => { if (lp) { clearTimeout(lp.timer); lp = null; } });
  list.addEventListener("pointercancel", cancelLp);

  document.addEventListener("pointerdown", e => { if (!ctx.hidden && !ctx.contains(e.target)) closeMenu(); }, true);
  addEventListener("scroll", closeMenu, { passive: true });
  addEventListener("resize", closeMenu);
  addEventListener("blur", closeMenu);

  /* ================= keyboard ================= */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (!ctx.hidden) return closeMenu(); closeLinks(); return closeModal(); }
    if (!modal.hidden || !links.hidden || !ctx.hidden || e.target.closest("button, a, input, textarea")) return;
    if (e.key === "/") { e.preventDefault(); q.focus(); return; }
    if (e.code === "Space") { e.preventDefault(); toggle(cur < 0 ? (visible()[0] ?? 0) : cur); }
  });

  /* ================= apply language ================= */
  const langBox = $("lang");
  function applyLang(animate) {
    document.documentElement.lang = lang;
    document.title = t("pageTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("pageDesc"));
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.querySelectorAll("[data-i18n-ph]").forEach(el => el.setAttribute("placeholder", t(el.dataset.i18nPh)));
    rows.forEach((r, i) => {
      r.querySelector(".sel").setAttribute("aria-label", t("select", { t: tracks[i].title }));
    });
    repeatLabel();
    muteBtn.setAttribute("aria-label", t(volume === 0 ? "unmute" : "mute"));
    renderChannels();
    renderLinks();
    filter();
    if (!modal.hidden) fillModal();
    closeMenu();
    langBox.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
    if (animate) {
      document.body.classList.remove("lang-swap"); void document.body.offsetWidth; document.body.classList.add("lang-swap");
    }
  }
  langBox.addEventListener("click", e => {
    const b = e.target.closest("[data-lang]");
    if (!b || b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    store.set("lang", lang);
    applyLang(true);
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

  /* ================= start ================= */
  setVol(volume);
  applyLang(false);

  // shared link: site.com/#track-slug → scroll to the track and load it in the player (no autoplay)
  function openHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = tracks.findIndex(tr => slug(tr) === id);
    if (i < 0) return;
    q.value = ""; filter();
    load(i);
    rows[i].scrollIntoView({ block: "center", behavior: "smooth" });
    rows[i].classList.remove("flash"); void rows[i].offsetWidth; rows[i].classList.add("flash");
  }
  addEventListener("hashchange", openHash);
  if (location.hash) openHash();
})();
