(() => {
  const tracks = window.TRACKS || [];
  const S = window.SETTINGS || { contacts: {} };
  const I18N = window.I18N || { en: {} };
  const $ = id => document.getElementById(id);
  const audio = $("audio"), list = $("list");
  const fill = $("fill"), seek = $("seek"), tCur = $("tCur"), tDur = $("tDur");
  const shuffleBtn = $("shuffle"), repeatBtn = $("repeat");
  const pNow = $("pNow"), pTitle = $("pTitle");
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

  // newest track = latest upload date ("added", set by the admin)
  const newest = tracks.reduce((best, tr, i) => (tr.added || "") > (tracks[best].added || "") ? i : best, 0);
  const COLS = ["bpm", "key", "genre"];

  list.innerHTML = tracks.map((tr, i) => `
      <li class="row" data-i="${i}" id="t-${esc(slug(tr))}">
        <div class="info">
          <div class="title">${esc(tr.title)}${i === newest ? '<span class="new">New</span>' : ""}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></div>
          <div class="cells">${COLS.map(c => `<span class="cell c-${c}${tr[c] ? "" : " nil"}">${esc(tr[c] || "—")}</span>`).join("")}</div>
        </div>
        <div class="btns">
          <button class="sel" aria-pressed="false">${selIcon}</button>
        </div>
      </li>`).join("");

  const rows = [...list.querySelectorAll(".row")];

  /* ================= sections & volumes ================= */
  const SECTIONS = ["tracks", "software", "samples"];
  const SIZE = S.volumeSize || 10;
  const tomes = Math.max(1, Math.ceil(tracks.length / SIZE));
  const tomeOf = i => Math.floor(i / SIZE);
  const tomeName = n => t("volume", { n: String(n + 1).padStart(2, "0") });
  let section = "tracks", tome = 0;
  const shop = $("shop"), catBtn = $("catBtn"), tomeBtn = $("tomeBtn");

  // software & sample packs: same rows; "file" is their id in the selection
  const products = ["software", "samples"].flatMap(sec =>
    (S[sec] || []).map(p => ({ ...p, section: sec, file: `${sec}:${p.title}` })));
  const goods = [...tracks, ...products];
  shop.innerHTML = products.map((p, i) => `
      <li class="row" data-i="${i}">
        <div class="info"><div class="title">${esc(p.title)}</div></div>
        <div class="btns"><button class="sel" aria-pressed="false">${selIcon}</button></div>
      </li>`).join("");
  const shopRows = [...shop.querySelectorAll(".row")];

  function renderSub() {
    catBtn.textContent = t(section);
    tomeBtn.textContent = tomeName(tome);
    tomeBtn.setAttribute("aria-label", t("nextVolume", { t: tomeName(tome) }));
    tomeBtn.hidden = $("subDot").hidden = section !== "tracks";
  }
  function show(sec, n) {
    section = sec; tome = n;
    q.value = "";
    genres.clear();
    renderSub();
    filter();
    const el = sec === "tracks" ? list : shop;
    el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap");
  }

  /* ---- BPM / key / genre switches: show or hide details in the rows ---- */
  const colsBox = $("cols");
  let genreHeld = false, genreTimer = 0;
  let shownCols = [].concat(store.get("cols", [])).filter(c => COLS.includes(c));
  function renderCols() {
    COLS.forEach(c => list.classList.toggle("show-" + c, shownCols.includes(c)));
    colsBox.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", shownCols.includes(b.dataset.col)));
  }
  colsBox.addEventListener("click", e => {
    const b = e.target.closest("[data-col]"); if (!b) return;
    if (genreHeld && b.id === "genreBtn") { genreHeld = false; return; }
    const c = b.dataset.col;
    shownCols = shownCols.includes(c) ? shownCols.filter(x => x !== c) : [...shownCols, c];
    store.set("cols", shownCols);
    renderCols();
  });
  renderCols();

  /* ================= search ================= */
  const q = $("q"), qClear = $("qClear");
  const norm = s => s.toLowerCase().replace(/ё/g, "е").trim();
  const genres = new Set();   // ticked in the genre menu
  const allGenres = [...new Set(tracks.map(tr => tr.genre).filter(Boolean))].sort();
  const filtering = () => !!(q.value.trim() || genres.size);
  function filter() {
    const v = norm(q.value);
    let shown = 0, first = true;
    const inTracks = section === "tracks";
    // search looks through every volume; without it only the open volume is shown
    (inTracks ? rows : shopRows).forEach((r, i) => {
      const ok = inTracks
        ? (filtering() ? (!v || norm(tracks[i].title).includes(v)) && (!genres.size || genres.has(tracks[i].genre)) : tomeOf(i) === tome)
        : products[i].section === section && (!v || norm(products[i].title).includes(v));
      r.hidden = !ok;
      r.classList.toggle("first", ok && first);
      if (ok) { shown++; first = false; }
    });
    qClear.hidden = !v;
    $("found").textContent = filtering() ? t("found", { n: shown }) : "";
    $("none").hidden = shown > 0;
    $("none").textContent = t(filtering() ? "nothingFound" : "comingSoon");
    list.hidden = !inTracks || shown === 0;
    shop.hidden = inTracks || shown === 0;
    colsBox.hidden = !inTracks;
    $("genreN").textContent = genres.size ? genres.size : "";
    $("bar").hidden = !v && shown === 0;
  }
  q.addEventListener("input", filter);
  q.addEventListener("keydown", e => { if (e.key === "Escape" && q.value) { e.stopPropagation(); q.value = ""; filter(); } });
  qClear.addEventListener("click", () => { q.value = ""; filter(); q.focus(); });
  const visible = () => rows.map((r, i) => r.hidden ? -1 : i).filter(i => i >= 0);

  /* ================= playback ================= */
  function load(i) {
    // playback moved into another volume: turn the page if the listener was on the old one
    if (cur >= 0 && section === "tracks" && !filtering() && tome === tomeOf(cur) && tome !== tomeOf(i)) show("tracks", tomeOf(i));
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
  // next/prev go through all volumes in order, or through the search results while searching
  function nextIndex(step) {
    const vis = section === "tracks" && filtering() ? visible() : tracks.map((_, i) => i);
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
    // title with key/BPM in brackets on the right: "Arcane (Bm · 142 BPM)"
    pTitle.innerHTML = esc(tr.title) + (desc(tr) ? ` <span class="p-kb">(${esc(desc(tr))})</span>` : "");
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
  // licenses & prices come from the profile the track belongs to
  const licensesOf = g => g.section ? [] : (S.profiles?.[g.profile || S.defaultProfile]?.licenses || []);
  const licenseOf = g => licensesOf(g).find(l => l.id === picked.get(g.file));
  const money = n => `${String(n).replace(/\B(?=(\d{3})+$)/g, " ")} ${S.currency || ""}`.trim();
  const licText = l => `${l.name} — ${l.price == null ? t("priceOnRequest") : money(l.price)}`;
  const total = sel => sel.reduce((sum, g) => sum + (licenseOf(g)?.price || 0), 0);

  // picked: file → license id (null for things without licenses)
  let picked = new Map([].concat(store.get("picked", []))
    .map(x => Array.isArray(x) ? x : [x, null])
    .filter(([f, id]) => { const g = goods.find(g => g.file === f); return g && (!licensesOf(g).length || licensesOf(g).some(l => l.id === id)); }));
  function renderPicked(bump) {
    [...rows, ...shopRows].forEach((r, i) => {
      const on = picked.has(goods[i].file);
      r.classList.toggle("picked", on);
      r.querySelector(".sel").setAttribute("aria-pressed", on);
    });
    $("selCount").textContent = picked.size ? `· ${picked.size}` : "";
    $("hint").style.visibility = picked.size ? "hidden" : "visible";
    store.set("picked", [...picked]);
    if (bump) { const b = $("contactBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  }
  function togglePick(i) {   // index in goods (tracks come first)
    const f = goods[i].file;
    picked.has(f) ? picked.delete(f) : picked.set(f, null);
    renderPicked(true);
  }
  // + on a track: choose a license (things without licenses are simply selected)
  function choosePick(i) {
    const g = goods[i], lics = licensesOf(g);
    if (!lics.length) return togglePick(i);
    const btn = rows[i].querySelector(".sel");
    const now = licenseOf(g);
    closeMenu();
    menuOwner = btn;
    ctx.innerHTML = `<div class="ctx-h">${esc(g.title)}</div>` +
      lics.map((l, k) => l.price == null ? "" :
        `<button class="ctx-i ctx-c" role="menuitemradio" aria-checked="${l === now}" data-k="${k}"><i></i><span>${esc(l.name)}</span><b>${esc(money(l.price))}</b></button>`).join("") +
      (picked.has(g.file) ? `<div class="ctx-sep"></div><button class="ctx-i" role="menuitem" data-k="-1"><svg viewBox="0 0 24 24">${ico.minus}</svg><span>${esc(t("menuDeselect"))}</span></button>` : "") +
      lics.map((l, k) => l.price != null ? "" :
        `<div class="ctx-sep"></div><div class="ctx-x" data-on="${l === now}"><i></i><span>${esc(l.name)}</span>` +
        `<button class="ctx-ask" role="menuitem" data-k="${k}" aria-describedby="ask${k}">${esc(t("contact"))}</button>` +
        `<div class="ctx-note"><p id="ask${k}">${esc(t("askHint"))}</p></div></div>`).join("");
    choose = k => {
      if (k < 0) picked.delete(g.file); else picked.set(g.file, lics[k].id);
      renderPicked(true);
      if (k >= 0 && lics[k].price == null) openModal();
    };
    ctx.hidden = false;
    const r = btn.getBoundingClientRect();
    placeMenu(r.right - ctx.offsetWidth, r.bottom + 4, 52);   // 52 = room for the hint line
    (ctx.querySelector('[aria-checked="true"]') || ctx.querySelector(".ctx-i, .ctx-ask")).focus({ preventScroll: true });
  }
  renderPicked(false);

  /* ---- list clicks: buttons do their thing, anywhere else on the row plays ---- */
  let swallowClick = false;   // set after a long-press opened the menu
  list.addEventListener("click", e => {
    if (swallowClick) { swallowClick = false; return; }
    const row = e.target.closest(".row");
    if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest(".sel")) {
      if (reopened) { reopened = false; return; }   // second click on + closes its menu
      return choosePick(i);
    }
    toggle(i);
  });
  shop.addEventListener("click", e => {
    const row = e.target.closest(".row"); if (!row) return;
    const i = +row.dataset.i, url = products[i].url;
    if (url && !e.target.closest(".sel")) return void window.open(url, "_blank", "noopener");
    togglePick(tracks.length + i);
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
    const sel = goods.filter(tr => picked.has(tr.file));
    if (!sel.length) return pick(S.messageEmpty) || "Hi!";
    const lines = sel.map(tr => `— ${tr.title}${desc(tr) ? ` (${desc(tr)})` : ""}${licenseOf(tr) ? ` — ${licText(licenseOf(tr))}` : ""}`).join("\n") +
      (sel.length > 1 && total(sel) ? `\n${t("total", { n: money(total(sel)) })}` : "");
    return (pick(sel.some(g => g.section) ? S.messageWithProducts : S.messageWithTracks) || "{list}").replace("{list}", lines);
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
    if (c.id === "email" && S.formKey) { closeModal(); setTimeout(openReq, 210); return; }
    if (c.copy && await copy(m)) note(t("copiedPaste"));
    window.open(c.href(m), c.id === "email" ? "_self" : "_blank", "noopener");
  });

  function renderModalList() {
    const sel = goods.filter(tr => picked.has(tr.file));
    const n = sel.length;
    $("mSub").textContent = n ? t("selected", { n }) + (total(sel) ? ` · ${money(total(sel))}` : "") : t("nothingSelected");
    $("mList").innerHTML = n
      ? sel.map(tr => `<li class="m-item"><span class="n">${esc(tr.title)}</span><span class="k">${esc(licenseOf(tr) ? [licenseOf(tr).name, licenseOf(tr).price != null && money(licenseOf(tr).price)].filter(Boolean).join(" · ") : desc(tr))}</span>` +
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

  /* ================= request form (Contact → Email) ================= */
  const req = $("req"), rForm = $("rForm"), rNote = $("rNote"), rSend = $("rSend");
  const chosen = () => goods.filter(g => picked.has(g.file));
  function renderReq() {
    const sel = chosen();
    $("rSum").innerHTML = sel.length
      ? sel.map(g => `<li><span>${esc(g.title)}</span><em>${esc(licenseOf(g) ? licText(licenseOf(g)) : "")}</em></li>`).join("") +
        (total(sel) ? `<li class="r-total"><span></span><em>${esc(t("total", { n: money(total(sel)) }))}</em></li>` : "")
      : `<li><em>${esc(t("reqNothing"))}</em></li>`;
  }
  function openReq() {
    closeMenu();
    renderReq();
    // keep what the visitor typed into the prepared message
    if (!rForm.comment.value && mMsg.value && mMsg.value !== message()) rForm.comment.value = mMsg.value;
    rForm.hidden = false; $("rDone").hidden = true;
    rNote.textContent = "";
    req.classList.remove("closing");
    req.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeReq() {
    if (req.hidden || req.classList.contains("closing")) return;
    req.classList.add("closing");
    setTimeout(() => { req.hidden = true; req.classList.remove("closing"); document.body.style.overflow = ""; }, 200);
  }
  req.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeReq(); });

  // the letter goes to the owner, so it is always in Russian
  function letter() {
    const sel = chosen(), val = n => rForm[n].value.trim();
    const price = l => l.price == null ? "цена по договорённости" : money(l.price);
    const lines = sel.map(g => `— ${g.title}${desc(g) ? ` (${desc(g)})` : ""}${licenseOf(g) ? ` — ${licenseOf(g).name} — ${price(licenseOf(g))}` : ""}`);
    const sum = total(sel) ? money(total(sel)) : "";
    const contacts = [["Telegram", "telegram"], ["Instagram", "instagram"], ["VK", "vk"], ["Email", "email"]]
      .filter(([, n]) => val(n)).map(([name, n]) => `${name}: ${val(n)}`);
    const text = [
      "Выбрано:", ...(lines.length ? lines : ["ничего, просто сообщение"]), ...(sum ? [`Итого: ${sum}`] : []),
      "", "Контакты:", ...contacts,
      ...(val("comment") ? ["", "Комментарий:", val("comment")] : []),
    ].join("\n");
    return {
      access_key: S.formKey,
      subject: `Новая заявка${sel.length ? `: треков — ${sel.length}${sum ? `, ${sum}` : ""}` : ""}`,
      from_name: `${S.artist || "Merelleyne"} — сайт`,
      ...(val("email") ? { replyto: val("email") } : {}),
      message: text,
    };
  }
  let sending = false;
  rForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (sending) return;
    const val = n => rForm[n].value.trim();
    const fail = (key, el) => { rNote.textContent = t(key); rNote.classList.add("show"); el?.focus(); };
    if (rForm.botcheck.checked) return;
    if (!["telegram", "instagram", "vk", "email"].some(val)) return fail("reqNeedContact", rForm.telegram);
    if (val("email") && !/^\S+@\S+\.\S+$/.test(val("email"))) return fail("reqBadEmail", rForm.email);
    if (!rForm.consent.checked) return fail("reqNeedConsent", rForm.consent);
    sending = true;
    rSend.disabled = true;
    rNote.classList.remove("show");
    rNote.textContent = t("reqSending");
    try {
      const r = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(letter()),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message);
      rForm.reset();
      rNote.textContent = "";
      rForm.hidden = true; $("rDone").hidden = false;
    } catch { fail("reqFail"); }
    sending = false;
    rSend.disabled = false;
  });

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
    placeMenu(x, y);
    rows.forEach(r => r.classList.toggle("ctx-on", +r.dataset.i === i));
    ctx.querySelector(".ctx-i").focus({ preventScroll: true });
  }
  // small "choose one" menu (sections, volumes); owner = the button it belongs to
  let menuOwner = null, choose = null, stay = false;   // stay: menu remains open while ticking
  function openChoice(owner, title, options, now, fn, x, y) {
    closeMenu();
    menuOwner = owner; choose = fn;
    ctx.innerHTML = (title ? `<div class="ctx-h">${esc(title)}</div>` : "") + options.map((o, k) =>
      `<button class="ctx-i ctx-c" role="menuitemradio" aria-checked="${k === now}" data-k="${k}"><i></i><span>${esc(o)}</span></button>`).join("");
    placeMenu(x, y);
    ctx.querySelectorAll(".ctx-i")[now]?.focus({ preventScroll: true });
  }
  function placeMenu(x, y, extra = 0) {
    ctx.hidden = false;
    // keep inside the viewport; grow from the cursor
    const w = ctx.offsetWidth, h = ctx.offsetHeight, m = 8;
    const left = Math.min(x, document.documentElement.clientWidth - w - m), top = Math.min(y, innerHeight - h - extra - m);
    ctx.style.left = Math.max(m, left) + "px";
    ctx.style.top = Math.max(m, top) + "px";
    ctx.style.transformOrigin = `${x - Math.max(m, left)}px ${y - Math.max(m, top)}px`;
    ctx.classList.remove("in"); void ctx.offsetWidth; ctx.classList.add("in");
  }
  function closeMenu() {
    if (ctx.hidden) return;
    ctx.hidden = true; menuFor = -1; menuOwner = choose = null; stay = false;
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
    const b = e.target.closest(".ctx-i, .ctx-ask"); if (!b) return;
    if (stay) return choose(+b.dataset.k);
    const i = menuFor, fn = choose;
    closeMenu();
    if (fn) return fn(+b.dataset.k);
    ({ play: () => toggle(i), pick: () => picked.has(tracks[i].file) ? togglePick(i) : choosePick(i), download: () => download(i), link: () => copyLink(i) })[b.dataset.act]();
  });
  ctx.addEventListener("keydown", e => {
    const items = [...ctx.querySelectorAll(".ctx-i, .ctx-ask")], k = items.indexOf(document.activeElement);
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
    swallowClick = false;
    if (e.pointerType !== "touch") return;
    const row = e.target.closest(".row"); if (!row) return;
    const x = e.clientX, y = e.clientY;
    lp = { x, y, timer: setTimeout(() => { swallowClick = true; navigator.vibrate?.(10); openMenu(+row.dataset.i, x, y); }, 520) };
  });
  const cancelLp = e => { if (lp && (!e || e.type !== "pointermove" || Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10)) { clearTimeout(lp.timer); lp = null; } };
  list.addEventListener("pointermove", cancelLp);
  list.addEventListener("pointerup", () => { if (lp) { clearTimeout(lp.timer); lp = null; } });
  list.addEventListener("pointercancel", cancelLp);

  /* ---- line under the name: section menu and volume switch ---- */
  let reopened = false, tomeHeld = false, tomeTimer = 0;   // reopened: this press just closed the button's own menu
  document.addEventListener("pointerdown", e => { reopened = !ctx.hidden && !!menuOwner && menuOwner.contains(e.target); }, true);
  /* ---- genre menu: right-click / long-press on Genre, several at once, all volumes ---- */
  const genreBtn = $("genreBtn");
  function openGenres(x, y) {
    closeMenu();
    menuOwner = genreBtn;
    const mark = () => ctx.querySelectorAll(".ctx-c").forEach(b => {
      const k = +b.dataset.k;
      b.setAttribute("aria-checked", k < 0 ? !genres.size : genres.has(allGenres[k]));
    });
    const item = (k, name, n) => `<button class="ctx-i ctx-c" role="menuitemcheckbox" data-k="${k}"><i></i><span>${esc(name)}</span><b>${n}</b></button>`;
    ctx.innerHTML = item(-1, t("allGenres"), tracks.length) + '<div class="ctx-sep"></div>' +
      allGenres.map((g, k) => item(k, g, tracks.filter(tr => tr.genre === g).length)).join("");
    choose = k => {
      if (k < 0) genres.clear();
      else genres.has(allGenres[k]) ? genres.delete(allGenres[k]) : genres.add(allGenres[k]);
      mark();
      filter();
    };
    stay = true;
    mark();
    placeMenu(x, y);
    ctx.querySelector(".ctx-i").focus({ preventScroll: true });
  }
  genreBtn.addEventListener("contextmenu", e => {
    e.preventDefault();
    clearTimeout(genreTimer);
    const r = genreBtn.getBoundingClientRect();
    openGenres(e.clientX || r.left, e.clientY || r.bottom);
  });
  genreBtn.addEventListener("pointerdown", e => {
    genreHeld = false;
    if (e.pointerType !== "touch") return;
    clearTimeout(genreTimer);
    genreTimer = setTimeout(() => { genreHeld = true; navigator.vibrate?.(10); openGenres(e.clientX, e.clientY); }, 520);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(n => genreBtn.addEventListener(n, () => clearTimeout(genreTimer)));

  function openSections(e) {
    e.preventDefault();
    if (reopened && e.type === "click") { reopened = false; return; }
    const r = catBtn.getBoundingClientRect();
    openChoice(catBtn, "", SECTIONS.map(s => t(s)), SECTIONS.indexOf(section),
      k => { if (SECTIONS[k] !== section) show(SECTIONS[k], tome); }, r.left, r.bottom + 4);
  }
  catBtn.addEventListener("click", openSections);
  catBtn.addEventListener("contextmenu", openSections);

  const openTomes = (x, y) => openChoice(tomeBtn, t("volumes"), Array.from({ length: tomes }, (_, n) => tomeName(n)), tome, n => show("tracks", n), x, y);
  tomeBtn.addEventListener("click", () => {
    if (tomeHeld) { tomeHeld = false; return; }
    if (reopened) { reopened = false; return; }
    show("tracks", (tome + 1) % tomes);
  });
  tomeBtn.addEventListener("contextmenu", e => {
    e.preventDefault();
    clearTimeout(tomeTimer);
    const r = tomeBtn.getBoundingClientRect();
    openTomes(e.clientX || r.left, e.clientY || r.bottom);
  });
  tomeBtn.addEventListener("pointerdown", e => {   // touch: long-press instead of right-click
    tomeHeld = false;
    if (e.pointerType !== "touch") return;
    clearTimeout(tomeTimer);
    tomeTimer = setTimeout(() => { tomeHeld = true; navigator.vibrate?.(10); openTomes(e.clientX, e.clientY); }, 520);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(n => tomeBtn.addEventListener(n, () => clearTimeout(tomeTimer)));

  document.addEventListener("pointerdown", e => { if (!ctx.hidden && !ctx.contains(e.target)) closeMenu(); }, true);
  addEventListener("scroll", () => { if (!stay) closeMenu(); }, { passive: true });
  addEventListener("resize", closeMenu);
  addEventListener("blur", closeMenu);

  /* ================= keyboard ================= */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (!ctx.hidden) return closeMenu(); closeLinks(); closeReq(); return closeModal(); }
    if (!modal.hidden || !links.hidden || !req.hidden || !ctx.hidden || e.target.closest("button, a, input, textarea")) return;
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
    shopRows.forEach((r, i) => r.querySelector(".sel").setAttribute("aria-label", t("select", { t: products[i].title })));
    renderSub();
    repeatLabel();
    muteBtn.setAttribute("aria-label", t(volume === 0 ? "unmute" : "mute"));
    renderChannels();
    renderLinks();
    filter();
    if (!modal.hidden) fillModal();
    if (!req.hidden) renderReq();
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
    load(i);
    show("tracks", tomeOf(i));
    rows[i].scrollIntoView({ block: "center", behavior: "smooth" });
    rows[i].classList.remove("flash"); void rows[i].offsetWidth; rows[i].classList.add("flash");
  }
  addEventListener("hashchange", openHash);
  if (location.hash) openHash();
})();
