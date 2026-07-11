/* ═══════════════════════════════════════════════════════════════
   log.txt — dziennik w stylu terminala
   dane trzymane lokalnie (localStorage), zero backendu
   ═══════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  /* ── stan ── */
  const STORAGE_KEY = "logtxt.state.v1";
  const THEME_KEY = "logtxt.theme";

  const defaultState = { entries: [], moods: [], notes: [], tasks: [], voice: [] };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      return Object.assign(structuredClone(defaultState), JSON.parse(raw));
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageStatus("local: ok");
      return true;
    } catch {
      setStorageStatus("local: FULL", true);
      toast("⚠ storage full — usuń stare nagrania");
      return false;
    }
  }

  function setStorageStatus(text, warn) {
    const el = document.getElementById("storageStatus");
    el.textContent = text;
    el.style.color = warn ? "var(--accent-warn)" : "";
  }

  /* ── utilsy ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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

  /* ── nawigacja ── */
  let activeView = "dashboard";
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");

  function showView(name) {
    activeView = name;
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
    $("#crumbView").textContent = name === "dashboard" ? "dashboard"
      : name === "mood" ? "mood.log"
      : name === "tasks" ? "tasks.todo"
      : name + "/";
    closeSidebar();
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

  /* ═══════════════ entries/ ═══════════════ */
  let activeTagFilter = null;

  function refreshEntryFilename() {
    $("#entryFilename").textContent = fmtFile(Date.now());
  }

  $("#entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const body = $("#entryBody").value.trim();
    if (!body) return;
    const tags = ($("#entryTags").value.match(/#[\p{L}\p{N}_-]+/gu) || []).map((t) => t.toLowerCase());
    state.entries.unshift({ id: uid(), ts: Date.now(), body, tags });
    if (saveState()) {
      $("#entryBody").value = "";
      $("#entryTags").value = "";
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
  }

  function entryCard(e) {
    return `<article class="entry-card" data-item-id="${e.id}">
      <div class="entry-meta">
        <span class="entry-hash">${hashOf(e.id)}</span>
        <span class="entry-file">${fmtFile(e.ts)}</span>
        <button class="entry-del" data-id="${e.id}">rm</button>
      </div>
      <div class="entry-body">${escapeHtml(e.body)}</div>
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
    state.moods.unshift({ id: uid(), ts: Date.now(), level: selectedMood, note: $("#moodNote").value.trim() });
    if (saveState()) {
      $("#moodNote").value = "";
      selectedMood = null;
      $$("#moodScale .mood-btn").forEach((b) => b.classList.remove("selected"));
      $("#moodSubmit").disabled = true;
      toast("Zapisano ✓ mood logged");
    }
    renderMood();
  });

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
    const note = { id: uid(), ts: Date.now(), updated: Date.now(), title: "nowa", body: "" };
    state.notes.unshift(note);
    saveState();
    activeNoteId = note.id;
    renderNotes();
    renderCounts();
    $("#noteTitle").focus();
    $("#noteTitle").select();
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
    if (tab === "preview") $("#notePreview").innerHTML = renderMarkdown($("#noteBody").value);
  }

  function renderNotes() {
    $("#noteFiles").innerHTML = state.notes.length
      ? state.notes.map((n) => `<button class="note-file ${n.id === activeNoteId ? "active" : ""}" data-id="${n.id}">
          <svg class="icon" viewBox="0 0 24 24" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <span class="note-file-name">${escapeHtml(n.title)}.md</span>
        </button>`).join("")
      : `<div class="empty-state" style="padding:20px 10px">// pusto — utwórz plik</div>`;

    $$("#noteFiles .note-file").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeNoteId = btn.dataset.id;
        renderNotes();
      })
    );

    const note = state.notes.find((n) => n.id === activeNoteId);
    $("#noteEditor").hidden = !note;
    if (note) {
      $("#noteTitle").value = note.title;
      $("#noteBody").value = note.body;
      setNoteTab("edit");
    }
  }

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

  function renderTasks() {
    $("#taskSprint").placeholder = currentSprint();

    const sprints = [...new Set(state.tasks.map((t) => t.sprint))];
    $("#sprintList").innerHTML = sprints.map((s) => `<option value="${escapeHtml(s)}">`).join("");

    if (!state.tasks.length) {
      $("#sprintGroups").innerHTML = `<div class="empty-state">// brak zadań — backlog czysty</div>`;
      return;
    }

    $("#sprintGroups").innerHTML = sprints.map((sprint) => {
      const tasks = state.tasks.filter((t) => t.sprint === sprint);
      const done = tasks.filter((t) => t.status === "done").length;
      return `<div class="sprint-group">
        <div class="sprint-head">
          <span>## ${escapeHtml(sprint)}</span>
          <span class="sprint-progress">[${done}/${tasks.length} done]</span>
        </div>
        ${tasks.map((t) => `<div class="task-item" data-status="${t.status}" data-item-id="${t.id}">
          <button class="task-check" data-id="${t.id}" aria-label="Zmień status">${STATUS_MARK[t.status]}</button>
          <span class="task-text">${escapeHtml(t.text)}</span>
          <span class="task-status">${t.status}</span>
          <button class="task-del" data-id="${t.id}">rm</button>
        </div>`).join("")}
      </div>`;
    }).join("");

    $$("#sprintGroups .task-check").forEach((btn) =>
      btn.addEventListener("click", () => {
        const t = state.tasks.find((x) => x.id === btn.dataset.id);
        t.status = STATUS_NEXT[t.status];
        saveState();
        renderTasks();
        renderCounts();
        if (t.status === "done") toast("✓ done — dobra robota");
      })
    );
    $$("#sprintGroups .task-del").forEach((btn) =>
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

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("#transcriptHint").textContent = SpeechRec ? "// auto-transkrypcja: on" : "// transkrypcja niedostępna w tej przeglądarce";

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

      const reader = new FileReader();
      reader.onload = () => {
        // małe opóźnienie na końcowe wyniki rozpoznawania mowy
        setTimeout(() => {
          state.voice.unshift({
            id: uid(), ts: Date.now(), duration,
            dataUrl: reader.result,
            peaks: sampled,
            transcript: transcriptText.trim(),
          });
          if (saveState()) toast("Zapisano ✓ voice memo committed");
          recStatus.textContent = "// gotowy";
          recTimer.textContent = "00:00";
          drawIdle();
          renderVoice();
          renderCounts();
        }, 400);
      };
      reader.readAsDataURL(blob);
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
          <audio controls preload="none" src="${v.dataUrl}"></audio>
          ${v.transcript ? `<div class="voice-transcript">${escapeHtml(v.transcript)}</div>` : ""}
        </article>`).join("")
      : `<div class="empty-state">// brak nagrań — naciśnij record i powiedz, co myślisz</div>`;

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
    $("#helloTitle").innerHTML = `${title}<span class="cursor" aria-hidden="true">_</span>`;

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

  /* ── router renderowania ── */
  function render(view) {
    if (view === "dashboard") renderDashboard();
    else if (view === "entries") renderEntries();
    else if (view === "mood") renderMood();
    else if (view === "notes") renderNotes();
    else if (view === "tasks") renderTasks();
    else if (view === "voice") renderVoice();
  }

  /* ── start ── */
  renderCounts();
  render("dashboard");
  drawIdle();
  setInterval(refreshEntryFilename, 30000);

  /* ── PWA: rejestracja service workera (offline + instalacja na telefonie) ── */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
