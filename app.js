/* ═══════════════════════════════════════════════════════════════
   log.txt — dziennik w stylu terminala
   dane trzymane lokalnie (localStorage), zero backendu
   ═══════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  /* ── stan ──
     Dane żyją w Supabase; `state` jest kopią roboczą trzymaną w pamięci,
     z której renderują się wszystkie widoki. Lokalnie zostają wyłącznie
     ustawienia wyglądu. */
  const THEME_KEY = "logtxt.theme";
  const LEGACY_STATE_KEY = "logtxt.state.v1"; // dane sprzed przejścia na konto

  const defaultState = { entries: [], moods: [], notes: [], tasks: [], voice: [] };

  // migracja starych rekordów: attachments jest domyślnie pustą listą
  function ensureAttachments(item) {
    if (!Array.isArray(item.attachments)) item.attachments = [];
    return item;
  }
  // migracja: pole `pinned` na notatkach
  function ensurePin(note) {
    if (typeof note.pinned !== "boolean") note.pinned = false;
    return note;
  }

  const PINNED_LIMIT = 4;
  const TASKS_PREVIEW_LIMIT = 5;

  let state = structuredClone(defaultState);
  let session = null; // { name, email } — ustawiane po zalogowaniu w Supabase

  // Widoki wołają saveState() po każdej zmianie; stąd zmiany trafiają do bazy.
  // Zapis jest optymistyczny: ekran odświeża się od razu, a wysyłka leci w tle
  // i sama zgłosi problem w pasku statusu.
  function saveState() {
    LOGTXT.scheduleSync(state);
    return true;
  }

  function setStorageStatus(text, warn) {
    const el = document.getElementById("storageStatus");
    el.textContent = text;
    el.style.color = warn ? "var(--accent-warn)" : "";
  }

  // o nieudanym zapisie mówimy raz, nie przy każdej próbie ponowienia —
  // ale mówimy, bo inaczej wpis zostałby tylko w tej karcie
  let syncBroken = false;
  LOGTXT.onStatus((text, warn) => {
    setStorageStatus(text, warn);
    if (warn && !syncBroken) toast("⚠ nie udało się zapisać — ponawiam");
    if (warn !== syncBroken && !warn && syncBroken) toast("✓ zapisano po ponowieniu");
    syncBroken = !!warn;
  });

  /* ── utilsy ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  // id nadaje klient, żeby świeży wpis miał tożsamość jeszcze przed zapisem
  // w bazie — stąd uuid, a nie własny licznik
  const uid = () => crypto.randomUUID();

  // pseudo-hash w stylu gita, deterministyczny dla id
  function hashOf(id) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h.toString(16).padStart(7, "0").slice(0, 7);
  }

  const pad = (n) => String(n).padStart(2, "0");

  function fmtFile(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.md`;
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function dayKey(ts) { return fmtDate(ts); }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - start) / 86400000 + 1) / 7);
  }
  function currentSprint() {
    const now = new Date();
    return `sprint_${now.getFullYear()}-W${pad(isoWeek(now))}`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  /* ── cofanie usunięcia (15 s) ── */
  const UNDO_MS = 15000;
  let pendingUndo = null; // { collection, item, index, onRestore, timerId, intervalId }

  function commitPendingDelete() {
    // element jest już poza stanem — porzucamy kopię i chowamy pasek
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timerId);
    clearInterval(pendingUndo.intervalId);
    pendingUndo = null;
    $("#undoBar").classList.remove("show");
  }

  // usuwa element z state[collection], dając 15 s na cofnięcie;
  // onRemove/onRestore odświeżają widok po każdej z operacji
  function deleteWithUndo(collection, id, label, onRemove, onRestore = onRemove) {
    commitPendingDelete(); // poprzednie oczekujące usunięcie staje się trwałe
    const index = state[collection].findIndex((x) => x.id === id);
    if (index === -1) return;
    const [item] = state[collection].splice(index, 1);
    saveState();
    onRemove();

    $("#undoTitle").textContent = `"${label}"`;
    const count = $("#undoCount");
    count.textContent = `${UNDO_MS / 1000}s`;

    // restart animacji paska postępu
    const fill = $("#undoFill");
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth;
    fill.style.transition = `width ${UNDO_MS}ms linear`;
    fill.style.width = "0%";

    $("#undoBar").classList.add("show");

    const deadline = Date.now() + UNDO_MS;
    pendingUndo = {
      collection, item, index, onRestore,
      timerId: setTimeout(commitPendingDelete, UNDO_MS),
      intervalId: setInterval(() => {
        count.textContent = `${Math.max(0, Math.ceil((deadline - Date.now()) / 1000))}s`;
      }, 200),
    };
  }

  $("#undoBtn").addEventListener("click", () => {
    if (!pendingUndo) return;
    const { collection, item, index, onRestore } = pendingUndo;
    commitPendingDelete();
    state[collection].splice(Math.min(index, state[collection].length), 0, item);
    saveState();
    onRestore(item);
    toast("↩ przywrócono ✓ restore complete");
  });

  /* ── motyw ── */
  const themeToggle = $("#themeToggle");
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.querySelector(".theme-label").textContent =
      theme === "dark" ? "light_mode" : "dark_mode";
    localStorage.setItem(THEME_KEY, theme);
    // kolor paska systemowego w zainstalowanej apce (PWA)
    document.querySelector('meta[name="theme-color"]')
      .setAttribute("content", theme === "dark" ? "#0d0f12" : "#fff7e6");
  }
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  themeToggle.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  // przełącznik motywu też na ekranie logowania — dzieli logikę z paskiem bocznym
  $("#authThemeToggle").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  /* ── nawigacja ── */
  let activeView = "dashboard";
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");

  function showView(name) {
    activeView = name;
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
    const moreBtn = document.getElementById("bottomNavMore");
    if (moreBtn) moreBtn.classList.toggle("active", name === "mood" || name === "voice");
    $("#crumbView").textContent = name === "dashboard" ? "dashboard"
      : name === "mood" ? "mood.log"
      : name === "tasks" ? "tasks.todo"
      : name + "/";
    closeSidebar();
    closeBottomSheet();
    render(name);
  }

  $$(".nav-item").forEach((btn) =>
    btn.addEventListener("click", () => showView(btn.dataset.view))
  );

  $("#menuBtn").addEventListener("click", () => {
    sidebar.classList.add("open");
    scrim.classList.add("show");
  });
  function closeSidebar() {
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
  }
  scrim.addEventListener("click", closeSidebar);

  /* ── mobilny bottom nav: sheet "więcej" ── */
  const bottomSheet = $("#bottomNavSheet");
  const bottomSheetScrim = $("#bottomSheetScrim");
  const bottomMoreBtn = $("#bottomNavMore");
  function openBottomSheet() {
    bottomSheet.classList.add("show");
    bottomSheetScrim.classList.add("show");
    bottomSheet.setAttribute("aria-hidden", "false");
    bottomMoreBtn.setAttribute("aria-expanded", "true");
  }
  function closeBottomSheet() {
    bottomSheet.classList.remove("show");
    bottomSheetScrim.classList.remove("show");
    bottomSheet.setAttribute("aria-hidden", "true");
    bottomMoreBtn.setAttribute("aria-expanded", "false");
  }
  bottomMoreBtn.addEventListener("click", () => {
    if (bottomSheet.classList.contains("show")) closeBottomSheet();
    else openBottomSheet();
  });
  bottomSheetScrim.addEventListener("click", closeBottomSheet);
  // mirror actions: motyw + wyloguj z sheetu
  $("#bottomThemeMirror").addEventListener("click", () => {
    $("#themeToggle").click();
    closeBottomSheet();
  });
  $("#bottomLogoutMirror").addEventListener("click", () => {
    closeBottomSheet();
    $("#logoutBtn").click();
  });

  /* ── liczniki w nav ── */
  function renderCounts() {
    const counts = {
      entries: state.entries.length,
      notes: state.notes.length,
      tasks: state.tasks.filter((t) => t.status !== "done").length,
      voice: state.voice.length,
    };
    $$(".nav-count").forEach((el) => {
      const n = counts[el.dataset.count];
      el.textContent = n ? n : "";
    });
  }

  /* ── data w topbarze ── */
  {
    const now = new Date();
    const days = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];
    $("#topbarDate").textContent = `${days[now.getDay()]} ${fmtDate(now)}`;
  }

  /* ═══════════════ transkrypcja ═══════════════
     Nagranie idzie do funkcji `transcribe` po stronie Supabase, a ta woła
     Groq Whisper kluczem trzymanym w sekretach projektu. Użytkownik nie
     konfiguruje niczego i nie widzi żadnego klucza.

     Rozpoznawanie mowy wbudowane w przeglądarkę zostaje jako zapas na czas,
     gdy transkrypcja po stronie serwera nie odpowie.
     ══════════════════════════════════════════════════════════════ */
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  const sttTranscribe = (blob) => LOGTXT.transcribe(blob);

  function sttHintText() {
    return "// auto-transkrypcja: on";
  }

  /* ═══════════════ media (zdjęcia + audio w edytorach) ═══════════════ */
  const WAVE_CHARS_STR = "▁▂▃▄▅▆▇█";

  function escapeAttr(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fileToDataUrl(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(file);
    });
  }

  async function fetchUrlAsDataUrl(url) {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error("fetch failed");
    const blob = await resp.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not an image");
    return fileToDataUrl(blob);
  }

  function renderAttachment(a, opts = {}) {
    const editable = opts.editable !== false;
    if (a.type === "image") {
      if (a.loading) return `<div class="attachment att-loading mono"><span class="dim">// ${escapeHtml(a.loadingMsg || "przesyłanie zdjęcia...")}</span></div>`;
      const cap = editable
        ? `<input type="text" class="att-caption mono" data-id="${a.id}" value="${escapeAttr(a.caption || "")}" placeholder="// caption (opcjonalnie)">`
        : (a.caption ? `<figcaption class="att-caption-view mono">// ${escapeHtml(a.caption)}</figcaption>` : "");
      const del = editable ? `<button type="button" class="att-del mono" data-id="${a.id}" title="Usuń">rm</button>` : "";
      return `<figure class="attachment att-image" data-att="${a.id}">
        <div class="att-image-frame"><img src="${escapeAttr(a.src)}" alt="${escapeAttr(a.caption || "")}" loading="lazy">${del}</div>
        ${cap}
      </figure>`;
    }
    if (a.type === "audio") {
      const wave = a.peaks ? a.peaks.map((p) => WAVE_CHARS_STR[Math.min(7, Math.floor(p * 8))]).join("") : "";
      const transcript = a.transcribing
        ? `<div class="voice-transcript vt-status mono">// transkrypcja w toku<span class="cursor" aria-hidden="true">_</span></div>`
        : a.transcript
          ? `<div class="voice-transcript"><span class="vt-text">${escapeHtml(a.transcript)}</span></div>`
          : "";
      const del = editable ? `<button type="button" class="att-del mono" data-id="${a.id}" title="Usuń">rm</button>` : "";
      return `<div class="attachment att-audio" data-att="${a.id}">
        <div class="att-audio-head mono">
          <span class="dim">// audio</span>
          <span class="dim">${pad(Math.floor(a.duration / 60))}:${pad(a.duration % 60)}</span>
          <span class="flex-spacer"></span>
          ${del}
        </div>
        <div class="voice-wave" aria-hidden="true">${wave}</div>
        <audio controls preload="none" src="${escapeAttr(a.src)}"></audio>
        ${transcript}
      </div>`;
    }
    return "";
  }

  function renderAttachmentsList(list, opts) {
    return (list || []).map((a) => renderAttachment(a, opts)).join("");
  }

  // kontroler jednego hosta (entry lub note); reużywany w obu edytorach
  function setupMediaHost({ host, getList, setList, getTextarea, onChange }) {
    const root = document.querySelector(`.media-toolbar[data-host="${host}"]`);
    const attachEl = document.querySelector(`#${host}Attachments`);
    const fileInput = document.querySelector(`#${host}FileInput`);
    const hintEl = root.querySelector("[data-hint]");
    const recBtn = root.querySelector('[data-act="rec"]');

    let hintTimer = null;
    function setHint(msg, sticky) {
      hintEl.textContent = msg || "";
      clearTimeout(hintTimer);
      if (msg && !sticky) hintTimer = setTimeout(() => (hintEl.textContent = ""), 2400);
    }

    function push(att) { setList([...getList(), att]); onChange && onChange(); render(); }
    function update(id, patch) {
      setList(getList().map((a) => (a.id === id ? { ...a, ...patch } : a)));
      onChange && onChange();
      render();
    }
    function remove(id) { setList(getList().filter((a) => a.id !== id)); onChange && onChange(); render(); }

    function render() {
      attachEl.innerHTML = renderAttachmentsList(getList(), { editable: true });
      attachEl.querySelectorAll(".att-del").forEach((b) =>
        b.addEventListener("click", () => remove(b.dataset.id))
      );
      attachEl.querySelectorAll(".att-caption").forEach((inp) =>
        inp.addEventListener("input", () => {
          // update bez re-render, żeby nie stracić fokusu
          const list = getList().map((a) => (a.id === inp.dataset.id ? { ...a, caption: inp.value } : a));
          setList(list);
          onChange && onChange();
        })
      );
      attachEl.querySelectorAll(".att-image img").forEach((img) =>
        img.addEventListener("click", () => img.classList.toggle("zoomed"))
      );
    }

    // zdjęcie ląduje w Storage; w pamięci trzymamy podgląd (blob URL) i ścieżkę,
    // a do bazy idzie sama ścieżka
    async function addPhotoFile(file) {
      if (!file || !file.type.startsWith("image/")) { setHint("// błąd: to nie jest obraz"); return; }
      const id = uid();
      push({ id, type: "image", src: "", caption: "", loading: true });
      setHint("// przesyłanie zdjęcia...", true);
      try {
        const ext = (file.type.split("/")[1] || "png").split(";")[0];
        const path = await LOGTXT.uploadMedia(file, "photo", ext);
        update(id, { src: URL.createObjectURL(file), path, loading: false });
        onChange && onChange();
        setHint("// gotowe");
      } catch (err) {
        remove(id);
        setHint(`// błąd: ${err.message}`, true);
      }
    }

    async function addPhotoUrl(url) {
      if (!url) return;
      const id = uid();
      push({ id, type: "image", src: "", caption: "", loading: true, loadingMsg: "pobieranie z URL..." });
      setHint("// pobieranie z URL...", true);
      try {
        // pobieramy do siebie, żeby zdjęcie nie zniknęło, gdy zniknie źródłowy link
        const dataUrl = await fetchUrlAsDataUrl(url);
        const blob = await (await fetch(dataUrl)).blob();
        const ext = (blob.type.split("/")[1] || "png").split(";")[0];
        const path = await LOGTXT.uploadMedia(blob, "photo", ext);
        update(id, { src: URL.createObjectURL(blob), path, loading: false });
      } catch {
        // CORS albo nie-obraz — zostaje sam link, przeglądarka pobierze go przy renderze
        update(id, { src: url, path: "", loading: false });
      }
      onChange && onChange();
      setHint("// gotowe");
    }

    // paste ze schowka (Ctrl+V) — jeśli w schowku jest obraz, dodajemy go zamiast wklejać tekst
    const textarea = getTextarea();
    if (textarea) {
      textarea.addEventListener("paste", (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (const it of items) {
          if (it.kind === "file" && it.type.startsWith("image/")) {
            const f = it.getAsFile();
            if (f) { e.preventDefault(); addPhotoFile(f); return; }
          }
        }
      });
    }

    root.querySelector('[data-act="photo-file"]').addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      for (const f of fileInput.files) addPhotoFile(f);
      fileInput.value = "";
    });
    root.querySelector('[data-act="photo-url"]').addEventListener("click", () => {
      const url = prompt("Wklej link do zdjęcia (jpg/png/webp):");
      if (url) addPhotoUrl(url.trim());
    });

    /* ── recorder (per host) ── */
    let mr = null, actx = null, ana = null, rafId = null, timerId = null;
    let peaks = [], transcript = "", recog = null, recStart = 0;

    async function toggleRec() {
      if (mr && mr.state === "recording") { mr.stop(); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { setHint("// błąd: brak dostępu do mikrofonu", true); return; }

      peaks = []; transcript = "";
      const chunks = [];
      mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaStreamSource(stream);
      ana = actx.createAnalyser();
      ana.fftSize = 1024;
      src.connect(ana);

      // rozpoznawanie w przeglądarce daje tekst od ręki; dokładniejsza
      // transkrypcja z serwera nadpisze go po zakończeniu nagrania
      if (SpeechRec) {
        recog = new SpeechRec();
        recog.lang = "pl-PL";
        recog.continuous = true;
        recog.interimResults = false;
        recog.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " ";
          }
        };
        try { recog.start(); } catch {}
      }

      const loop = () => {
        const data = new Uint8Array(ana.frequencyBinCount);
        ana.getByteTimeDomainData(data);
        let mx = 0;
        for (const v of data) mx = Math.max(mx, Math.abs(v - 128));
        if (peaks.length < 4000) peaks.push(mx / 128);
        rafId = requestAnimationFrame(loop);
      };

      mr.onstop = () => {
        cancelAnimationFrame(rafId);
        clearInterval(timerId);
        stream.getTracks().forEach((t) => t.stop());
        try { actx.close(); } catch {}
        if (recog) { try { recog.stop(); } catch {} }
        recBtn.classList.remove("recording");
        recBtn.innerHTML = `<span class="mb-dot"></span> nagraj`;

        const dur = Math.round((Date.now() - recStart) / 1000);
        const bars = 64, sampled = [];
        for (let i = 0; i < bars; i++) {
          const s = Math.floor((i / bars) * peaks.length);
          const en = Math.floor(((i + 1) / bars) * peaks.length);
          let mx = 0;
          for (let j = s; j < en; j++) mx = Math.max(mx, peaks[j] || 0);
          sampled.push(Math.min(1, mx * 1.5));
        }

        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const id = uid();

        // jeśli pole tekstowe jest puste — zaproponuj transkrypcję jako start
        const seedTextarea = (text) => {
          const ta = getTextarea();
          if (ta && !ta.value.trim() && text) {
            ta.value = text;
            ta.dispatchEvent(new Event("input"));
          }
        };

        (async () => {
          push({
            id, type: "audio", src: URL.createObjectURL(blob), path: "", duration: dur,
            peaks: sampled, transcript: transcript.trim(), transcribing: true,
          });

          setHint("// zapisywanie nagrania...", true);
          try {
            const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
            const path = await LOGTXT.uploadMedia(blob, "voice", ext);
            update(id, { path });
          } catch (err) {
            update(id, { transcribing: false });
            setHint(`// błąd: ${err.message}`, true);
            return;
          }

          setHint("// transkrypcja...", true);
          try {
            const text = await sttTranscribe(blob);
            update(id, { transcript: text, transcribing: false });
            setHint(text ? "// transkrypcja gotowa" : "// nie rozpoznano mowy");
            seedTextarea(text);
          } catch (err) {
            // zostaje to, co rozpoznała przeglądarka w trakcie nagrywania
            const fallback = transcript.trim();
            update(id, { transcript: fallback, transcribing: false });
            setHint(`// transkrypcja: ${err.message}`, true);
            seedTextarea(fallback);
          }
        })();
      };

      mr.start();
      recStart = Date.now();
      recBtn.classList.add("recording");
      recBtn.innerHTML = `<span class="mb-dot"></span> stop <span class="rec-time mono" data-t>00:00</span>`;
      setHint("// REC ● nagrywanie...", true);
      timerId = setInterval(() => {
        const s = Math.round((Date.now() - recStart) / 1000);
        const t = recBtn.querySelector("[data-t]");
        if (t) t.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
      }, 500);
      loop();
    }

    recBtn.addEventListener("click", toggleRec);

    return { render };
  }

  /* ═══════════════ entries/ ═══════════════ */
  let activeTagFilter = null;
  let entryDraftAttachments = [];

  function refreshEntryFilename() {
    $("#entryFilename").textContent = fmtFile(Date.now());
  }

  const entryMedia = setupMediaHost({
    host: "entry",
    getList: () => entryDraftAttachments,
    setList: (l) => { entryDraftAttachments = l; },
    getTextarea: () => $("#entryBody"),
  });

  $("#entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const body = $("#entryBody").value.trim();
    // wpis może być samym nagraniem / zdjęciem — pozwól zapisać bez tekstu, jeśli są załączniki
    if (!body && entryDraftAttachments.length === 0) return;
    const tags = ($("#entryTags").value.match(/#[\p{L}\p{N}_-]+/gu) || []).map((t) => t.toLowerCase());
    state.entries.unshift({
      id: uid(), ts: Date.now(), body, tags,
      attachments: entryDraftAttachments,
    });
    if (saveState()) {
      $("#entryBody").value = "";
      $("#entryTags").value = "";
      entryDraftAttachments = [];
      entryMedia.render();
      toast("Zapisano ✓ commit successful");
    }
    renderEntries();
    renderCounts();
  });

  function renderEntries() {
    refreshEntryFilename();

    // filtr tagów
    const allTags = [...new Set(state.entries.flatMap((e) => e.tags))].sort();
    if (activeTagFilter && !allTags.includes(activeTagFilter)) activeTagFilter = null;
    $("#tagFilter").innerHTML = allTags
      .map((t) => `<button class="tag ${t === activeTagFilter ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
      .join("");
    $$("#tagFilter .tag").forEach((el) =>
      el.addEventListener("click", () => {
        activeTagFilter = activeTagFilter === el.dataset.tag ? null : el.dataset.tag;
        renderEntries();
      })
    );

    const list = activeTagFilter
      ? state.entries.filter((e) => e.tags.includes(activeTagFilter))
      : state.entries;

    $("#entryList").innerHTML = list.length
      ? list.map(entryCard).join("")
      : `<div class="empty-state">// brak wpisów${activeTagFilter ? ` z tagiem ${escapeHtml(activeTagFilter)}` : " dzisiaj"} — dodaj pierwszy log</div>`;

    $$("#entryList .entry-del").forEach((btn) =>
      btn.addEventListener("click", () => {
        const entry = state.entries.find((e) => e.id === btn.dataset.id);
        if (!entry) return;
        const label = entry.body.split("\n")[0].slice(0, 40) || fmtFile(entry.ts);
        deleteWithUndo("entries", entry.id, label, () => {
          renderEntries();
          renderCounts();
        });
      })
    );

    // klik na badge nastroju otwiera mood.log
    $$("#entryList [data-mood-jump]").forEach((el) =>
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showView("mood");
      })
    );
  }

  // nastrój z danego dnia — używany jako mały kontekst przy wpisie
  function moodOfDay(k) {
    const m = state.moods.find((x) => dayKey(x.ts) === k);
    return m ? m.level : null;
  }

  function entryCard(e) {
    ensureAttachments(e);
    const attHtml = e.attachments.length
      ? `<div class="media-attachments media-view">${renderAttachmentsList(e.attachments, { editable: false })}</div>`
      : "";
    const dayMood = moodOfDay(dayKey(e.ts));
    const moodBadge = dayMood
      ? `<button type="button" class="entry-mood mono" data-mood-jump title="mood ${dayMood}/5 — otwórz mood.log">
          <span class="mood-cell l${dayMood}"></span><span class="em-lvl">${dayMood}/5</span>
        </button>`
      : "";
    return `<article class="entry-card" data-item-id="${e.id}">
      <div class="entry-meta">
        <span class="entry-hash">${hashOf(e.id)}</span>
        <span class="entry-file">${fmtFile(e.ts)}</span>
        ${moodBadge}
        <button class="entry-del" data-id="${e.id}">rm</button>
      </div>
      ${e.body ? `<div class="entry-body">${escapeHtml(e.body)}</div>` : ""}
      ${attHtml}
      ${e.tags.length ? `<div class="entry-tags">${e.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    </article>`;
  }

  /* ═══════════════ mood.log ═══════════════ */
  let selectedMood = null;

  /* zakres grafu: 28 dni domyślnie, przełączany na 45/90 */
  const MOOD_RANGES = [28, 45, 90];
  const MOOD_RANGE_KEY = "logtxt.moodRange";
  let moodRangeDays = Number(localStorage.getItem(MOOD_RANGE_KEY));
  if (!MOOD_RANGES.includes(moodRangeDays)) moodRangeDays = 28;

  $$("#moodRange .range-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      moodRangeDays = Number(btn.dataset.days);
      localStorage.setItem(MOOD_RANGE_KEY, moodRangeDays);
      renderMood();
    })
  );

  $$("#moodScale .mood-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      selectedMood = Number(btn.dataset.level);
      $$("#moodScale .mood-btn").forEach((b) => b.classList.toggle("selected", b === btn));
      $("#moodSubmit").disabled = false;
    })
  );

  $("#moodForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedMood) return;
    // jeden mood dziennie — jeśli dziś jest już wpis, nadpisujemy go zachowując id,
    // ale przenosimy na górę listy jako najnowszy
    const todayK = dayKey(Date.now());
    const existingIdx = state.moods.findIndex((m) => dayKey(m.ts) === todayK);
    const id = existingIdx >= 0 ? state.moods[existingIdx].id : uid();
    if (existingIdx >= 0) state.moods.splice(existingIdx, 1);
    const overwritten = existingIdx >= 0;
    state.moods.unshift({
      id, ts: Date.now(), level: selectedMood,
      note: $("#moodNote").value.trim(),
    });
    if (saveState()) {
      $("#moodNote").value = "";
      selectedMood = null;
      $$("#moodScale .mood-btn").forEach((b) => b.classList.remove("selected"));
      $("#moodSubmit").disabled = true;
      toast(overwritten ? "Zaktualizowano ✓ mood updated" : "Zapisano ✓ mood logged");
    }
    renderMood();
  });

  /* dopasowuje rozmiar kafelka moodu do dostępnej wysokości i szerokości —
     im więcej dni (28/45/90), tym mniejsze kafelki, wszystko musi się zmieścić
     bez scrolla przy typowych rozmiarach ekranu */
  function fitMoodGraph() {
    const graph = $("#moodGraph");
    const wrap = graph.closest(".mood-graph-wrap");
    if (!graph || !wrap) return;
    const cells = graph.children.length;
    if (!cells) return;
    const rows = Math.ceil(cells / 7);
    const cols = 7;
    const gap = 6;

    const rect = wrap.getBoundingClientRect();
    const availableW = rect.width;
    // budżet wysokości: reszta viewportu poniżej góry siatki minus rezerwa
    // na legendę, listę logów i margines. Trzymamy graf zwarty, żeby
    // 28d nie zajmowało pół ekranu.
    const budgetH = Math.max(110, window.innerHeight - rect.top - 380);

    const cellFromW = (availableW - (cols - 1) * gap) / cols;
    const cellFromH = (budgetH - (rows - 1) * gap) / rows;
    // kafelek trzymamy mały — priorytet: zwartość grafu
    const cell = Math.max(12, Math.floor(Math.min(cellFromW, cellFromH, 30)));

    wrap.style.setProperty("--mood-cell", cell + "px");
  }
  window.addEventListener("resize", () => { if (activeView === "mood") fitMoodGraph(); });

  function renderMood() {
    // graf: ostatnie N dni (28/45/90), układ kalendarza — kolumny = pon..nd, wiersze = tygodnie
    const byDay = {};
    for (const m of state.moods) {
      const k = dayKey(m.ts);
      if (!byDay[k]) byDay[k] = m.level; // najnowszy wpis dnia wygrywa (lista jest od najnowszych)
    }

    $("#moodRangeLabel").textContent = `// ostatnie ${moodRangeDays} dni`;
    $$("#moodRange .range-btn").forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.days) === moodRangeDays)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = dayKey(today.getTime());

    // początek zakresu i poniedziałek jego tygodnia (pełne kolumny)
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - (moodRangeDays - 1));
    const start = new Date(rangeStart);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

    let cells = "";
    const d = new Date(start);
    while (d <= today || (d.getDay() + 6) % 7 !== 0) {
      if (d > today && (d.getDay() + 6) % 7 === 0) break;
      const k = dayKey(d.getTime());
      const inRange = d >= rangeStart && d <= today;
      const level = inRange ? byDay[k] : undefined;
      cells += `<span class="mood-day ${k === todayKey ? "today" : ""}" ${level ? `data-level="${level}"` : ""} title="${inRange ? `${k}${level ? ` · nastrój ${level}/5` : ""}` : ""}" style="${!inRange ? "visibility:hidden" : ""}">${inRange ? `<span class="d">${d.getDate()}</span>` : ""}</span>`;
      d.setDate(d.getDate() + 1);
    }
    $("#moodGraph").innerHTML = cells;
    fitMoodGraph();

    // lista ostatnich logów nastroju
    const recent = state.moods.slice(0, 20);
    $("#moodList").innerHTML = recent.length
      ? recent.map((m) => `<article class="entry-card" data-item-id="${m.id}">
          <div class="entry-meta">
            <span class="entry-hash">${hashOf(m.id)}</span>
            <span class="entry-file">${fmtDate(m.ts)} ${fmtTime(m.ts)}</span>
            <span class="mood-entry-level">mood: ${"▰".repeat(m.level)}${"▱".repeat(5 - m.level)} ${m.level}/5</span>
            <button class="entry-del" data-id="${m.id}">rm</button>
          </div>
          ${m.note ? `<div class="entry-body">${escapeHtml(m.note)}</div>` : ""}
        </article>`).join("")
      : `<div class="empty-state">// brak logów nastroju — zapisz pierwszy stan</div>`;

    $$("#moodList .entry-del").forEach((btn) =>
      btn.addEventListener("click", () => {
        const m = state.moods.find((x) => x.id === btn.dataset.id);
        if (!m) return;
        deleteWithUndo("moods", m.id, `mood ${m.level}/5 · ${fmtDate(m.ts)}`, renderMood);
      })
    );
  }

  /* ═══════════════ notes/ ═══════════════ */
  let activeNoteId = null;

  $("#newNoteBtn").addEventListener("click", () => {
    const note = { id: uid(), ts: Date.now(), updated: Date.now(), title: "nowa", body: "", attachments: [] };
    state.notes.unshift(note);
    saveState();
    activeNoteId = note.id;
    renderNotes();
    renderCounts();
    $("#noteTitle").focus();
    $("#noteTitle").select();
  });

  // pojedynczy media host dla notatki, przełącza się na aktualnie aktywną
  const noteMedia = setupMediaHost({
    host: "note",
    getList: () => {
      const n = state.notes.find((x) => x.id === activeNoteId);
      return n ? ensureAttachments(n).attachments : [];
    },
    setList: (l) => {
      const n = state.notes.find((x) => x.id === activeNoteId);
      if (n) n.attachments = l;
    },
    getTextarea: () => $("#noteBody"),
    onChange: () => {
      const n = state.notes.find((x) => x.id === activeNoteId);
      if (n) { n.updated = Date.now(); saveState(); }
    },
  });

  $("#saveNoteBtn").addEventListener("click", () => {
    const note = state.notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    note.title = ($("#noteTitle").value.trim() || "bez_nazwy").replace(/\s+/g, "_");
    note.body = $("#noteBody").value;
    note.updated = Date.now();
    if (saveState()) toast("Zapisano ✓ commit successful");
    renderNotes();
  });

  $("#deleteNoteBtn").addEventListener("click", () => {
    const note = state.notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    deleteWithUndo("notes", note.id, note.title + ".md",
      () => {
        activeNoteId = null;
        renderNotes();
        renderCounts();
      },
      (item) => {
        activeNoteId = item.id;
        renderNotes();
        renderCounts();
      });
  });

  $("#tabEdit").addEventListener("click", () => setNoteTab("edit"));
  $("#tabPreview").addEventListener("click", () => setNoteTab("preview"));

  function setNoteTab(tab) {
    $("#tabEdit").classList.toggle("active", tab === "edit");
    $("#tabPreview").classList.toggle("active", tab === "preview");
    $("#noteBody").hidden = tab !== "edit";
    $("#notePreview").hidden = tab !== "preview";
    // toolbar/attachments widoczne tylko w trybie edycji (podgląd pokazuje osadzone media inline)
    document.querySelector('.media-toolbar[data-host="note"]').style.display = tab === "edit" ? "" : "none";
    $("#noteAttachments").style.display = tab === "edit" ? "" : "none";
    if (tab === "preview") {
      const n = state.notes.find((x) => x.id === activeNoteId);
      const attHtml = n && n.attachments && n.attachments.length
        ? `<div class="media-attachments media-view">${renderAttachmentsList(n.attachments, { editable: false })}</div>`
        : "";
      $("#notePreview").innerHTML = renderMarkdown($("#noteBody").value) + attHtml;
    }
  }

  function renderNotes() {
    // przypięte pierwsze, potem reszta w oryginalnej kolejności
    const sorted = [...state.notes].sort((a, b) => {
      const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return 0;
    });
    $("#noteFiles").innerHTML = sorted.length
      ? sorted.map((n) => `<div class="note-file-row ${n.id === activeNoteId ? "active" : ""}" data-id="${n.id}">
          <button class="note-file" data-id="${n.id}">
            <svg class="icon" viewBox="0 0 24 24" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            <span class="note-file-name">${escapeHtml(n.title)}.md</span>
          </button>
          <button class="pin-toggle ${n.pinned ? "pinned" : ""}" data-id="${n.id}" title="${n.pinned ? "Odepnij" : "Przypnij do dashboardu"}" aria-label="${n.pinned ? "Odepnij" : "Przypnij"}">
            <svg class="icon" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M12 2v7l4 4v3H8v-3l4-4V2z"/><path d="M12 16v6"/></svg>
          </button>
        </div>`).join("")
      : `<div class="empty-state" style="padding:20px 10px">// pusto — utwórz plik</div>`;

    $$("#noteFiles .note-file").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeNoteId = btn.dataset.id;
        renderNotes();
      })
    );
    $$("#noteFiles .pin-toggle").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePin(btn.dataset.id);
      })
    );

    const note = state.notes.find((n) => n.id === activeNoteId);
    $("#noteEditor").hidden = !note;
    if (note) {
      ensureAttachments(note);
      ensurePin(note);
      $("#noteTitle").value = note.title;
      $("#noteBody").value = note.body;
      const pinBtn = $("#pinNoteBtn");
      pinBtn.classList.toggle("pinned", note.pinned);
      pinBtn.setAttribute("aria-pressed", note.pinned ? "true" : "false");
      pinBtn.querySelector(".pin-btn-label").textContent = note.pinned ? "// unpin" : "// pin";
      noteMedia.render();
      setNoteTab("edit");
    }
  }

  function togglePin(id) {
    const note = state.notes.find((n) => n.id === id);
    if (!note) return;
    ensurePin(note);
    note.pinned = !note.pinned;
    note.pinnedAt = note.pinned ? Date.now() : null;
    saveState();
    toast(note.pinned ? "📌 przypięto ✓" : "// odpięto");
    if (activeView === "notes") renderNotes();
    if (activeView === "dashboard") renderDashboard();
  }

  $("#pinNoteBtn").addEventListener("click", () => {
    if (activeNoteId) togglePin(activeNoteId);
  });

  /* mini-markdown → HTML (bez zewnętrznych bibliotek) */
  function renderMarkdown(src) {
    const lines = escapeHtml(src).split("\n");
    let html = "";
    let inList = false;
    const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };

    for (const line of lines) {
      let m;
      if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
        closeList();
        const lvl = m[1].length;
        html += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
      } else if ((m = line.match(/^-\s+\[( |x)\]\s+(.*)/i))) {
        if (!inList) { html += "<ul>"; inList = true; }
        const done = m[1].toLowerCase() === "x";
        html += `<li class="md-check"><span class="box">- [${done ? "x" : "&nbsp;"}]</span> ${done ? "<s>" : ""}${inline(m[2])}${done ? "</s>" : ""}</li>`;
      } else if ((m = line.match(/^[-*]\s+(.*)/))) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${inline(m[1])}</li>`;
      } else if ((m = line.match(/^&gt;\s?(.*)/))) {
        closeList();
        html += `<blockquote>${inline(m[1])}</blockquote>`;
      } else if (line.trim() === "") {
        closeList();
      } else {
        closeList();
        html += `<p>${inline(line)}</p>`;
      }
    }
    closeList();
    return html || `<p class="dim">// pusty plik</p>`;

    function inline(s) {
      return s
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }
  }

  /* ═══════════════ tasks.todo ═══════════════ */
  const STATUS_NEXT = { pending: "in_progress", in_progress: "done", done: "pending" };
  const STATUS_MARK = { pending: "- [ ]", in_progress: "- [~]", done: "- [x]" };

  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#taskText").value.trim();
    if (!text) return;
    const sprint = $("#taskSprint").value.trim() || currentSprint();
    state.tasks.unshift({ id: uid(), ts: Date.now(), text, status: "pending", sprint });
    if (saveState()) {
      $("#taskText").value = "";
      toast("Zapisano ✓ task added → pending");
    }
    renderTasks();
    renderCounts();
  });

  const STATUS_ORDER = ["in_progress", "pending", "done"];
  let doneOpen = false; // sekcja done domyślnie zwinięta

  function taskRow(t) {
    return `<div class="task-item" data-status="${t.status}" data-item-id="${t.id}">
      <button class="task-check" data-id="${t.id}" title="→ ${STATUS_NEXT[t.status]}" aria-label="Następny status">${STATUS_MARK[t.status]}</button>
      <span class="task-text">${escapeHtml(t.text)}</span>
      <span class="task-sprint mono">${escapeHtml(t.sprint)}</span>
      <button class="status-tag mono" data-id="${t.id}" aria-haspopup="menu" title="Zmień status">${t.status}</button>
      <button class="task-del" data-id="${t.id}">rm</button>
    </div>`;
  }

  function renderTasks() {
    $("#taskSprint").placeholder = currentSprint();

    const sprints = [...new Set(state.tasks.map((t) => t.sprint))];
    $("#sprintList").innerHTML = sprints.map((s) => `<option value="${escapeHtml(s)}">`).join("");

    if (!state.tasks.length) {
      $("#statusGroups").innerHTML = `<div class="empty-state">// brak zadań — backlog czysty</div>`;
      return;
    }

    $("#statusGroups").innerHTML = STATUS_ORDER.map((status) => {
      const tasks = state.tasks.filter((t) => t.status === status);
      const isDone = status === "done";
      const open = !isDone || doneOpen;
      const head = isDone
        ? `<button class="status-head mono" id="doneToggle" aria-expanded="${doneOpen}">
            <span class="caret">${doneOpen ? "▾" : "▸"}</span>
            <span>## done</span>
            <span class="status-count">(${tasks.length})</span>
          </button>`
        : `<div class="status-head mono">
            <span>## ${status}</span>
            <span class="status-count">(${tasks.length})</span>
          </div>`;
      return `<div class="status-group" data-status="${status}">
        ${head}
        ${open ? (tasks.length ? tasks.map(taskRow).join("") : `<div class="empty-state slim">// pusto</div>`) : ""}
      </div>`;
    }).join("");

    const doneToggle = $("#doneToggle");
    if (doneToggle) doneToggle.addEventListener("click", () => {
      doneOpen = !doneOpen;
      renderTasks();
    });

    $$("#statusGroups .task-check").forEach((btn) =>
      btn.addEventListener("click", () => {
        const t = state.tasks.find((x) => x.id === btn.dataset.id);
        if (t) setTaskStatus(t.id, STATUS_NEXT[t.status]);
      })
    );
    $$("#statusGroups .status-tag").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleStatusMenu(btn);
      })
    );
    $$("#statusGroups .task-del").forEach((btn) =>
      btn.addEventListener("click", () => {
        const t = state.tasks.find((x) => x.id === btn.dataset.id);
        if (!t) return;
        deleteWithUndo("tasks", t.id, t.text.slice(0, 40), () => {
          renderTasks();
          renderCounts();
        });
      })
    );
  }

  /* menu wyboru statusu przy tagu */
  function closeStatusMenu() {
    $$(".status-menu").forEach((m) => m.remove());
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".status-menu")) closeStatusMenu();
  });

  function toggleStatusMenu(btn) {
    const item = btn.closest(".task-item");
    const wasOpen = item.querySelector(".status-menu");
    closeStatusMenu();
    if (wasOpen) return;
    const t = state.tasks.find((x) => x.id === btn.dataset.id);
    if (!t) return;
    const menu = document.createElement("div");
    menu.className = "status-menu mono";
    menu.innerHTML = STATUS_ORDER.map((s) =>
      `<button class="status-option ${s === t.status ? "current" : ""}" data-status="${s}">
        <span class="opt-mark">${STATUS_MARK[s]}</span> ${s}${s === t.status ? " ←" : ""}
      </button>`).join("");
    item.appendChild(menu);
    menu.querySelectorAll(".status-option").forEach((opt) =>
      opt.addEventListener("click", () => setTaskStatus(t.id, opt.dataset.status))
    );
  }

  /* zmiana statusu z animacją przeniesienia do właściwej sekcji */
  function setTaskStatus(id, status) {
    closeStatusMenu();
    const t = state.tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const el = document.querySelector(`#statusGroups [data-item-id="${id}"]`);
    const apply = () => {
      t.status = status;
      saveState();
      renderTasks();
      renderCounts();
      const nel = document.querySelector(`#statusGroups [data-item-id="${id}"]`);
      if (nel) {
        nel.classList.add("task-enter");
        setTimeout(() => nel.classList.remove("task-enter"), 350);
      }
      if (status === "done") toast("✓ done — dobra robota");
    };
    if (el) {
      el.classList.add("task-leave");
      setTimeout(apply, 180);
    } else apply();
  }

  /* ═══════════════ voice/ ═══════════════ */
  const recBtn = $("#recBtn");
  const recStatus = $("#recStatus");
  const recTimer = $("#recTimer");
  const canvas = $("#waveCanvas");
  const ctx2d = canvas.getContext("2d");

  let mediaRecorder = null;
  let audioCtx = null;
  let analyser = null;
  let rafId = null;
  let recStart = 0;
  let timerId = null;
  let peaks = [];         // próbki amplitudy do zapisu (ASCII-waveform)
  let recognition = null;
  let transcriptText = "";

  $("#transcriptHint").textContent = sttHintText();

  function resizeCanvas() {
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    canvas.height = 80 * (window.devicePixelRatio || 1);
  }
  window.addEventListener("resize", resizeCanvas);

  function drawIdle() {
    resizeCanvas();
    const { width: w, height: h } = canvas;
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border").trim();
    ctx2d.lineWidth = 1.5;
    ctx2d.beginPath();
    ctx2d.moveTo(0, h / 2);
    ctx2d.lineTo(w, h / 2);
    ctx2d.stroke();
  }

  function drawLive() {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    const { width: w, height: h } = canvas;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();

    ctx2d.clearRect(0, 0, w, h);
    ctx2d.strokeStyle = accent;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    const step = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 255) * h;
      i === 0 ? ctx2d.moveTo(0, y) : ctx2d.lineTo(i * step, y);
    }
    ctx2d.stroke();

    // amplituda do zapisanego waveformu
    let max = 0;
    for (const v of data) max = Math.max(max, Math.abs(v - 128));
    if (peaks.length < 4000) peaks.push(max / 128);

    rafId = requestAnimationFrame(drawLive);
  }

  recBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      recStatus.textContent = "// błąd: brak dostępu do mikrofonu";
      return;
    }

    peaks = [];
    transcriptText = "";
    const chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    // patrz recorder w edytorach: to tekst zapasowy, nadpisywany przez serwer
    if (SpeechRec) {
      recognition = new SpeechRec();
      recognition.lang = "pl-PL";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) transcriptText += e.results[i][0].transcript + " ";
        }
      };
      try { recognition.start(); } catch { /* już działa lub brak wsparcia */ }
    }

    mediaRecorder.onstop = async () => {
      cancelAnimationFrame(rafId);
      clearInterval(timerId);
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      if (recognition) { try { recognition.stop(); } catch {} }

      recBtn.classList.remove("recording");
      recBtn.innerHTML = `<span class="rec-dot" aria-hidden="true"></span> record`;
      recStatus.textContent = "// zapisywanie...";

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      const duration = Math.round((Date.now() - recStart) / 1000);

      // downsample peaks do ~64 słupków
      const bars = 64;
      const sampled = [];
      for (let i = 0; i < bars; i++) {
        const s = Math.floor((i / bars) * peaks.length);
        const e = Math.floor(((i + 1) / bars) * peaks.length);
        let mx = 0;
        for (let j = s; j < e; j++) mx = Math.max(mx, peaks[j] || 0);
        sampled.push(Math.min(1, mx * 1.5));
      }

      const memo = {
        id: uid(), ts: Date.now(), duration,
        src: URL.createObjectURL(blob),
        path: "",
        peaks: sampled,
        transcript: transcriptText.trim(), // zapas z przeglądarki, do nadpisania
        transcribing: true,
        sttError: "",
      };
      state.voice.unshift(memo);
      recTimer.textContent = "00:00";
      drawIdle();
      renderVoice();
      renderCounts();

      // najpierw plik do Storage — bez ścieżki nagranie nie przetrwałoby odświeżenia
      recStatus.textContent = "// zapisywanie nagrania...";
      try {
        const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
        memo.path = await LOGTXT.uploadMedia(blob, "voice", ext);
        saveState();
        toast("Zapisano ✓ voice memo committed");
      } catch (err) {
        memo.transcribing = false;
        memo.sttError = err.message;
        recStatus.textContent = `// błąd: ${err.message}`;
        renderVoice();
        return;
      }

      recStatus.textContent = "// transkrypcja...";
      try {
        memo.transcript = await sttTranscribe(blob);
        memo.sttError = "";
        recStatus.textContent = memo.transcript ? "// gotowy" : "// nie rozpoznano mowy";
      } catch (err) {
        memo.sttError = err.message;
        recStatus.textContent = `// transkrypcja: ${err.message}`;
      } finally {
        memo.transcribing = false;
        saveState();
        renderVoice();
      }
    };

    mediaRecorder.start();
    recStart = Date.now();
    recBtn.classList.add("recording");
    recBtn.innerHTML = `<span class="rec-dot" aria-hidden="true"></span> stop`;
    recStatus.textContent = "// REC ● nagrywanie...";
    timerId = setInterval(() => {
      const s = Math.round((Date.now() - recStart) / 1000);
      recTimer.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    }, 500);
    resizeCanvas();
    drawLive();
  });

  const WAVE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  function asciiWave(peaks) {
    return peaks.map((p) => WAVE_CHARS[Math.min(7, Math.floor(p * 8))]).join("");
  }

  // blok transkrypcji: tekst (skrót, rozwijany kliknięciem) albo stan w toku/błędu
  function transcriptBlock(v) {
    if (v.transcribing)
      return `<div class="voice-transcript vt-status mono">// transkrypcja w toku<span class="cursor" aria-hidden="true">_</span></div>`;

    // każde nagranie da się przepuścić ponownie — także starsze, sprzed przejścia
    // na transkrypcję po stronie serwera
    const redo = v.path
      ? `<button type="button" class="vt-redo mono" data-redo="${v.id}">↻ ${v.transcript ? "transkrybuj ponownie" : "transkrybuj"}</button>`
      : "";

    // nieudana próba przy istniejącym tekście: stary tekst zostaje, błąd dopisujemy pod nim
    const errLine = v.sttError
      ? `<div class="voice-transcript vt-status mono">// ${escapeHtml(v.sttError)}</div>`
      : "";

    if (v.transcript)
      return `<button type="button" class="voice-transcript vt-toggle" data-id="${v.id}" title="Pokaż całość / zwiń">
          <span class="vt-text">${escapeHtml(v.transcript)}</span>
        </button>${errLine}${redo}`;
    if (errLine) return `${errLine}${redo}`;

    return `<div class="voice-transcript vt-status mono">// nie rozpoznano mowy</div>${redo}`;
  }

  function renderVoice() {
    $("#voiceList").innerHTML = state.voice.length
      ? state.voice.map((v) => `<article class="entry-card voice-card" data-item-id="${v.id}">
          <div class="entry-meta">
            <span class="entry-hash">${hashOf(v.id)}</span>
            <span class="entry-file">${fmtDate(v.ts)}_${fmtTime(v.ts).replace(":", "-")}.webm</span>
            <span class="dim">${pad(Math.floor(v.duration / 60))}:${pad(v.duration % 60)}</span>
            <button class="entry-del" data-id="${v.id}">rm</button>
          </div>
          <div class="voice-wave" aria-hidden="true">${asciiWave(v.peaks || [])}</div>
          <audio controls preload="none" src="${escapeAttr(v.src || "")}"></audio>
          ${transcriptBlock(v)}
        </article>`).join("")
      : `<div class="empty-state">// brak nagrań — naciśnij record i powiedz, co myślisz</div>`;

    $$("#voiceList .vt-toggle").forEach((el) =>
      el.addEventListener("click", () => el.classList.toggle("expanded"))
    );

    $$("#voiceList .vt-redo").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const v = state.voice.find((x) => x.id === btn.dataset.redo);
        if (!v || v.transcribing) return;
        v.transcribing = true;
        renderVoice();
        try {
          const audio = await (await fetch(v.src)).blob();
          v.transcript = await sttTranscribe(audio);
          v.sttError = "";
          toast(v.transcript ? "Transkrypcja gotowa ✓" : "Nie rozpoznano mowy");
        } catch (err) {
          v.sttError = err.message;
          toast(`⚠ ${err.message}`);
        } finally {
          v.transcribing = false;
          saveState();
          renderVoice();
        }
      })
    );

    $$("#voiceList .entry-del").forEach((btn) =>
      btn.addEventListener("click", () => {
        const v = state.voice.find((x) => x.id === btn.dataset.id);
        if (!v) return;
        const label = `${fmtDate(v.ts)}_${fmtTime(v.ts).replace(":", "-")}.webm`;
        deleteWithUndo("voice", v.id, label, () => {
          renderVoice();
          renderCounts();
        });
      })
    );
  }

  /* ═══════════════ dashboard / welcome ═══════════════ */
  const KIND_VIEW = { entry: "entries", mood: "mood", note: "notes", task: "tasks", voice: "voice" };

  // przejście do konkretnego elementu w sekcji + podświetlenie
  function openItem(kind, id) {
    const view = KIND_VIEW[kind];
    if (kind === "note") activeNoteId = id;
    if (kind === "entry") activeTagFilter = null;
    if (kind === "task") {
      const t = state.tasks.find((x) => x.id === id);
      if (t && t.status === "done") doneOpen = true; // rozwiń sekcję, żeby dało się doskrolować
    }
    showView(view);
    if (kind === "note") return; // notatka otwiera się w edytorze
    setTimeout(() => {
      const el = document.querySelector(`.view[data-view="${view}"] [data-item-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 1900);
      }
    }, 90);
  }

  // szybkie akcje: skok do sekcji + fokus na właściwym polu
  $$(".qa-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const qa = btn.dataset.qa;
      const focusMap = {
        entry: ["entries", "#entryBody"],
        mood: ["mood", "#moodScale .mood-btn"],
        task: ["tasks", "#taskText"],
        voice: ["voice", "#recBtn"],
      };
      const [view, sel] = focusMap[qa];
      showView(view);
      setTimeout(() => { const el = $(sel); if (el) el.focus(); }, 90);
    })
  );

  $("#logoHome").addEventListener("click", () => showView("dashboard"));

  function startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // poniedziałek
    return d.getTime();
  }

  function fmtRecentTime(ts) {
    const todayK = dayKey(Date.now());
    const k = dayKey(ts);
    if (k === todayK) return fmtTime(ts);
    return `${k.slice(5)} ${fmtTime(ts)}`;
  }

  function renderDashboard() {
    const now = new Date();
    const h = now.getHours();
    const title = h < 5 ? "nocna sesja" : h < 12 ? "dzień dobry" : h < 18 ? "witaj z powrotem" : "dobry wieczór";
    const name = (session && session.name) ? session.name.trim() : "";
    const namePart = name ? `, ${escapeHtml(name)}` : "";
    $("#helloTitle").innerHTML = `${title}${namePart}<span class="cursor" aria-hidden="true">_</span>`;

    const all = [...state.entries, ...state.moods, ...state.notes, ...state.tasks, ...state.voice];
    const todayK = dayKey(Date.now());
    const todayCount = all.filter((x) => dayKey(x.ts) === todayK).length;

    const activeDays = new Set(all.map((x) => dayKey(x.ts)));
    let streak = 0;
    const d = new Date();
    while (activeDays.has(dayKey(d.getTime()))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    const days = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const dniWord = streak === 1 ? "dzień" : "dni";
    $("#helloLine").textContent =
      `// jest ${fmtTime(now.getTime())}, ${days[now.getDay()]} · streak: ${streak} ${dniWord} 🔥 · commits_today: ${todayCount}`;

    /* ── kafelki sekcji ── */
    const weekStart = startOfWeek();
    const weekEntries = state.entries.filter((e) => e.ts >= weekStart).length;
    const lastEntry = state.entries[0];
    const lastMood = state.moods[0];
    const moodTrend = state.moods.slice(0, 7).reverse();
    const lastNote = state.notes.slice().sort((a, b) => (b.updated || b.ts) - (a.updated || a.ts))[0];
    const doneTasks = state.tasks.filter((t) => t.status === "done").length;
    const lastVoice = state.voice[0];

    const spark = moodTrend.length
      ? `<span class="mood-spark" aria-hidden="true">${moodTrend
          .map((m) => `<span style="height:${m.level * 20}%;background:var(--mood-${m.level})"></span>`)
          .join("")}</span>`
      : `<span class="tile-sub">// brak trendu</span>`;

    $("#dashTiles").innerHTML = `
      <button class="tile" data-tile="entries">
        <span class="tile-head"><span>entries/</span><span class="tile-arrow">→</span></span>
        <span class="tile-stat">${weekEntries} <span class="tile-unit">w tym tygodniu</span></span>
        <span class="tile-sub">${lastEntry ? "ostatni: „" + escapeHtml(lastEntry.body.split("\n")[0].slice(0, 60)) + "”" : "// brak wpisów — dodaj pierwszy log"}</span>
      </button>
      <button class="tile" data-tile="mood">
        <span class="tile-head"><span>mood.log</span><span class="tile-arrow">→</span></span>
        <span class="tile-stat">${lastMood ? "▰".repeat(lastMood.level) + "▱".repeat(5 - lastMood.level) + ` <span class="tile-unit">${lastMood.level}/5</span>` : "—"}</span>
        ${spark}
      </button>
      <button class="tile" data-tile="notes">
        <span class="tile-head"><span>notes/</span><span class="tile-arrow">→</span></span>
        <span class="tile-stat">${state.notes.length} <span class="tile-unit">${state.notes.length === 1 ? "plik" : "plików"}</span></span>
        <span class="tile-sub">${lastNote ? escapeHtml(lastNote.title) + ".md" : "// pusto — utwórz plik"}</span>
      </button>
      <button class="tile" data-tile="tasks">
        <span class="tile-head"><span>tasks.todo</span><span class="tile-arrow">→</span></span>
        <span class="tile-stat">${doneTasks}/${state.tasks.length} <span class="tile-unit">done</span></span>
        <span class="tile-bar" aria-hidden="true"><span class="tile-bar-fill" style="width:${state.tasks.length ? Math.round((doneTasks / state.tasks.length) * 100) : 0}%"></span></span>
      </button>
      <button class="tile" data-tile="voice">
        <span class="tile-head"><span>voice/</span><span class="tile-arrow">→</span></span>
        <span class="tile-stat">${state.voice.length} <span class="tile-unit">${state.voice.length === 1 ? "nagranie" : "nagrań"}</span></span>
        <span class="tile-sub">${lastVoice ? `ostatnie: ${pad(Math.floor(lastVoice.duration / 60))}:${pad(lastVoice.duration % 60)}` : "// cisza w eterze"}</span>
      </button>`;

    $$("#dashTiles .tile").forEach((t) =>
      t.addEventListener("click", () => showView(t.dataset.tile))
    );

    /* ── pinned/ ── */
    renderPinnedPanel();

    /* ── tasks preview ── */
    renderTasksPreview();

    /* ── ostatnia aktywność ── */
    const items = [
      ...state.entries.map((e) => ({ ts: e.ts, kind: "entry", id: e.id, msg: e.body.split("\n")[0] })),
      ...state.moods.map((m) => ({ ts: m.ts, kind: "mood", id: m.id, msg: `nastrój ${m.level}/5${m.note ? " — " + m.note : ""}` })),
      ...state.notes.map((n) => ({ ts: n.updated || n.ts, kind: "note", id: n.id, msg: n.title + ".md" })),
      ...state.tasks.map((t) => ({ ts: t.ts, kind: "task", id: t.id, msg: `${STATUS_MARK[t.status]} ${t.text}` })),
      ...state.voice.map((v) => ({ ts: v.ts, kind: "voice", id: v.id, msg: v.transcript ? v.transcript.slice(0, 80) : `nagranie ${v.duration}s` })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 6);

    $("#recentList").innerHTML = items.length
      ? items.map((it) => `<button class="recent-item" data-kind="${it.kind}" data-id="${it.id}">
          <span class="entry-hash">${hashOf(it.id)}</span>
          <span class="recent-chip">${it.kind}</span>
          <span class="recent-msg">${escapeHtml(it.msg)}</span>
          <span class="recent-time">${fmtRecentTime(it.ts)}</span>
        </button>`).join("")
      : `<div class="empty-state">// brak aktywności — zacznij od pierwszego commita</div>`;

    $$("#recentList .recent-item").forEach((el) =>
      el.addEventListener("click", () => openItem(el.dataset.kind, el.dataset.id))
    );
  }

  function notePreviewSnippet(n) {
    // pierwsze 1–2 niepuste linijki treści (bez markdownowego szumu w tytułach)
    const raw = (n.body || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const lines = raw.slice(0, 2).map((l) => l.replace(/^#{1,3}\s+/, "").replace(/^[-*]\s+/, "• "));
    return lines.join(" · ") || "// pusty plik";
  }

  function renderPinnedPanel() {
    const pinned = state.notes
      .filter((n) => n.pinned)
      .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
    const shown = pinned.slice(0, PINNED_LIMIT);
    const overflow = pinned.length - shown.length;

    $("#pinnedCount").textContent = pinned.length ? `// ${pinned.length}` : "";
    const linkBtn = $("#pinnedAllLink");
    linkBtn.hidden = overflow <= 0;
    linkBtn.textContent = `+${overflow} więcej →`;

    $("#pinnedList").innerHTML = shown.length
      ? shown.map((n) => `<button class="pinned-card" data-id="${n.id}">
          <span class="pinned-head mono">
            <svg class="icon" viewBox="0 0 24 24" style="width:11px;height:11px"><path d="M12 2v7l4 4v3H8v-3l4-4V2z"/><path d="M12 16v6"/></svg>
            <span class="pinned-title">${escapeHtml(n.title)}.md</span>
            <span class="pinned-unpin" data-unpin="${n.id}" title="Odepnij">// unpin</span>
          </span>
          <span class="pinned-snippet">${escapeHtml(notePreviewSnippet(n))}</span>
        </button>`).join("")
      : `<div class="empty-state slim">// brak przypiętych notatek — przypnij coś ważnego</div>`;

    $$("#pinnedList .pinned-card").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        if (e.target.closest(".pinned-unpin")) return; // klik na unpin nie otwiera notatki
        openItem("note", btn.dataset.id);
      })
    );
    $$("#pinnedList .pinned-unpin").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = el.closest(".pinned-card");
        if (card) card.classList.add("pin-leave");
        setTimeout(() => togglePin(el.dataset.unpin), 180);
      })
    );
    if (linkBtn && !linkBtn.dataset.wired) {
      linkBtn.dataset.wired = "1";
      linkBtn.addEventListener("click", () => showView("notes"));
    }
  }

  function renderTasksPreview() {
    // in_progress → pending, świeższe wyżej; done pomijamy
    const openList = state.tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
        return b.ts - a.ts;
      });
    const shown = openList.slice(0, TASKS_PREVIEW_LIMIT);
    const overflow = openList.length - shown.length;

    $("#tasksPreviewCount").textContent = openList.length ? `// ${openList.length} otwartych` : "";
    const linkBtn = $("#tasksAllLink");
    linkBtn.hidden = overflow <= 0;
    linkBtn.textContent = `+${overflow} więcej →`;

    $("#tasksPreviewList").innerHTML = shown.length
      ? shown.map((t) => `<div class="tp-row" data-status="${t.status}" data-id="${t.id}">
          <button class="tp-check" data-cycle="${t.id}" title="→ ${STATUS_NEXT[t.status]}" aria-label="Następny status">${STATUS_MARK[t.status]}</button>
          <button class="tp-open" data-open="${t.id}">
            <span class="tp-text">${escapeHtml(t.text)}</span>
            <span class="tp-status mono">${t.status}</span>
          </button>
        </div>`).join("")
      : (state.tasks.length
          ? `<div class="empty-state slim">// wszystko zrobione ✓</div>`
          : `<div class="empty-state slim">// brak zadań — dodaj pierwsze</div>`);

    $$("#tasksPreviewList .tp-check").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = state.tasks.find((x) => x.id === btn.dataset.cycle);
        if (!t) return;
        const row = btn.closest(".tp-row");
        if (row) row.classList.add("tp-flash");
        setTaskStatus(t.id, STATUS_NEXT[t.status]);
        // setTaskStatus renderuje sekcję tasks — nasz podgląd też musi się odświeżyć
        renderTasksPreview();
      })
    );
    $$("#tasksPreviewList .tp-open").forEach((btn) =>
      btn.addEventListener("click", () => openItem("task", btn.dataset.open))
    );
    if (linkBtn && !linkBtn.dataset.wired) {
      linkBtn.dataset.wired = "1";
      linkBtn.addEventListener("click", () => showView("tasks"));
    }
  }

  /* ── router renderowania ── */
  function render(view) {
    if (view === "dashboard") renderDashboard();
    else if (view === "entries") renderEntries();
    else if (view === "mood") renderMood();
    else if (view === "notes") renderNotes();
    else if (view === "tasks") renderTasks();
    else if (view === "voice") renderVoice();
  }

  /* ═══════════════ auth: logowanie / rejestracja / dev mode ═══════════════ */
  const authScreen = $("#authScreen");
  const mainApp = $("#mainApp");
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");
  const loginError = $("#loginError");
  const registerError = $("#registerError");

  function showAuth(mode = "login") {
    authScreen.hidden = false;
    mainApp.hidden = true;
    switchAuthMode(mode);
  }
  function hideAuth() {
    authScreen.hidden = true;
    mainApp.hidden = false;
  }
  function switchAuthMode(mode) {
    loginForm.hidden = mode !== "login";
    registerForm.hidden = mode !== "register";
    loginError.textContent = "";
    registerError.textContent = "";
    // fokus na pierwsze pole
    setTimeout(() => {
      const first = (mode === "login" ? loginForm : registerForm).querySelector("input");
      if (first) first.focus();
    }, 60);
  }

  $$(".auth-link").forEach((btn) =>
    btn.addEventListener("click", () => switchAuthMode(btn.dataset.goto))
  );

  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const email = $("#loginEmail").value.trim().toLowerCase();
    const password = $("#loginPassword").value;

    if (!isValidEmail(email)) {
      loginError.textContent = "// błąd: niepoprawny adres email";
      return;
    }
    if (password.length < 1) {
      loginError.textContent = "// błąd: wpisz hasło";
      return;
    }

    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    loginError.textContent = "// łączenie...";
    try {
      const user = await LOGTXT.auth.signIn(email, password);
      await enterApp(user);
      toast(`✓ zalogowano jako ${LOGTXT.auth.name(user)}`);
    } catch (err) {
      loginError.textContent = `// błąd: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerError.textContent = "";
    const name = $("#regName").value.trim();
    const email = $("#regEmail").value.trim().toLowerCase();
    const password = $("#regPassword").value;
    const password2 = $("#regPassword2").value;

    if (name.length < 1) {
      registerError.textContent = "// błąd: podaj imię";
      return;
    }
    if (!isValidEmail(email)) {
      registerError.textContent = "// błąd: niepoprawny adres email";
      return;
    }
    if (password.length < 8) {
      registerError.textContent = "// błąd: hasło musi mieć min. 8 znaków";
      return;
    }
    if (password !== password2) {
      registerError.textContent = "// błąd: hasła się nie zgadzają";
      return;
    }

    const btn = registerForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    registerError.textContent = "// zakładam konto...";
    try {
      const res = await LOGTXT.auth.signUp(email, password, name);
      // przy włączonym potwierdzaniu adresu konto istnieje, ale sesji jeszcze nie ma
      if (res.needsConfirmation) {
        registerError.textContent = "// konto założone — potwierdź adres linkiem z maila, potem zaloguj się";
        switchAuthMode("login");
        $("#loginEmail").value = email;
        return;
      }
      await enterApp(res.user);
      toast(`✓ konto utworzone — witaj, ${name}`);
    } catch (err) {
      registerError.textContent = `// błąd: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await LOGTXT.auth.signOut();
    session = null;
    state = structuredClone(defaultState);
    showAuth("login");
    // wyczyść wrażliwe pola formularza logowania po wylogowaniu
    $("#loginEmail").value = "";
    $("#loginPassword").value = "";
  });

  function refreshSidebarUser() {
    const nameEl = $("#sidebarUserName");
    if (!nameEl) return;
    nameEl.textContent = (session && session.name) ? session.name : "guest";
  }

  // wspólne wejście do aplikacji: zaciąga dane konta, dopiero potem pokazuje ekran
  async function enterApp(user) {
    session = { name: LOGTXT.auth.name(user), email: user.email };
    hideAuth();
    refreshSidebarUser();
    setStorageStatus("sync: wczytywanie...");
    try {
      state = await LOGTXT.loadAll();
      setStorageStatus("sync: ok");
    } catch (err) {
      setStorageStatus("sync: błąd", true);
      toast(`⚠ ${err.message}`);
    }
    showView("dashboard");
    render("dashboard");
    renderCounts();
    drawIdle();
    await offerLegacyImport();
  }

  /* ── jednorazowy import danych sprzed przejścia na konto ──
     Stary dziennik siedzi w localStorage tej przeglądarki. Nie kasujemy go
     po imporcie — zostaje jako kopia, dopóki użytkownik sam nie posprząta. */
  async function offerLegacyImport() {
    let legacy;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STATE_KEY) || "null");
    } catch { return; }
    if (!legacy) return;

    const counts = ["entries", "moods", "notes", "tasks"]
      .map((k) => (legacy[k] || []).length);
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return;

    // nagrania pomijamy: siedzą jako base64 i musiałyby przejść przez Storage,
    // a przy okazji to one zajmowały najwięcej miejsca
    const msg = `Znaleziono lokalny dziennik z tej przeglądarki: ${total} wpisów `
      + `(${counts[0]} entries, ${counts[1]} mood, ${counts[2]} notatek, ${counts[3]} zadań).\n\n`
      + "Przenieść je na konto? Nagrania głosowe nie zostaną przeniesione.";
    if (!confirm(msg)) return;

    const have = new Set([...state.entries, ...state.moods, ...state.notes, ...state.tasks].map((i) => i.id));
    const fresh = (item) => ({ ...item, id: have.has(item.id) ? uid() : item.id });

    for (const e of legacy.entries || []) {
      // stare załączniki to dataURL-e — bez ścieżki w Storage nie mają jak przetrwać
      state.entries.push({ ...fresh(e), attachments: [] });
    }
    for (const m of legacy.moods || []) state.moods.push(fresh(m));
    for (const n of legacy.notes || []) state.notes.push({ ...fresh(n), attachments: [] });
    for (const t of legacy.tasks || []) state.tasks.push(fresh(t));

    const ok = await LOGTXT.syncNow(state);
    render(activeView);
    renderCounts();
    toast(ok ? `✓ przeniesiono ${total} wpisów` : "⚠ część wpisów się nie zapisała");
  }

  /* ═══════════════ ekran startowy ═══════════════
     Nazwa aplikacji wystukiwana znak po znaku, jak na terminalu. Leci przy
     każdym starcie: i przed panelem logowania, i przed wejściem do dziennika. */
  const bootScreen = $("#bootScreen");
  const bootName = $("#bootName");
  const bootStatus = $("#bootStatus");
  const bootBarFill = $("#bootBarFill");
  const BOOT_TEXT = "log.txt";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // wystukanie nazwy; zwraca obietnicę spełnioną, gdy animacja się kończy
  async function playBoot() {
    if (reduceMotion) {
      bootName.textContent = BOOT_TEXT;
      bootScreen.classList.add("is-typed");
      bootStatus.textContent = "// wczytywanie dziennika...";
      bootBarFill.style.width = "100%";
      return;
    }
    await wait(180);
    for (const ch of BOOT_TEXT) {
      bootName.textContent += ch;
      // kropka to naturalna pauza w pisaniu — dłuższa niż zwykły znak
      await wait(ch === "." ? 150 : 85);
    }
    bootScreen.classList.add("is-typed");
    bootStatus.textContent = "// wczytywanie dziennika...";
    bootBarFill.style.width = "100%";
    await wait(420);
  }

  function setBootStatus(text) {
    bootStatus.textContent = text;
  }

  async function finishBoot() {
    bootScreen.classList.add("is-done");
    await wait(reduceMotion ? 0 : 450);
    bootScreen.hidden = true;
  }

  /* ── start ── */
  renderCounts();
  (async () => {
    const booted = playBoot();
    if (!LOGTXT.configured) {
      showAuth("login");
      $("#loginError").textContent = window.supabase
        ? "// błąd: brak klucza do backendu — uzupełnij config.js"
        : "// błąd: nie wczytał się klient bazy — odśwież stronę";
      loginForm.querySelector('button[type="submit"]').disabled = true;
      await booted;
      await finishBoot();
      return;
    }
    // sesja przeżywa odświeżenie strony, więc najpierw pytamy o nią Supabase
    let user = null;
    try {
      user = await LOGTXT.auth.current();
    } catch { /* brak sesji traktujemy jak wylogowanie */ }
    await booted;
    if (user) {
      // zalogowany: ekran startowy zostaje, aż dziennik będzie gotowy
      setBootStatus("// synchronizacja wpisów...");
      await enterApp(user);
    } else {
      showAuth("login");
    }
    await finishBoot();
  })();
  setInterval(refreshEntryFilename, 30000);

  /* ── PWA: rejestracja service workera (offline + instalacja na telefonie) ── */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
